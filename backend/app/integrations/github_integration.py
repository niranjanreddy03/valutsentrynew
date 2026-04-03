"""
Vault Sentry - GitHub Integration
Repository scanning, PR comments, and webhook handling.
"""

import os
import hmac
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
from loguru import logger

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False


class GitHubEventType(str, Enum):
    """GitHub webhook event types"""
    PUSH = "push"
    PULL_REQUEST = "pull_request"
    PULL_REQUEST_REVIEW = "pull_request_review"
    CHECK_RUN = "check_run"
    CHECK_SUITE = "check_suite"
    INSTALLATION = "installation"
    REPOSITORY = "repository"


@dataclass
class PRComment:
    """Pull request comment structure"""
    body: str
    commit_id: Optional[str] = None
    path: Optional[str] = None
    line: Optional[int] = None
    side: str = "RIGHT"


class GitHubIntegration:
    """
    GitHub integration for Vault Sentry.
    Handles repository access, PR comments, checks, and webhooks.
    """
    
    API_BASE = "https://api.github.com"
    
    def __init__(
        self,
        token: str = None,
        app_id: str = None,
        private_key: str = None,
        webhook_secret: str = None
    ):
        self.logger = logger.bind(module="github_integration")
        
        self.token = token or os.environ.get('GITHUB_TOKEN')
        self.app_id = app_id or os.environ.get('GITHUB_APP_ID')
        self.private_key = private_key or os.environ.get('GITHUB_PRIVATE_KEY')
        self.webhook_secret = webhook_secret or os.environ.get('GITHUB_WEBHOOK_SECRET')
        
        if not HTTPX_AVAILABLE:
            self.logger.warning("httpx not installed. HTTP functionality limited.")
        
        # Cache for installation tokens
        self._installation_tokens: Dict[str, Dict] = {}
    
    @property
    def is_configured(self) -> bool:
        """Check if GitHub is properly configured"""
        return bool(self.token) or bool(self.app_id and self.private_key)
    
    def verify_webhook_signature(
        self,
        signature: str,
        body: bytes
    ) -> bool:
        """
        Verify GitHub webhook signature.
        
        Args:
            signature: X-Hub-Signature-256 header value
            body: Raw request body
            
        Returns:
            True if signature is valid
        """
        if not self.webhook_secret:
            return False
        
        if not signature.startswith('sha256='):
            return False
        
        expected = hmac.new(
            self.webhook_secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(f'sha256={expected}', signature)
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None,
        installation_id: int = None
    ) -> Dict[str, Any]:
        """Make authenticated request to GitHub API"""
        token = await self._get_token(installation_id)
        
        if not token:
            return {'error': 'GitHub not configured or token unavailable'}
        
        url = f"{self.API_BASE}/{endpoint.lstrip('/')}"
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/vnd.github.v3+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                }
            )
        
        if response.status_code >= 400:
            self.logger.error(f"GitHub API error: {response.status_code} - {response.text}")
            return {
                'error': response.text,
                'status_code': response.status_code
            }
        
        if response.content:
            return response.json()
        return {'ok': True}
    
    async def _get_token(
        self,
        installation_id: int = None
    ) -> Optional[str]:
        """Get access token (PAT or installation token)"""
        # If we have a PAT, use it
        if self.token:
            return self.token
        
        # If we have app credentials, get installation token
        if self.app_id and self.private_key and installation_id:
            return await self._get_installation_token(installation_id)
        
        return None
    
    async def _get_installation_token(
        self,
        installation_id: int
    ) -> Optional[str]:
        """Get GitHub App installation access token"""
        cache_key = str(installation_id)
        
        # Check cache
        if cache_key in self._installation_tokens:
            cached = self._installation_tokens[cache_key]
            if cached['expires_at'] > datetime.now(timezone.utc):
                return cached['token']
        
        # Generate JWT and get installation token
        try:
            import jwt
            
            now = int(datetime.now(timezone.utc).timestamp())
            payload = {
                'iat': now - 60,
                'exp': now + (10 * 60),
                'iss': self.app_id
            }
            
            jwt_token = jwt.encode(
                payload,
                self.private_key,
                algorithm='RS256'
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.API_BASE}/app/installations/{installation_id}/access_tokens",
                    headers={
                        'Authorization': f'Bearer {jwt_token}',
                        'Accept': 'application/vnd.github.v3+json',
                    }
                )
            
            if response.status_code == 201:
                data = response.json()
                self._installation_tokens[cache_key] = {
                    'token': data['token'],
                    'expires_at': datetime.fromisoformat(data['expires_at'].rstrip('Z')).replace(tzinfo=timezone.utc)
                }
                return data['token']
                
        except Exception as e:
            self.logger.error(f"Failed to get installation token: {e}")
        
        return None
    
    async def get_repository(
        self,
        owner: str,
        repo: str
    ) -> Dict[str, Any]:
        """
        Get repository information.
        
        Args:
            owner: Repository owner
            repo: Repository name
            
        Returns:
            Repository details
        """
        return await self._request('GET', f'repos/{owner}/{repo}')
    
    async def list_branches(
        self,
        owner: str,
        repo: str
    ) -> List[Dict[str, Any]]:
        """List repository branches"""
        result = await self._request('GET', f'repos/{owner}/{repo}/branches')
        if isinstance(result, list):
            return result
        return []
    
    async def get_file_contents(
        self,
        owner: str,
        repo: str,
        path: str,
        ref: str = None
    ) -> Dict[str, Any]:
        """
        Get file contents from repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
            path: File path
            ref: Git reference (branch, tag, commit)
            
        Returns:
            File contents (base64 encoded)
        """
        params = {}
        if ref:
            params['ref'] = ref
        
        return await self._request(
            'GET',
            f'repos/{owner}/{repo}/contents/{path}',
            params=params
        )
    
    async def create_pr_comment(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        comment: PRComment
    ) -> Dict[str, Any]:
        """
        Create a comment on a pull request.
        
        Args:
            owner: Repository owner
            repo: Repository name
            pull_number: PR number
            comment: Comment details
            
        Returns:
            Created comment
        """
        # For file-specific comments
        if comment.path and comment.commit_id:
            return await self._request(
                'POST',
                f'repos/{owner}/{repo}/pulls/{pull_number}/comments',
                data={
                    'body': comment.body,
                    'commit_id': comment.commit_id,
                    'path': comment.path,
                    'line': comment.line,
                    'side': comment.side,
                }
            )
        
        # For general PR comments
        return await self._request(
            'POST',
            f'repos/{owner}/{repo}/issues/{pull_number}/comments',
            data={'body': comment.body}
        )
    
    async def create_secret_alert_comment(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        findings: List[Dict[str, Any]],
        commit_sha: str = None
    ) -> Dict[str, Any]:
        """
        Create a PR comment summarizing secret findings.
        
        Args:
            owner: Repository owner
            repo: Repository name  
            pull_number: PR number
            findings: List of secret findings
            commit_sha: Commit SHA for inline comments
            
        Returns:
            Created comment details
        """
        if not findings:
            return {'ok': True, 'message': 'No findings to report'}
        
        # Build summary comment
        summary = self._build_pr_summary(findings)
        
        result = await self.create_pr_comment(
            owner,
            repo,
            pull_number,
            PRComment(body=summary)
        )
        
        # Create inline comments for each finding if commit SHA provided
        if commit_sha:
            for finding in findings[:10]:  # Limit inline comments
                inline_comment = self._build_inline_comment(finding)
                if finding.get('file_path') and finding.get('line_number'):
                    await self.create_pr_comment(
                        owner,
                        repo,
                        pull_number,
                        PRComment(
                            body=inline_comment,
                            commit_id=commit_sha,
                            path=finding['file_path'],
                            line=finding['line_number']
                        )
                    )
        
        return result
    
    def _build_pr_summary(
        self,
        findings: List[Dict[str, Any]]
    ) -> str:
        """Build PR summary markdown"""
        critical = sum(1 for f in findings if f.get('severity', '').lower() == 'critical')
        high = sum(1 for f in findings if f.get('severity', '').lower() == 'high')
        medium = sum(1 for f in findings if f.get('severity', '').lower() == 'medium')
        low = sum(1 for f in findings if f.get('severity', '').lower() == 'low')
        
        # Determine status
        if critical > 0:
            status = "🔴 **CRITICAL**"
            action = "This PR cannot be merged until critical secrets are removed."
        elif high > 0:
            status = "🟠 **HIGH**"
            action = "Please remove detected secrets before merging."
        elif medium > 0:
            status = "🟡 **MEDIUM**"
            action = "Consider addressing these findings before merging."
        else:
            status = "🟢 **LOW**"
            action = "Minor findings detected. Review recommended."
        
        lines = [
            "## 🔐 Vault Sentry Scan Results",
            "",
            f"**Status:** {status}",
            "",
            f"**Total findings:** {len(findings)}",
            f"- 🔴 Critical: {critical}",
            f"- 🟠 High: {high}",
            f"- 🟡 Medium: {medium}",
            f"- 🟢 Low: {low}",
            "",
            "### Detected Secrets",
            "",
            "| Type | File | Line | Severity |",
            "|------|------|------|----------|",
        ]
        
        for finding in findings[:20]:  # Limit table rows
            severity_icon = {
                'critical': '🔴',
                'high': '🟠',
                'medium': '🟡',
                'low': '🟢'
            }.get(finding.get('severity', '').lower(), '⚪')
            
            lines.append(
                f"| {finding.get('secret_type', 'Unknown')} | "
                f"`{finding.get('file_path', 'Unknown')}` | "
                f"{finding.get('line_number', '?')} | "
                f"{severity_icon} {finding.get('severity', 'Unknown').title()} |"
            )
        
        if len(findings) > 20:
            lines.append(f"| ... | *{len(findings) - 20} more findings* | | |")
        
        lines.extend([
            "",
            f"⚠️ **Action Required:** {action}",
            "",
            "---",
            "*Scan powered by [Vault Sentry](https://github.com/secret-sentry)*"
        ])
        
        return '\n'.join(lines)
    
    def _build_inline_comment(
        self,
        finding: Dict[str, Any]
    ) -> str:
        """Build inline comment for a finding"""
        severity_icon = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢'
        }.get(finding.get('severity', '').lower(), '⚠️')
        
        return f"""
{severity_icon} **Secret Detected: {finding.get('secret_type', 'Unknown')}**

| Attribute | Value |
|-----------|-------|
| Severity | {finding.get('severity', 'Unknown').title()} |
| Risk Score | {finding.get('risk_score', 'N/A')}/100 |
| Confidence | {finding.get('confidence', 'N/A')}% |

**Recommendation:** Remove this secret and use environment variables or a secrets manager.

---
*Vault Sentry*
"""
    
    async def create_check_run(
        self,
        owner: str,
        repo: str,
        head_sha: str,
        name: str = "Vault Sentry",
        status: str = "in_progress",
        conclusion: str = None,
        output: Dict = None,
        installation_id: int = None
    ) -> Dict[str, Any]:
        """
        Create a GitHub check run.
        
        Args:
            owner: Repository owner
            repo: Repository name
            head_sha: Commit SHA
            name: Check name
            status: Check status (queued, in_progress, completed)
            conclusion: Conclusion (success, failure, neutral, etc.)
            output: Check output (title, summary, annotations)
            installation_id: GitHub App installation ID
            
        Returns:
            Created check run
        """
        data = {
            'name': name,
            'head_sha': head_sha,
            'status': status,
        }
        
        if conclusion:
            data['conclusion'] = conclusion
        
        if output:
            data['output'] = output
        
        return await self._request(
            'POST',
            f'repos/{owner}/{repo}/check-runs',
            data=data,
            installation_id=installation_id
        )
    
    async def update_check_run(
        self,
        owner: str,
        repo: str,
        check_run_id: int,
        status: str = None,
        conclusion: str = None,
        output: Dict = None,
        installation_id: int = None
    ) -> Dict[str, Any]:
        """Update an existing check run"""
        data = {}
        
        if status:
            data['status'] = status
        if conclusion:
            data['conclusion'] = conclusion
        if output:
            data['output'] = output
        
        return await self._request(
            'PATCH',
            f'repos/{owner}/{repo}/check-runs/{check_run_id}',
            data=data,
            installation_id=installation_id
        )
    
    async def create_scan_check(
        self,
        owner: str,
        repo: str,
        head_sha: str,
        findings: List[Dict[str, Any]],
        installation_id: int = None
    ) -> Dict[str, Any]:
        """
        Create a check run with scan results.
        
        Args:
            owner: Repository owner
            repo: Repository name
            head_sha: Commit SHA
            findings: List of secret findings
            installation_id: GitHub App installation ID
            
        Returns:
            Created check run
        """
        # Determine conclusion
        critical = sum(1 for f in findings if f.get('severity', '').lower() == 'critical')
        high = sum(1 for f in findings if f.get('severity', '').lower() == 'high')
        
        if critical > 0:
            conclusion = 'failure'
        elif high > 0:
            conclusion = 'action_required'
        elif findings:
            conclusion = 'neutral'
        else:
            conclusion = 'success'
        
        # Build annotations
        annotations = []
        for finding in findings[:50]:  # GitHub limits to 50 annotations
            severity_level = {
                'critical': 'failure',
                'high': 'failure',
                'medium': 'warning',
                'low': 'notice'
            }.get(finding.get('severity', '').lower(), 'warning')
            
            if finding.get('file_path') and finding.get('line_number'):
                annotations.append({
                    'path': finding['file_path'],
                    'start_line': finding['line_number'],
                    'end_line': finding['line_number'],
                    'annotation_level': severity_level,
                    'title': f"Secret: {finding.get('secret_type', 'Unknown')}",
                    'message': f"Detected {finding.get('secret_type', 'secret')} with {finding.get('severity', 'unknown')} severity. Risk score: {finding.get('risk_score', 'N/A')}/100",
                })
        
        # Build summary
        summary_lines = [
            f"## Vault Sentry Scan Results",
            "",
            f"- **Total findings:** {len(findings)}",
            f"- **Critical:** {critical}",
            f"- **High:** {high}",
            f"- **Medium:** {sum(1 for f in findings if f.get('severity', '').lower() == 'medium')}",
            f"- **Low:** {sum(1 for f in findings if f.get('severity', '').lower() == 'low')}",
        ]
        
        if findings:
            summary_lines.extend([
                "",
                "### Top Findings",
                "",
            ])
            for finding in findings[:10]:
                summary_lines.append(
                    f"- **{finding.get('secret_type', 'Unknown')}** in `{finding.get('file_path', 'Unknown')}` (line {finding.get('line_number', '?')})"
                )
        
        output = {
            'title': f"Secret Scan: {len(findings)} finding(s)",
            'summary': '\n'.join(summary_lines),
            'annotations': annotations
        }
        
        return await self.create_check_run(
            owner=owner,
            repo=repo,
            head_sha=head_sha,
            status='completed',
            conclusion=conclusion,
            output=output,
            installation_id=installation_id
        )
    
    async def handle_webhook(
        self,
        event_type: str,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle incoming GitHub webhook.
        
        Args:
            event_type: X-GitHub-Event header value
            payload: Webhook payload
            
        Returns:
            Processing result
        """
        handlers = {
            'push': self._handle_push,
            'pull_request': self._handle_pull_request,
            'installation': self._handle_installation,
            'check_suite': self._handle_check_suite,
        }
        
        handler = handlers.get(event_type)
        if handler:
            return await handler(payload)
        
        return {'ok': True, 'message': f'Event {event_type} not handled'}
    
    async def _handle_push(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle push event - trigger scan"""
        repo = payload.get('repository', {})
        commits = payload.get('commits', [])
        
        if not commits:
            return {'ok': True, 'message': 'No commits to scan'}
        
        # Trigger scan for the pushed commits
        from app.workers.tasks.scan_tasks import run_repository_scan
        
        for commit in commits[:5]:  # Limit to last 5 commits
            run_repository_scan.delay(
                repo_url=repo.get('clone_url'),
                commit_sha=commit.get('id'),
                user_id=None
            )
        
        self.logger.info(f"Triggered scan for {len(commits)} commits in {repo.get('full_name')}")
        
        return {
            'ok': True,
            'message': f'Triggered scan for {len(commits)} commits'
        }
    
    async def _handle_pull_request(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle pull request event"""
        action = payload.get('action')
        pr = payload.get('pull_request', {})
        repo = payload.get('repository', {})
        
        if action not in ['opened', 'synchronize', 'reopened']:
            return {'ok': True, 'message': f'PR action {action} not scanned'}
        
        # Trigger PR scan
        from app.workers.tasks.scan_tasks import scan_pull_request
        
        scan_pull_request.delay(
            repo_owner=repo.get('owner', {}).get('login'),
            repo_name=repo.get('name'),
            pull_number=pr.get('number'),
            head_sha=pr.get('head', {}).get('sha')
        )
        
        self.logger.info(f"Triggered scan for PR #{pr.get('number')} in {repo.get('full_name')}")
        
        return {
            'ok': True,
            'message': f'Triggered scan for PR #{pr.get("number")}'
        }
    
    async def _handle_installation(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle GitHub App installation event"""
        action = payload.get('action')
        installation = payload.get('installation', {})
        
        if action == 'created':
            self.logger.info(f"New installation: {installation.get('id')}")
            # Could trigger initial scan of all repos
        elif action == 'deleted':
            self.logger.info(f"Installation removed: {installation.get('id')}")
            # Cleanup
        
        return {'ok': True, 'action': action}
    
    async def _handle_check_suite(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle check suite event"""
        action = payload.get('action')
        
        if action == 'requested':
            check_suite = payload.get('check_suite', {})
            repo = payload.get('repository', {})
            
            # Create check run
            await self.create_check_run(
                owner=repo.get('owner', {}).get('login'),
                repo=repo.get('name'),
                head_sha=check_suite.get('head_sha'),
                status='queued',
                installation_id=payload.get('installation', {}).get('id')
            )
        
        return {'ok': True, 'action': action}
    
    async def revoke_token(
        self,
        token: str
    ) -> Dict[str, Any]:
        """
        Revoke a GitHub access token.
        
        Args:
            token: Token to revoke
            
        Returns:
            Revocation result
        """
        # This requires client_id/client_secret auth
        client_id = os.environ.get('GITHUB_CLIENT_ID')
        client_secret = os.environ.get('GITHUB_CLIENT_SECRET')
        
        if not client_id or not client_secret:
            return {'error': 'GitHub OAuth credentials not configured'}
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f'{self.API_BASE}/applications/{client_id}/token',
                auth=(client_id, client_secret),
                json={'access_token': token},
                headers={'Accept': 'application/vnd.github.v3+json'}
            )
        
        if response.status_code == 204:
            return {'ok': True, 'message': 'Token revoked'}
        
        return {'error': response.text, 'status_code': response.status_code}
