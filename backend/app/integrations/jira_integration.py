"""
Vault Sentry - Jira Integration
Issue creation and tracking for discovered secrets.
"""

import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
from loguru import logger
import base64

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False


class JiraPriority(str, Enum):
    """Jira priority levels"""
    HIGHEST = "1"
    HIGH = "2"
    MEDIUM = "3"
    LOW = "4"
    LOWEST = "5"


class JiraIssueType(str, Enum):
    """Common Jira issue types"""
    BUG = "Bug"
    TASK = "Task"
    SECURITY = "Security"
    STORY = "Story"


@dataclass
class JiraIssue:
    """Jira issue structure"""
    project_key: str
    summary: str
    description: str
    issue_type: JiraIssueType = JiraIssueType.BUG
    priority: JiraPriority = JiraPriority.HIGH
    labels: Optional[List[str]] = None
    assignee: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None


class JiraIntegration:
    """
    Jira integration for Vault Sentry.
    Creates issues, tracks remediation, and syncs status.
    """
    
    def __init__(
        self,
        base_url: str = None,
        username: str = None,
        api_token: str = None,
        project_key: str = None
    ):
        self.logger = logger.bind(module="jira_integration")
        
        self.base_url = (base_url or os.environ.get('JIRA_BASE_URL', '')).rstrip('/')
        self.username = username or os.environ.get('JIRA_USERNAME', '')
        self.api_token = api_token or os.environ.get('JIRA_API_TOKEN', '')
        self.project_key = project_key or os.environ.get('JIRA_PROJECT_KEY', 'SEC')
        
        # Prepare auth header
        if self.username and self.api_token:
            credentials = base64.b64encode(
                f'{self.username}:{self.api_token}'.encode()
            ).decode()
            self._auth_header = f'Basic {credentials}'
        else:
            self._auth_header = None
        
        if not HTTPX_AVAILABLE:
            self.logger.warning("httpx not installed. HTTP functionality limited.")
        
        # Cache for project metadata
        self._project_cache: Dict[str, Any] = {}
    
    @property
    def is_configured(self) -> bool:
        """Check if Jira is properly configured"""
        return bool(self.base_url and self._auth_header)
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None
    ) -> Dict[str, Any]:
        """Make authenticated request to Jira API"""
        if not self.is_configured:
            return {'error': 'Jira not configured'}
        
        url = f"{self.base_url}/rest/api/3/{endpoint}"
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers={
                    'Authorization': self._auth_header,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                }
            )
        
        if response.status_code >= 400:
            self.logger.error(f"Jira API error: {response.status_code} - {response.text}")
            return {
                'error': response.text,
                'status_code': response.status_code
            }
        
        if response.content:
            return response.json()
        return {'ok': True}
    
    async def create_issue(
        self,
        issue: JiraIssue
    ) -> Dict[str, Any]:
        """
        Create a Jira issue.
        
        Args:
            issue: JiraIssue with issue details
            
        Returns:
            Created issue details including key and URL
        """
        # Build issue payload
        fields = {
            'project': {'key': issue.project_key or self.project_key},
            'summary': issue.summary,
            'description': {
                'type': 'doc',
                'version': 1,
                'content': [
                    {
                        'type': 'paragraph',
                        'content': [
                            {
                                'type': 'text',
                                'text': issue.description
                            }
                        ]
                    }
                ]
            },
            'issuetype': {'name': issue.issue_type.value},
            'priority': {'id': issue.priority.value},
        }
        
        if issue.labels:
            fields['labels'] = issue.labels
        
        if issue.assignee:
            fields['assignee'] = {'accountId': issue.assignee}
        
        if issue.custom_fields:
            fields.update(issue.custom_fields)
        
        result = await self._request('POST', 'issue', data={'fields': fields})
        
        if 'key' in result:
            result['url'] = f"{self.base_url}/browse/{result['key']}"
            self.logger.info(f"Created Jira issue: {result['key']}")
        
        return result
    
    async def create_secret_issue(
        self,
        finding: Dict[str, Any],
        severity: str = 'high'
    ) -> Dict[str, Any]:
        """
        Create a Jira issue for a secret finding.
        
        Args:
            finding: Secret finding details
            severity: Alert severity (critical, high, medium, low)
            
        Returns:
            Created issue details
        """
        # Map severity to Jira priority
        priority_map = {
            'critical': JiraPriority.HIGHEST,
            'high': JiraPriority.HIGH,
            'medium': JiraPriority.MEDIUM,
            'low': JiraPriority.LOW,
        }
        priority = priority_map.get(severity.lower(), JiraPriority.MEDIUM)
        
        # Build summary
        summary = f"[Vault Sentry] {finding.get('secret_type', 'Secret')} found in {finding.get('repository', 'repository')}"
        
        # Build description
        description = self._build_issue_description(finding, severity)
        
        # Labels
        labels = [
            'security',
            'secret-sentry',
            finding.get('secret_type', 'unknown').lower().replace(' ', '-'),
            f'severity-{severity.lower()}'
        ]
        
        issue = JiraIssue(
            project_key=self.project_key,
            summary=summary,
            description=description,
            issue_type=JiraIssueType.BUG,
            priority=priority,
            labels=labels
        )
        
        result = await self.create_issue(issue)
        
        # Record issue link in database
        if 'key' in result:
            await self._link_issue_to_secret(
                finding.get('id'),
                result['key'],
                result.get('url', '')
            )
        
        return result
    
    def _build_issue_description(
        self,
        finding: Dict[str, Any],
        severity: str
    ) -> str:
        """Build formatted issue description"""
        lines = [
            f"*Secret Detection Alert*",
            "",
            f"*Type:* {finding.get('secret_type', 'Unknown')}",
            f"*Severity:* {severity.title()}",
            f"*Risk Score:* {finding.get('risk_score', 'N/A')}/100",
            "",
            "*Location:*",
            f"- Repository: {finding.get('repository', 'Unknown')}",
            f"- File: {finding.get('file_path', 'Unknown')}",
            f"- Line: {finding.get('line_number', 'Unknown')}",
            f"- Commit: {finding.get('commit_hash', 'HEAD')[:8]}",
            "",
            "*Context:*",
            f"```",
            finding.get('context', '(No context available)'),
            f"```",
            "",
            "*Detected:* " + datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC'),
            "",
            "*Remediation Steps:*",
            "1. Verify if this is a true positive",
            "2. If confirmed, revoke/rotate the secret immediately",
            "3. Update application configuration with new credentials",
            "4. Review git history for additional exposure",
            "5. Consider using a secrets manager",
            "",
            f"_Created by Vault Sentry_"
        ]
        
        return '\n'.join(lines)
    
    async def _link_issue_to_secret(
        self,
        secret_id: int,
        issue_key: str,
        issue_url: str
    ):
        """Link Jira issue to secret in database"""
        if not secret_id:
            return
        
        from app.core.database import SessionLocal
        from app.models.secret import Secret
        
        db = SessionLocal()
        try:
            secret = db.query(Secret).filter(Secret.id == secret_id).first()
            if secret:
                metadata = secret.meta_data or {}
                metadata['jira'] = {
                    'issue_key': issue_key,
                    'issue_url': issue_url,
                    'created_at': datetime.now(timezone.utc).isoformat()
                }
                secret.meta_data = metadata
                db.commit()
        finally:
            db.close()
    
    async def get_issue(
        self,
        issue_key: str
    ) -> Dict[str, Any]:
        """
        Get issue details.
        
        Args:
            issue_key: Jira issue key (e.g., SEC-123)
            
        Returns:
            Issue details
        """
        return await self._request('GET', f'issue/{issue_key}')
    
    async def update_issue(
        self,
        issue_key: str,
        fields: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update an issue.
        
        Args:
            issue_key: Jira issue key
            fields: Fields to update
            
        Returns:
            Update result
        """
        return await self._request('PUT', f'issue/{issue_key}', data={'fields': fields})
    
    async def transition_issue(
        self,
        issue_key: str,
        transition_name: str
    ) -> Dict[str, Any]:
        """
        Transition issue to new status.
        
        Args:
            issue_key: Jira issue key
            transition_name: Name of transition (e.g., 'Done', 'In Progress')
            
        Returns:
            Transition result
        """
        # Get available transitions
        transitions = await self._request('GET', f'issue/{issue_key}/transitions')
        
        if 'error' in transitions:
            return transitions
        
        # Find matching transition
        transition_id = None
        for t in transitions.get('transitions', []):
            if t['name'].lower() == transition_name.lower():
                transition_id = t['id']
                break
        
        if not transition_id:
            return {'error': f'Transition "{transition_name}" not found'}
        
        # Execute transition
        return await self._request(
            'POST',
            f'issue/{issue_key}/transitions',
            data={'transition': {'id': transition_id}}
        )
    
    async def add_comment(
        self,
        issue_key: str,
        comment: str
    ) -> Dict[str, Any]:
        """
        Add comment to issue.
        
        Args:
            issue_key: Jira issue key
            comment: Comment text
            
        Returns:
            Created comment details
        """
        return await self._request(
            'POST',
            f'issue/{issue_key}/comment',
            data={
                'body': {
                    'type': 'doc',
                    'version': 1,
                    'content': [
                        {
                            'type': 'paragraph',
                            'content': [
                                {
                                    'type': 'text',
                                    'text': comment
                                }
                            ]
                        }
                    ]
                }
            }
        )
    
    async def sync_secret_status(
        self,
        secret_id: int,
        issue_key: str
    ) -> Dict[str, Any]:
        """
        Sync secret status from Jira issue status.
        
        Args:
            secret_id: Secret ID in database
            issue_key: Jira issue key
            
        Returns:
            Sync result
        """
        # Get issue details
        issue = await self.get_issue(issue_key)
        
        if 'error' in issue:
            return issue
        
        status = issue.get('fields', {}).get('status', {}).get('name', '')
        
        from app.core.database import SessionLocal
        from app.models.secret import Secret, SecretStatus
        
        # Map Jira status to secret status
        status_map = {
            'done': SecretStatus.RESOLVED,
            'closed': SecretStatus.RESOLVED,
            'resolved': SecretStatus.RESOLVED,
            'in progress': SecretStatus.ACKNOWLEDGED,
            'to do': SecretStatus.OPEN,
            'open': SecretStatus.OPEN,
        }
        
        new_status = status_map.get(status.lower())
        
        if new_status:
            db = SessionLocal()
            try:
                secret = db.query(Secret).filter(Secret.id == secret_id).first()
                if secret:
                    secret.status = new_status.value
                    if new_status == SecretStatus.RESOLVED:
                        secret.resolved_at = datetime.now(timezone.utc)
                        secret.resolution_notes = f"Resolved via Jira {issue_key}"
                    db.commit()
                    
                    return {
                        'ok': True,
                        'secret_id': secret_id,
                        'new_status': new_status.value,
                        'jira_status': status
                    }
            finally:
                db.close()
        
        return {
            'ok': True,
            'secret_id': secret_id,
            'jira_status': status,
            'message': 'No status mapping found'
        }
    
    async def resolve_from_rotation(
        self,
        issue_key: str,
        rotation_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update Jira issue after secret rotation.
        
        Args:
            issue_key: Jira issue key
            rotation_result: Result from auto-rotation
            
        Returns:
            Update result
        """
        # Add comment about rotation
        comment = f"""
Secret auto-rotation completed:
- Status: {rotation_result.get('status', 'unknown')}
- Message: {rotation_result.get('message', '')}
- Completed: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}

{"The old credential has been deactivated and a new one has been generated." if rotation_result.get('status') == 'success' else "Manual intervention may be required."}
"""
        
        await self.add_comment(issue_key, comment)
        
        # Transition to resolved
        if rotation_result.get('status') == 'success':
            await self.transition_issue(issue_key, 'Done')
        
        return {'ok': True}
    
    async def search_issues(
        self,
        jql: str,
        max_results: int = 50
    ) -> Dict[str, Any]:
        """
        Search issues using JQL.
        
        Args:
            jql: JQL query string
            max_results: Maximum results to return
            
        Returns:
            Search results
        """
        return await self._request(
            'GET',
            'search',
            params={
                'jql': jql,
                'maxResults': max_results
            }
        )
    
    async def get_open_secret_issues(self) -> List[Dict[str, Any]]:
        """Get all open secret-sentry issues"""
        jql = f'project = {self.project_key} AND labels = secret-sentry AND status != Done AND status != Closed'
        result = await self.search_issues(jql)
        return result.get('issues', [])
    
    async def create_bulk_issues(
        self,
        findings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create issues for multiple findings.
        
        Args:
            findings: List of secret findings
            
        Returns:
            Results of bulk creation
        """
        results = {
            'created': [],
            'failed': []
        }
        
        for finding in findings:
            severity = finding.get('severity', 'medium')
            result = await self.create_secret_issue(finding, severity)
            
            if 'key' in result:
                results['created'].append({
                    'finding_id': finding.get('id'),
                    'issue_key': result['key'],
                    'issue_url': result.get('url', '')
                })
            else:
                results['failed'].append({
                    'finding_id': finding.get('id'),
                    'error': result.get('error', 'Unknown error')
                })
        
        return results
    
    async def get_project_metadata(
        self,
        project_key: str = None
    ) -> Dict[str, Any]:
        """
        Get project metadata including issue types and priorities.
        
        Args:
            project_key: Project key (defaults to configured project)
            
        Returns:
            Project metadata
        """
        key = project_key or self.project_key
        
        if key in self._project_cache:
            return self._project_cache[key]
        
        result = await self._request('GET', f'project/{key}')
        
        if 'error' not in result:
            self._project_cache[key] = result
        
        return result
