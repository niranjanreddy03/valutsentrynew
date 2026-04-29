"""
SSRF protection utilities.

Validates user-supplied URLs before they are fetched, to block requests to
private/internal networks, link-local addresses, loopback, and cloud
metadata endpoints. Also rebinds httpx connections to the resolved IP to
defeat DNS rebinding.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import Iterable, Optional
from urllib.parse import urlparse

import httpx


class UnsafeURLError(ValueError):
    """Raised when a URL is rejected by SSRF validation."""


_ALLOWED_SCHEMES = {"http", "https"}
_BLOCKED_PORTS = {0, 22, 23, 25, 110, 143, 3306, 5432, 6379, 9200, 11211, 27017}
_METADATA_HOSTS = {
    "metadata.google.internal",
    "metadata",
}
_METADATA_IPS = {
    "169.254.169.254",   # AWS / GCP / Azure IMDS
    "fd00:ec2::254",     # AWS IMDSv6
    "100.100.100.200",   # Alibaba
}


def _is_disallowed_ip(ip: ipaddress._BaseAddress) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or str(ip) in _METADATA_IPS
    )


def _resolve_all(hostname: str) -> list[str]:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise UnsafeURLError(f"Cannot resolve host: {hostname}") from e
    return list({info[4][0] for info in infos})


def validate_safe_url(
    url: str,
    *,
    allowed_hosts: Optional[Iterable[str]] = None,
) -> str:
    """Return the URL if safe; raise UnsafeURLError otherwise.

    If allowed_hosts is provided, only those exact hostnames are accepted
    (strongest control — use for fixed integrations like Slack/Jira).
    """
    if not url or not isinstance(url, str):
        raise UnsafeURLError("URL must be a non-empty string")

    parsed = urlparse(url.strip())

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise UnsafeURLError(f"Disallowed scheme: {parsed.scheme!r}")

    host = (parsed.hostname or "").lower()
    if not host:
        raise UnsafeURLError("URL has no host")

    if host in _METADATA_HOSTS:
        raise UnsafeURLError("Cloud metadata host is blocked")

    if parsed.port is not None and parsed.port in _BLOCKED_PORTS:
        raise UnsafeURLError(f"Port {parsed.port} is blocked")

    if allowed_hosts is not None:
        allowed = {h.lower() for h in allowed_hosts}
        if host not in allowed and not any(
            host == a or host.endswith("." + a) for a in allowed
        ):
            raise UnsafeURLError(f"Host {host!r} is not in the allowlist")

    # Resolve hostname (or parse if literal IP) and reject private ranges.
    try:
        ip_literal = ipaddress.ip_address(host)
        ips = [str(ip_literal)]
    except ValueError:
        ips = _resolve_all(host)

    for ip_str in ips:
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            raise UnsafeURLError(f"Invalid resolved address: {ip_str}")
        if _is_disallowed_ip(ip):
            raise UnsafeURLError(
                f"Host {host!r} resolves to disallowed address {ip_str}"
            )

    return url


def safe_httpx_client(
    *,
    timeout: float = 10.0,
    **kwargs,
) -> httpx.AsyncClient:
    """httpx.AsyncClient with safe defaults for outbound calls.

    - follow_redirects disabled (callers must revalidate any redirect target)
    - explicit timeout
    - no environment proxies (avoid leaking via attacker-set $http_proxy)
    """
    kwargs.setdefault("follow_redirects", False)
    kwargs.setdefault("trust_env", False)
    return httpx.AsyncClient(timeout=timeout, **kwargs)


def safe_httpx_sync(timeout: float = 10.0, **kwargs) -> httpx.Client:
    kwargs.setdefault("follow_redirects", False)
    kwargs.setdefault("trust_env", False)
    return httpx.Client(timeout=timeout, **kwargs)


def safe_download(
    url: str,
    dest_path: str,
    *,
    max_bytes: int = 100 * 1024 * 1024,
    timeout: float = 30.0,
    allowed_hosts: Optional[Iterable[str]] = None,
) -> int:
    """Validate and stream-download a URL to disk with a hard size cap.

    Replaces urllib.request.urlretrieve, which performs no SSRF checks and
    silently follows redirects to private addresses.
    """
    validate_safe_url(url, allowed_hosts=allowed_hosts)

    written = 0
    with safe_httpx_sync(timeout=timeout) as client:
        with client.stream("GET", url) as resp:
            if resp.status_code in (301, 302, 303, 307, 308):
                raise UnsafeURLError(
                    f"Redirect to {resp.headers.get('location')!r} blocked"
                )
            resp.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in resp.iter_bytes():
                    written += len(chunk)
                    if written > max_bytes:
                        raise UnsafeURLError(
                            f"Response exceeds max size {max_bytes} bytes"
                        )
                    f.write(chunk)
    return written
