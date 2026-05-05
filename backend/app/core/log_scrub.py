"""
Loguru filter that redacts secrets from log messages before they hit stdout
or the log file. Defense in depth — application code already promises not
to log raw tokens, but a typo in an f-string or a third-party library can
still slip a credential through. This middleware is the last line.

The rules are intentionally broad: false positives produce ``***REDACTED***``
in a log line, which is harmless. False negatives leak credentials, which
is not.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

# Order matters: more-specific patterns first so a webhook URL doesn't get
# partially masked by the generic Authorization rule.
_SECRET_PATTERNS = [
    # GitHub Personal Access Tokens (classic + fine-grained)
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bgho_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bghu_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bghs_[A-Za-z0-9]{20,}\b"),
    # GitLab PATs
    re.compile(r"\bglpat-[A-Za-z0-9_\-]{20,}\b"),
    # Slack incoming webhooks (the URL itself is the credential)
    re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9/]+"),
    # AWS access keys
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    # Generic Bearer tokens in Authorization headers
    re.compile(r"(?i)(authorization\s*[:=]\s*bearer\s+)[A-Za-z0-9._\-]+"),
    # JWT-shaped values (three base64url segments)
    re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"),
]

_REDACTION = "***REDACTED***"

# Dict-key match for structured records so {"token": "ghp_..."} gets scrubbed
# even when the value alone wouldn't match a pattern.
_SENSITIVE_KEYS = {
    "token",
    "github_token",
    "gitlab_token",
    "access_token",
    "refresh_token",
    "api_key",
    "apikey",
    "password",
    "secret",
    "authorization",
    "webhook",
    "webhook_url",
    "slackwebhookurl",
    "jirawebhookurl",
    "genericwebhookurl",
}


def _scrub_str(value: str) -> str:
    out = value
    for pattern in _SECRET_PATTERNS:
        out = pattern.sub(
            lambda m: (m.group(1) + _REDACTION) if m.lastindex else _REDACTION,
            out,
        )
    return out


def _scrub_value(key: str, value: Any) -> Any:
    if key.lower() in _SENSITIVE_KEYS:
        return _REDACTION
    if isinstance(value, str):
        return _scrub_str(value)
    if isinstance(value, Mapping):
        return {k: _scrub_value(str(k), v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return type(value)(_scrub_value(key, v) for v in value)
    return value


def scrub_record(record: dict) -> bool:
    """Loguru filter — mutates ``record['message']`` and ``record['extra']``
    in place, then returns True so the record is still emitted."""
    try:
        msg = record.get("message")
        if isinstance(msg, str):
            record["message"] = _scrub_str(msg)
        extra = record.get("extra")
        if isinstance(extra, dict):
            for k in list(extra.keys()):
                extra[k] = _scrub_value(str(k), extra[k])
    except Exception:
        # A scrubber that crashes must never take logging down with it.
        pass
    return True
