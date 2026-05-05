"""
Vault Sentry — MFA management endpoints.

All secrets (service role key, SMTP credentials, Resend key) stay server-side.
OTP codes are SHA-256 hashed in memory — plaintext only exists during email send.
"""

import asyncio
import hashlib
import random
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from jose import jwt, JWTError
from loguru import logger
from pydantic import BaseModel

from app.core.config import settings
from app.core.supabase_client import is_supabase_configured

router = APIRouter()

# ---------------------------------------------------------------------------
# OTP store — hashed, rate-limited, auto-expiring
# ---------------------------------------------------------------------------

OTP_TTL = 5 * 60  # 5 minutes
MAX_ATTEMPTS = 5


class _OtpEntry:
    __slots__ = ("hash", "expires_at", "attempts")

    def __init__(self, code: str):
        self.hash = hashlib.sha256(code.encode()).hexdigest()
        self.expires_at = time.time() + OTP_TTL
        self.attempts = 0


_otp_store: Dict[str, _OtpEntry] = {}


def _cleanup():
    now = time.time()
    expired = [k for k, v in _otp_store.items() if now > v.expires_at]
    for k in expired:
        del _otp_store[k]


def _generate_otp(user_id: str) -> str:
    _cleanup()
    code = str(random.SystemRandom().randint(100_000, 999_999))
    _otp_store[user_id] = _OtpEntry(code)
    return code


def _verify_otp(user_id: str, code: str) -> tuple:
    entry = _otp_store.get(user_id)
    if not entry:
        return False, "No verification code was sent. Please request a new one."
    if time.time() > entry.expires_at:
        _otp_store.pop(user_id, None)
        return False, "Code expired. Please request a new one."
    if entry.attempts >= MAX_ATTEMPTS:
        _otp_store.pop(user_id, None)
        return False, "Too many attempts. Please request a new code."
    entry.attempts += 1
    if entry.hash != hashlib.sha256(code.strip().encode()).hexdigest():
        remaining = MAX_ATTEMPTS - entry.attempts
        return False, f"Invalid code. {remaining} attempt{'s' if remaining != 1 else ''} remaining."
    _otp_store.pop(user_id, None)
    return True, ""


# ---------------------------------------------------------------------------
# Email sending — SMTP (primary) or Resend (fallback)
# ---------------------------------------------------------------------------

def _build_html(code: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e4e4e7;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:28px;font-weight:700;color:#a78bfa">VaultSentry</span>
      </div>
      <h2 style="margin:0 0 8px;color:#fafafa;font-size:20px">Verification Code</h2>
      <p style="color:#a1a1aa;margin:0 0 24px;font-size:14px;line-height:1.5">
        You requested to disable two-factor authentication. Enter this code to confirm:
      </p>
      <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:24px;text-align:center;font-size:36px;font-family:monospace;letter-spacing:0.4em;font-weight:bold;color:#a78bfa">
        {code}
      </div>
      <p style="color:#71717a;font-size:12px;margin:24px 0 0;line-height:1.5">
        This code expires in <strong>5 minutes</strong>. If you didn't request this, ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #27272a;margin:24px 0"/>
      <p style="color:#52525b;font-size:11px;text-align:center;margin:0">
        VaultSentry — Cloud-Native Secret Detection &amp; Security
      </p>
    </div>"""


def _send_smtp(to: str, code: str) -> Optional[str]:
    """Send OTP via SMTP. Returns None on success, error string on failure."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "VaultSentry — Your verification code"
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to

        msg.attach(MIMEText(f"Your VaultSentry verification code is: {code}\n\nExpires in 5 minutes.", "plain"))
        msg.attach(MIMEText(_build_html(code), "html"))

        port = settings.SMTP_PORT
        if port == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, port, timeout=20) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, port, timeout=20) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())

        logger.info(f"[MFA] OTP email sent via SMTP to {to[:3]}***")
        return None
    except Exception as e:
        logger.error(f"[MFA] SMTP send failed: {type(e).__name__}: {e}")
        return str(e)


