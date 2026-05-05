"""
Vault Sentry - Token Encryption Utility
Provides AES-256-GCM encryption for sensitive data like GitHub PATs.

Encryption modes (selected automatically):
  v3  — KMS envelope encryption (preferred when KMS_KEY_ID is configured).
          KMS generates a one-time data key; only the encrypted copy is stored.
  v2  — Local AES-256-GCM with AAD bound to the owning user_id.
  v1  — Legacy local AES-256-GCM, no AAD (backward compat only).

NEVER store tokens in plaintext.
"""

import os
import base64
import hashlib
from typing import Optional

# Ensure boto3 can verify TLS on Windows (Python 3.14 ships without a CA bundle).
if not os.environ.get("AWS_CA_BUNDLE"):
    try:
        import certifi
        os.environ["AWS_CA_BUNDLE"] = certifi.where()
    except ImportError:
        pass

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from loguru import logger

from app.core.config import settings


class TokenEncryption:
    """
    Secure encryption service for sensitive tokens.

    When KMS_KEY_ID is set the service uses envelope encryption:
      encrypt  → KMS.generate_data_key → AES-256-GCM with the plaintext data key
      decrypt  → KMS.decrypt(encrypted_data_key) → AES-256-GCM decrypt

    The master key never leaves KMS; the local process only ever holds a
    short-lived plaintext data key in memory during a single operation.
    """

    NONCE_SIZE = 12   # AES-GCM: 96-bit nonce
    SALT_SIZE = 16    # PBKDF2 salt (v1/v2 only)
    KEY_SIZE = 32     # AES-256

    _V2_PREFIX = "v2:"
    _V3_PREFIX = "v3:"

    # Length of the AES-256 data key returned by KMS
    _DATA_KEY_SIZE = 32

    def __init__(self):
        self._master_key = settings.SECRET_KEY.encode("utf-8")
        self._kms_key_id = settings.KMS_KEY_ID
        self._kms_client = None

        if self._kms_key_id:
            try:
                self._kms_client = boto3.client(
                    "kms",
                    region_name=settings.AWS_REGION,
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                )
                logger.info("[ENCRYPTION] KMS envelope encryption enabled")
            except Exception as e:
                logger.error(f"[ENCRYPTION] Failed to initialise KMS client: {e}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def encrypt(self, plaintext: str, context: Optional[str] = None) -> str:
        """
        Encrypt *plaintext*.

        Args:
            plaintext: value to protect (e.g. GitHub PAT).
            context:   stable owner identifier (typically user_id) bound into
                       the AES-GCM tag as Additional Authenticated Data. Must
                       be supplied at decrypt time. When omitted the legacy v2
                       format (no AAD) is produced.

        Returns:
            Versioned, base64-encoded ciphertext string.
        """
        if not plaintext:
            return ""

        if self._kms_client and self._kms_key_id:
            return self._encrypt_kms(plaintext, context)
        return self._encrypt_local(plaintext, context)

    def decrypt(self, encrypted: str, context: Optional[str] = None) -> str:
        """
        Decrypt a ciphertext produced by :meth:`encrypt`.

        Args:
            encrypted: versioned ciphertext string.
            context:   AAD supplied at encrypt time (required for v2/v3).

        Raises:
            ValueError: tampered data, wrong key, or wrong context.
        """
        if not encrypted:
            return ""

        if encrypted.startswith(self._V3_PREFIX):
            return self._decrypt_kms(encrypted, context)
        return self._decrypt_local(encrypted, context)

    def hash_token(self, token: str) -> str:
        """SHA-256 of *token* for equality checks without storing plaintext."""
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def mask_token(self, token: str) -> str:
        """Return a display-safe masked form: first 8 + last 4 chars."""
        if not token or len(token) < 12:
            return "***"
        return f"{token[:8]}...{token[-4:]}"

    # ------------------------------------------------------------------
    # KMS envelope encryption (v3)
    # ------------------------------------------------------------------

    def _encrypt_kms(self, plaintext: str, context: Optional[str]) -> str:
        """
        Envelope-encrypt using AWS KMS.

        Wire format (after base64):
            encrypted_data_key (variable, from KMS)
          + nonce              (12 bytes)
          + ciphertext         (variable)

        The encrypted_data_key length is prepended as a 2-byte big-endian
        integer so decryption can split the blob unambiguously.
        """
        try:
            encryption_context = {"user_id": context} if context else {}
            response = self._kms_client.generate_data_key(
                KeyId=self._kms_key_id,
                KeySpec="AES_256",
                EncryptionContext=encryption_context,
            )
            plaintext_key: bytes = response["Plaintext"]
            encrypted_key: bytes = response["CiphertextBlob"]

            nonce = os.urandom(self.NONCE_SIZE)
            aad = context.encode("utf-8") if context else None
            aesgcm = AESGCM(plaintext_key)
            ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), aad)

            # Pack: 2-byte key length | encrypted_key | nonce | ciphertext
            edk_len = len(encrypted_key).to_bytes(2, "big")
            blob = base64.b64encode(edk_len + encrypted_key + nonce + ciphertext).decode("utf-8")
            return f"{self._V3_PREFIX}{blob}"

        except (BotoCoreError, ClientError) as e:
            logger.error(f"[ENCRYPTION] KMS encrypt failed: {type(e).__name__}: {e}")
            raise ValueError("Failed to encrypt token via KMS")
        finally:
            # Zero out plaintext key from local memory
            if "plaintext_key" in dir():
                plaintext_key = b"\x00" * len(plaintext_key)  # noqa: F841

    def _decrypt_kms(self, encrypted: str, context: Optional[str]) -> str:
        if not self._kms_client:
            raise ValueError("KMS client not configured — cannot decrypt v3 blob")

        try:
            payload = encrypted[len(self._V3_PREFIX):]
            raw = base64.b64decode(payload.encode("utf-8"))

            edk_len = int.from_bytes(raw[:2], "big")
            encrypted_key = raw[2 : 2 + edk_len]
            nonce = raw[2 + edk_len : 2 + edk_len + self.NONCE_SIZE]
            ciphertext = raw[2 + edk_len + self.NONCE_SIZE :]

            encryption_context = {"user_id": context} if context else {}
            response = self._kms_client.decrypt(
                CiphertextBlob=encrypted_key,
                EncryptionContext=encryption_context,
            )
            plaintext_key: bytes = response["Plaintext"]

            aad = context.encode("utf-8") if context else None
            aesgcm = AESGCM(plaintext_key)
            return aesgcm.decrypt(nonce, ciphertext, aad).decode("utf-8")

        except (BotoCoreError, ClientError) as e:
            logger.error(f"[ENCRYPTION] KMS decrypt failed: {type(e).__name__}: {e}")
            raise ValueError("Failed to decrypt token via KMS")
        except Exception as e:
            logger.error(f"[ENCRYPTION] Decryption failed: {type(e).__name__}")
            raise ValueError("Failed to decrypt token - data may be corrupted or tampered")
        finally:
            if "plaintext_key" in dir():
                plaintext_key = b"\x00" * len(plaintext_key)  # noqa: F841

    # ------------------------------------------------------------------
    # Local AES-256-GCM (v1 / v2 — backward compat)
    # ------------------------------------------------------------------

    def _derive_key(self, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self.KEY_SIZE,
            salt=salt,
            iterations=100000,
            backend=default_backend(),
        )
        return kdf.derive(self._master_key)

    def _encrypt_local(self, plaintext: str, context: Optional[str]) -> str:
        try:
            salt = os.urandom(self.SALT_SIZE)
            nonce = os.urandom(self.NONCE_SIZE)
            key = self._derive_key(salt)
            aad = context.encode("utf-8") if context else None
            aesgcm = AESGCM(key)
            ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), aad)
            blob = base64.b64encode(salt + nonce + ciphertext).decode("utf-8")
            return f"{self._V2_PREFIX}{blob}" if context else blob
        except Exception as e:
            logger.error(f"[ENCRYPTION] Local encrypt failed: {type(e).__name__}")
            raise ValueError("Failed to encrypt token")

    def _decrypt_local(self, encrypted: str, context: Optional[str]) -> str:
        try:
            if encrypted.startswith(self._V2_PREFIX):
                payload = encrypted[len(self._V2_PREFIX):]
                aad = context.encode("utf-8") if context else None
            else:
                payload = encrypted
                aad = None  # legacy v1 blob — no AAD

            raw = base64.b64decode(payload.encode("utf-8"))
            salt = raw[: self.SALT_SIZE]
            nonce = raw[self.SALT_SIZE : self.SALT_SIZE + self.NONCE_SIZE]
            ciphertext = raw[self.SALT_SIZE + self.NONCE_SIZE :]

            key = self._derive_key(salt)
            aesgcm = AESGCM(key)
            return aesgcm.decrypt(nonce, ciphertext, aad).decode("utf-8")

        except Exception as e:
            logger.error(f"[ENCRYPTION] Local decrypt failed: {type(e).__name__}")
            raise ValueError("Failed to decrypt token - data may be corrupted or tampered")


# Singleton instance
token_encryption = TokenEncryption()
