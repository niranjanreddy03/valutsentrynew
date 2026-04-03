"""
Vault Sentry - Alert Worker Tasks
Background tasks for notifications and alerting
"""

import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from celery import shared_task
from celery.utils.log import get_task_logger
import httpx

from app.core.config import settings

logger = get_task_logger(__name__)


@shared_task(name='app.workers.tasks.alert_tasks.create_alerts_for_findings')
def create_alerts_for_findings(
    scan_id: int,
    repository_id: int,
    critical_count: int
):
    """Create alert records and trigger notifications for critical findings"""
    from app.core.database import SessionLocal
    from app.models.alert import Alert, AlertType, AlertSeverity
    from app.models.secret import Secret
    from app.models.repository import Repository
    
    db = SessionLocal()
    try:
        # Get repository info
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            return {'error': 'Repository not found'}
        
        # Get critical findings for this scan
        findings = db.query(Secret).filter(
            Secret.scan_id == scan_id,
            Secret.risk_level == 'critical'
        ).all()
        
        alerts_created = []
        
        for finding in findings:
            # Create alert record
            alert = Alert(
                type=AlertType.SECRET_DETECTED.value,
                severity=AlertSeverity.CRITICAL.value,
                title=f"Critical {finding.type} detected",
                message=f"A critical {finding.type} was detected in {finding.file_path}:{finding.line_number}",
                repository_id=repository_id,
                scan_id=scan_id,
                secret_id=finding.id,
                metadata={
                    'file_path': finding.file_path,
                    'line_number': finding.line_number,
                    'secret_type': finding.type,
                    'risk_score': finding.risk_score,
                }
            )
            db.add(alert)
            alerts_created.append(alert)
        
        db.commit()
        
        # Trigger notifications
        for alert in alerts_created:
            # Send Slack notification
            if settings.SLACK_WEBHOOK_URL:
                send_slack_alert.delay(
                    alert_id=alert.id,
                    title=alert.title,
                    message=alert.message,
                    severity=alert.severity,
                    repository_name=repo.name
                )
            
            # Send email notification
            if settings.SMTP_HOST:
                send_email_alert.delay(
                    alert_id=alert.id,
                    title=alert.title,
                    message=alert.message,
                    severity=alert.severity,
                    repository_name=repo.name
                )
        
        return {
            'scan_id': scan_id,
            'alerts_created': len(alerts_created)
        }
        
    finally:
        db.close()


@shared_task(
    name='app.workers.tasks.alert_tasks.send_slack_alert',
    rate_limit='30/m',
    max_retries=3
)
def send_slack_alert(
    alert_id: int,
    title: str,
    message: str,
    severity: str,
    repository_name: str,
    channel: str = None
):
    """Send alert to Slack"""
    webhook_url = settings.SLACK_WEBHOOK_URL
    
    if not webhook_url:
        logger.warning("Slack webhook URL not configured")
        return {'status': 'skipped', 'reason': 'no_webhook'}
    
    # Color based on severity
    colors = {
        'critical': '#FF0000',
        'high': '#FF6600',
        'medium': '#FFCC00',
        'low': '#00CC00',
    }
    
    # Slack attachment format
    payload = {
        'channel': channel,
        'username': 'Vault Sentry',
        'icon_emoji': ':shield:',
        'attachments': [
            {
                'color': colors.get(severity, '#808080'),
                'title': f':warning: {title}',
                'text': message,
                'fields': [
                    {
                        'title': 'Repository',
                        'value': repository_name,
                        'short': True
                    },
                    {
                        'title': 'Severity',
                        'value': severity.upper(),
                        'short': True
                    },
                    {
                        'title': 'Alert ID',
                        'value': str(alert_id),
                        'short': True
                    },
                    {
                        'title': 'Detected At',
                        'value': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
                        'short': True
                    }
                ],
                'footer': 'Vault Sentry',
                'footer_icon': 'https://VaultSentry.io/icon.png',
                'ts': int(datetime.now().timestamp())
            }
        ]
    }
    
    try:
        response = httpx.post(
            webhook_url,
            json=payload,
            timeout=10.0
        )
        response.raise_for_status()
        
        _update_alert_notification(alert_id, 'slack', 'sent')
        logger.info(f"Slack alert sent for alert {alert_id}")
        
        return {'status': 'sent', 'alert_id': alert_id}
        
    except Exception as e:
        logger.error(f"Failed to send Slack alert: {e}")
        _update_alert_notification(alert_id, 'slack', 'failed', str(e))
        raise