async def _send_resend(to: str, code: str) -> Optional[str]:
    """Send OTP via Resend API. Returns None on success, error string on failure."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.SUPPORT_FROM_ADDRESS,
                    "to": [to],
                    "subject": "VaultSentry — Your verification code",
                    "html": _build_html(code),
                    "text": f"Your VaultSentry verification code is: {code}\n\nExpires in 5 minutes.",
                },
            )
        if resp.status_code >= 400:
            return f"Resend API error ({resp.status_code}): {resp.text[:200]}"
        logger.info(f"[MFA] OTP email sent via Resend to {to[:3]}***")
        return None
    except Exception as e:
        logger.error(f"[MFA] Resend send failed: {type(e).__name__}: {e}")
        return str(e)


async def _send_otp_email(to: str, code: str) -> Optional[str]:
    """Try SMTP first, then Resend. Returns None on success."""
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        return await asyncio.to_thread(_send_smtp, to, code)
    if settings.RESEND_API_KEY:
        return await _send_resend(to, code)
    return "No email provider configured. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD or RESEND_API_KEY in backend .env"


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _mask_email(email: str) -> str:
    try:
        local, domain = email.split("@", 1)
        return f"{local[:2]}***@{domain}"
    except Exception:
        return "***"


async def _resolve_user(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = auth[7:]

    if settings.SUPABASE_JWT_SECRET:
        try:
            claims = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience=settings.SUPABASE_JWT_AUDIENCE,
                options={"verify_exp": True},
            )
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        except Exception as e:
            logger.warning(f"[MFA] Token decode failed: {type(e).__name__}: {e}")
            raise HTTPException(status_code=401, detail="Invalid token")
    else:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(status_code=500, detail="JWT secret not configured")
        logger.warning("[MFA] SUPABASE_JWT_SECRET not set — using unverified claims (dev only)")
        try:
            claims = jwt.get_unverified_claims(token)
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or malformed token")
        except Exception as e:
            logger.warning(f"[MFA] Token claims decode failed: {type(e).__name__}: {e}")
            raise HTTPException(status_code=401, detail="Invalid or malformed token")

    user_id = claims.get("sub")
    email = claims.get("email")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"id": user_id, "email": email}


# ---------------------------------------------------------------------------
# Supabase admin helper — direct HTTP instead of SDK to stay fully async
# ---------------------------------------------------------------------------

async def _delete_mfa_factor(user_id: str, factor_id: str) -> Optional[str]:
    """Delete an MFA factor via Supabase Admin API. Returns None on success."""
    if not settings.SUPABASE_URL:
        return "Supabase URL not configured"

    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}/factors/{factor_id}"
    headers = {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.delete(url, headers=headers)
        if resp.status_code >= 400:
            logger.error(f"[MFA] Supabase delete_factor returned {resp.status_code}: {resp.text[:200]}")
            return f"Supabase error ({resp.status_code}): {resp.text[:200]}"
        return None
    except Exception as e:
        logger.error(f"[MFA] delete_factor request failed: {type(e).__name__}: {e}")
        return str(e)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SendOtpResponse(BaseModel):
    success: bool
    email: Optional[str] = None
    error: Optional[str] = None


class DisableRequest(BaseModel):
    userId: str
    factorId: str
    code: str
    method: str


class DisableResponse(BaseModel):
    success: bool
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/send-otp", response_model=SendOtpResponse)
async def send_otp(request: Request):
    user = await _resolve_user(request)
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email on account")

    code = _generate_otp(user["id"])
    logger.info(f"[MFA] Sending OTP to {_mask_email(email)}")
    err = await _send_otp_email(email, code)

    if err:
        return SendOtpResponse(success=False, error=err)

    return SendOtpResponse(success=True, email=_mask_email(email))


@router.post("/disable", response_model=DisableResponse)
async def disable_mfa(request: Request, body: DisableRequest):
    logger.info(f"[MFA] Disable request: method={body.method}, factorId={body.factorId[:8]}...")

    if body.method not in ("email", "totp"):
        raise HTTPException(status_code=400, detail="Invalid method")

    user = await _resolve_user(request)
    if user["id"] != body.userId:
        raise HTTPException(status_code=401, detail="User mismatch")

    # Verify the code
    if body.method == "email":
        valid, err = _verify_otp(body.userId, body.code)
        if not valid:
            logger.warning(f"[MFA] OTP verification failed: {err}")
            return DisableResponse(success=False, error=err)
        logger.info("[MFA] OTP verified successfully")
    else:
        # TOTP: challenge + verify via Supabase user API
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        access_token = request.headers.get("authorization", "").replace("Bearer ", "")
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                challenge_resp = await client.post(
                    f"{settings.SUPABASE_URL}/auth/v1/factors/{body.factorId}/challenge",
                    headers={
                        "apikey": settings.SUPABASE_KEY,
                        "Authorization": f"Bearer {access_token}",
                    },
                )
            if challenge_resp.status_code >= 400:
                return DisableResponse(success=False, error="Could not start MFA challenge")
            challenge_data = challenge_resp.json()
            challenge_id = challenge_data.get("id")
            if not challenge_id:
                return DisableResponse(success=False, error="Could not start MFA challenge")

            async with httpx.AsyncClient(timeout=15) as client:
                verify_resp = await client.post(
                    f"{settings.SUPABASE_URL}/auth/v1/factors/{body.factorId}/verify",
                    headers={
                        "apikey": settings.SUPABASE_KEY,
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    json={"challenge_id": challenge_id, "code": body.code},
                )
            if verify_resp.status_code >= 400:
                return DisableResponse(success=False, error="Invalid authenticator code")
        except Exception as e:
            logger.error(f"[MFA] TOTP verify failed: {type(e).__name__}: {e}")
            return DisableResponse(success=False, error=str(e) or "Invalid authenticator code")

    # Delete the factor via admin (service role) — fully async via httpx
    if not settings.SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Supabase service key not configured")

    logger.info(f"[MFA] Deleting factor {body.factorId[:8]}... for user {body.userId}")
    err = await _delete_mfa_factor(body.userId, body.factorId)
    if err:
        logger.warning(f"[MFA] Factor delete failed: {err}")
        return DisableResponse(success=False, error=err)

    logger.info(f"[MFA] Factor {body.factorId} deleted for user {body.userId}")
    return DisableResponse(success=True)