@shared_task(
    name='app.workers.tasks.alert_tasks.send_email_alert',
    rate_limit='10/m',
    max_retries=3
)
def send_email_alert(
    alert_id: int,
    title: str,
    message: str,
    severity: str,
    repository_name: str,
    recipients: List[str] = None
):
    """Send alert via email"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    if not settings.SMTP_HOST:
        logger.warning("SMTP not configured")
        return {'status': 'skipped', 'reason': 'no_smtp'}
    
    # Get recipients (from settings or database)
    if not recipients:
        recipients = _get_alert_recipients(alert_id)
    
    if not recipients:
        return {'status': 'skipped', 'reason': 'no_recipients'}
    
    # Create email
    msg = MIMEMultipart('alternative')
    msg['Subject'] = f'[Vault Sentry] {severity.upper()}: {title}'
    msg['From'] = settings.EMAIL_FROM
    msg['To'] = ', '.join(recipients)
    
    # HTML body
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            .alert-box {{ 
                padding: 20px; 
                border-radius: 8px;
                border-left: 4px solid {'#FF0000' if severity == 'critical' else '#FF6600'};
                background: #f8f8f8;
            }}
            .severity {{ 
                color: {'#FF0000' if severity == 'critical' else '#FF6600'};
                font-weight: bold;
                text-transform: uppercase;
            }}
            .metadata {{ color: #666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="alert-box">
            <h2>🛡️ Vault Sentry Alert</h2>
            <p class="severity">{severity} Severity</p>
            <h3>{title}</h3>
            <p>{message}</p>
            <div class="metadata">
                <p><strong>Repository:</strong> {repository_name}</p>
                <p><strong>Alert ID:</strong> {alert_id}</p>
                <p><strong>Time:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p>
            </div>
            <p>
                <a href="http://localhost:3000/alerts/{alert_id}">View Alert Details</a>
            </p>
        </div>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(html, 'html'))
    
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, recipients, msg.as_string())
        
        _update_alert_notification(alert_id, 'email', 'sent')
        logger.info(f"Email alert sent for alert {alert_id}")
        
        return {'status': 'sent', 'alert_id': alert_id, 'recipients': recipients}
        
    except Exception as e:
        logger.error(f"Failed to send email alert: {e}")
        _update_alert_notification(alert_id, 'email', 'failed', str(e))
        raise


@shared_task(name='app.workers.tasks.alert_tasks.send_webhook_notification')
def send_webhook_notification(
    alert_id: int,
    webhook_url: str,
    payload: Dict[str, Any]
):
    """Send alert to custom webhook"""
    try:
        response = httpx.post(
            webhook_url,
            json=payload,
            timeout=30.0,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        
        _update_alert_notification(alert_id, 'webhook', 'sent')
        return {'status': 'sent', 'alert_id': alert_id}
        
    except Exception as e:
        logger.error(f"Webhook notification failed: {e}")
        _update_alert_notification(alert_id, 'webhook', 'failed', str(e))
        raise


@shared_task(name='app.workers.tasks.alert_tasks.create_jira_issue')
def create_jira_issue(
    alert_id: int,
    project_key: str,
    issue_type: str = 'Bug',
    priority: str = 'High',
    assignee: str = None,
    labels: List[str] = None
):
    """Create JIRA issue for alert"""
    from app.core.database import SessionLocal
    from app.models.alert import Alert
    
    # Get JIRA settings (would come from integration settings)
    jira_url = os.environ.get('JIRA_URL')
    jira_user = os.environ.get('JIRA_USER')
    jira_token = os.environ.get('JIRA_API_TOKEN')
    
    if not all([jira_url, jira_user, jira_token]):
        return {'status': 'skipped', 'reason': 'jira_not_configured'}
    
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return {'status': 'error', 'reason': 'alert_not_found'}
        
        # Create JIRA issue
        payload = {
            'fields': {
                'project': {'key': project_key},
                'summary': f'[Security] {alert.title}',
                'description': {
                    'type': 'doc',
                    'version': 1,
                    'content': [
                        {
                            'type': 'paragraph',
                            'content': [
                                {'type': 'text', 'text': alert.message}
                            ]
                        },
                        {
                            'type': 'paragraph',
                            'content': [
                                {'type': 'text', 'text': f'Alert ID: {alert_id}'},
                            ]
                        }
                    ]
                },
                'issuetype': {'name': issue_type},
                'priority': {'name': priority},
                'labels': labels or ['security', 'secret-sentry'],
            }
        }
        
        if assignee:
            payload['fields']['assignee'] = {'name': assignee}
        
        response = httpx.post(
            f'{jira_url}/rest/api/3/issue',
            json=payload,
            auth=(jira_user, jira_token),
            timeout=30.0
        )
        response.raise_for_status()
        
        issue_data = response.json()
        issue_key = issue_data.get('key')
        
        # Update alert with JIRA link
        alert.jira_issue_key = issue_key
        alert.jira_issue_url = f'{jira_url}/browse/{issue_key}'
        db.commit()
        
        logger.info(f"JIRA issue {issue_key} created for alert {alert_id}")
        
        return {
            'status': 'created',
            'issue_key': issue_key,
            'alert_id': alert_id
        }
        
    except Exception as e:
        logger.error(f"Failed to create JIRA issue: {e}")
        raise
    finally:
        db.close()


@shared_task(name='app.workers.tasks.alert_tasks.create_github_pr_comment')
def create_github_pr_comment(
    repository_full_name: str,
    pr_number: int,
    findings_summary: Dict[str, Any]
):
    """Create PR comment with findings summary"""
    github_token = settings.GITHUB_CLIENT_SECRET
    
    if not github_token:
        return {'status': 'skipped', 'reason': 'github_not_configured'}
    
    # Generate comment body
    body = _generate_pr_comment_body(findings_summary)
    
    try:
        response = httpx.post(
            f'https://api.github.com/repos/{repository_full_name}/issues/{pr_number}/comments',
            json={'body': body},
            headers={
                'Authorization': f'token {github_token}',
                'Accept': 'application/vnd.github.v3+json'
            },
            timeout=30.0
        )
        response.raise_for_status()
        
        return {
            'status': 'created',
            'pr_number': pr_number,
            'comment_id': response.json().get('id')
        }
        
    except Exception as e:
        logger.error(f"Failed to create PR comment: {e}")
        raise


# Helper functions
def _update_alert_notification(alert_id: int, channel: str, status: str, error: str = None):
    """Update alert notification status"""
    from app.core.database import SessionLocal
    from app.models.alert import Alert
    
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if alert:
            notifications = alert.notifications or {}
            notifications[channel] = {
                'status': status,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'error': error
            }
            alert.notifications = notifications
            db.commit()
    finally:
        db.close()


def _get_alert_recipients(alert_id: int) -> List[str]:
    """Get email recipients for an alert"""
    from app.core.database import SessionLocal
    from app.models.alert import Alert
    from app.models.user import User
    
    db = SessionLocal()
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return []
        
        # Get admins and security team
        users = db.query(User).filter(
            User.role.in_(['admin', 'security']),
            User.email_notifications == True
        ).all()
        
        return [u.email for u in users if u.email]
    finally:
        db.close()


def _generate_pr_comment_body(findings: Dict[str, Any]) -> str:
    """Generate formatted PR comment body"""
    total = findings.get('total', 0)
    critical = findings.get('critical', 0)
    high = findings.get('high', 0)
    
    # Status emoji
    if critical > 0:
        status = '🚨 **BLOCKED** - Critical secrets detected!'
    elif high > 0:
        status = '⚠️ **WARNING** - High severity secrets detected'
    elif total > 0:
        status = '⚡ **NEEDS REVIEW** - Potential secrets detected'
    else:
        status = '✅ **PASSED** - No secrets detected'
    
    body = f"""
## 🛡️ Vault Sentry Scan Results

{status}

### Summary
| Severity | Count |
|----------|-------|
| 🔴 Critical | {critical} |
| 🟠 High | {high} |
| 🟡 Medium | {findings.get('medium', 0)} |
| 🟢 Low | {findings.get('low', 0)} |
| **Total** | **{total}** |

---
<details>
<summary>📋 View Details</summary>

{_format_findings_list(findings.get('details', []))}

</details>

---
*Powered by [Vault Sentry](https://VaultSentry.io)*
"""
    return body


def _format_findings_list(details: List[Dict]) -> str:
    """Format findings list for PR comment"""
    if not details:
        return "No findings to display."
    
    lines = []
    for f in details[:10]:  # Limit to 10
        lines.append(f"- **{f.get('type')}** in `{f.get('file_path')}:{f.get('line_number')}` - {f.get('severity')}")
    
    if len(details) > 10:
        lines.append(f"\n*...and {len(details) - 10} more*")
    
    return '\n'.join(lines)


import os  # Import at top level
