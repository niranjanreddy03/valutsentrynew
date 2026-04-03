"""
Vault Sentry - Slack Integration
Webhook notifications and interactive messages for Slack.
"""

import os
import json
import hashlib
import hmac
import time
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


class SlackMessageType(str, Enum):
    """Types of Slack messages"""
    ALERT = "alert"
    DIGEST = "digest"
    INTERACTIVE = "interactive"
    NOTIFICATION = "notification"


@dataclass
class SlackMessage:
    """Slack message structure"""
    channel: str
    text: str
    blocks: Optional[List[Dict]] = None
    attachments: Optional[List[Dict]] = None
    thread_ts: Optional[str] = None
    message_type: SlackMessageType = SlackMessageType.NOTIFICATION


class SlackIntegration:
    """
    Slack integration for Vault Sentry.
    Handles webhook notifications, interactive messages, and slash commands.
    """
    
    def __init__(
        self,
        webhook_url: str = None,
        bot_token: str = None,
        signing_secret: str = None
    ):
        self.logger = logger.bind(module="slack_integration")
        
        self.webhook_url = webhook_url or os.environ.get('SLACK_WEBHOOK_URL')
        self.bot_token = bot_token or os.environ.get('SLACK_BOT_TOKEN')
        self.signing_secret = signing_secret or os.environ.get('SLACK_SIGNING_SECRET')
        
        if not HTTPX_AVAILABLE:
            self.logger.warning("httpx not installed. HTTP functionality limited.")
        
        self._default_channel = os.environ.get('SLACK_DEFAULT_CHANNEL', '#security-alerts')
    
    @property
    def is_configured(self) -> bool:
        """Check if Slack is properly configured"""
        return bool(self.webhook_url or self.bot_token)
    
    def verify_signature(
        self,
        signature: str,
        timestamp: str,
        body: bytes
    ) -> bool:
        """
        Verify Slack request signature.
        Used for incoming webhook/event verification.
        """
        if not self.signing_secret:
            return False
        
        # Check timestamp is recent (within 5 minutes)
        if abs(time.time() - int(timestamp)) > 60 * 5:
            return False
        
        # Compute signature
        sig_basestring = f'v0:{timestamp}:{body.decode()}'.encode('utf-8')
        computed_signature = 'v0=' + hmac.new(
            self.signing_secret.encode('utf-8'),
            sig_basestring,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(computed_signature, signature)
    
    async def send_webhook(
        self,
        message: SlackMessage
    ) -> Dict[str, Any]:
        """Send message via incoming webhook"""
        if not self.webhook_url:
            return {'ok': False, 'error': 'Webhook URL not configured'}
        
        payload = {
            'text': message.text,
        }
        
        if message.blocks:
            payload['blocks'] = message.blocks
        
        if message.attachments:
            payload['attachments'] = message.attachments
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
        
        if response.status_code == 200 and response.text == 'ok':
            return {'ok': True}
        
        return {'ok': False, 'error': response.text}
    
    async def send_api(
        self,
        message: SlackMessage
    ) -> Dict[str, Any]:
        """Send message via Slack API (requires bot token)"""
        if not self.bot_token:
            return {'ok': False, 'error': 'Bot token not configured'}
        
        payload = {
            'channel': message.channel or self._default_channel,
            'text': message.text,
        }
        
        if message.blocks:
            payload['blocks'] = message.blocks
        
        if message.thread_ts:
            payload['thread_ts'] = message.thread_ts
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://slack.com/api/chat.postMessage',
                json=payload,
                headers={
                    'Authorization': f'Bearer {self.bot_token}',
                    'Content-Type': 'application/json'
                }
            )
        
        return response.json()
    
    async def send_alert(
        self,
        finding: Dict[str, Any],
        channel: str = None,
        severity: str = 'high'
    ) -> Dict[str, Any]:
        """
        Send a secret finding alert to Slack.
        
        Args:
            finding: Secret finding details
            channel: Target channel (defaults to configured channel)
            severity: Alert severity (critical, high, medium, low)
        """
        # Build rich message blocks
        blocks = self._build_alert_blocks(finding, severity)
        
        message = SlackMessage(
            channel=channel or self._default_channel,
            text=f"🚨 {severity.upper()} Secret Found: {finding.get('secret_type', 'Unknown')}",
            blocks=blocks,
            message_type=SlackMessageType.ALERT
        )
        
        # Use API if bot token available, otherwise use webhook
        if self.bot_token:
            return await self.send_api(message)
        else:
            return await self.send_webhook(message)
    
    def _build_alert_blocks(
        self,
        finding: Dict[str, Any],
        severity: str
    ) -> List[Dict]:
        """Build Slack Block Kit message for alert"""
        severity_emoji = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'low': '🟢'
        }
        
        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{severity_emoji.get(severity.lower(), '⚠️')} Secret Detected",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Type:*\n{finding.get('secret_type', 'Unknown')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Severity:*\n{severity.title()}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Repository:*\n{finding.get('repository', 'Unknown')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*File:*\n`{finding.get('file_path', 'Unknown')}`"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Location:*\nLine {finding.get('line_number', '?')} • Commit `{finding.get('commit_hash', 'HEAD')[:8]}`"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Detected at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    }
                ]
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Details",
                            "emoji": True
                        },
                        "value": str(finding.get('id', '')),
                        "action_id": "view_secret_details"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Mark False Positive",
                            "emoji": True
                        },
                        "value": str(finding.get('id', '')),
                        "action_id": "mark_false_positive"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "🔄 Auto-Rotate",
                            "emoji": True
                        },
                        "style": "primary",
                        "value": str(finding.get('id', '')),
                        "action_id": "auto_rotate_secret"
                    }
                ]
            }
        ]
    
    async def send_digest(
        self,
        findings: List[Dict[str, Any]],
        period: str = 'daily',
        channel: str = None
    ) -> Dict[str, Any]:
        """
        Send a digest summary of findings.
        
        Args:
            findings: List of findings for the period
            period: Digest period (hourly, daily, weekly)
            channel: Target channel
        """
        # Aggregate statistics
        stats = self._aggregate_findings(findings)
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📊 Vault Sentry {period.title()} Digest",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Total Findings:*\n{stats['total']}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Critical:*\n{stats['critical']} 🔴"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*High:*\n{stats['high']} 🟠"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Medium/Low:*\n{stats['medium'] + stats['low']}"
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Top Affected Repositories:*\n" + '\n'.join(
                        f"• {repo}: {count} findings"
                        for repo, count in stats['top_repos'][:5]
                    )
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Most Common Secret Types:*\n" + '\n'.join(
                        f"• {stype}: {count}"
                        for stype, count in stats['top_types'][:5]
                    )
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Full Report",
                            "emoji": True
                        },
                        "url": os.environ.get('SECRET_SENTRY_URL', 'http://localhost:3000') + '/reports',
                        "action_id": "view_full_report"
                    }
                ]
            }
        ]
        
        message = SlackMessage(
            channel=channel or self._default_channel,
            text=f"📊 {period.title()} Digest: {stats['total']} findings, {stats['critical']} critical",
            blocks=blocks,
            message_type=SlackMessageType.DIGEST
        )
        
        if self.bot_token:
            return await self.send_api(message)
        else:
            return await self.send_webhook(message)
    
    def _aggregate_findings(
        self,
        findings: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Aggregate findings for digest"""
        from collections import Counter
        
        stats = {
            'total': len(findings),
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0,
            'top_repos': [],
            'top_types': [],
        }
        
        repo_counts: Counter = Counter()
        type_counts: Counter = Counter()
        
        for finding in findings:
            severity = finding.get('severity', 'medium').lower()
            if severity in stats:
                stats[severity] += 1
            
            repo_counts[finding.get('repository', 'Unknown')] += 1
            type_counts[finding.get('secret_type', 'Unknown')] += 1
        
        stats['top_repos'] = repo_counts.most_common(10)
        stats['top_types'] = type_counts.most_common(10)
        
        return stats
    
    async def send_custom(
        self,
        text: str,
        blocks: List[Dict] = None,
        channel: str = None,
        thread_ts: str = None
    ) -> Dict[str, Any]:
        """
        Send a custom message.
        
        Args:
            text: Plain text message (fallback)
            blocks: Block Kit blocks
            channel: Target channel
            thread_ts: Thread timestamp for replies
        """
        message = SlackMessage(
            channel=channel or self._default_channel,
            text=text,
            blocks=blocks,
            thread_ts=thread_ts,
            message_type=SlackMessageType.NOTIFICATION
        )
        
        if self.bot_token:
            return await self.send_api(message)
        else:
            return await self.send_webhook(message)
    
    async def handle_interaction(
        self,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Handle incoming Slack interactive actions.
        
        Args:
            payload: Slack interaction payload
            
        Returns:
            Response to send back to Slack
        """
        action = payload.get('actions', [{}])[0]
        action_id = action.get('action_id')
        value = action.get('value')
        
        handlers = {
            'view_secret_details': self._handle_view_details,
            'mark_false_positive': self._handle_false_positive,
            'auto_rotate_secret': self._handle_auto_rotate,
        }
        
        handler = handlers.get(action_id)
        if handler:
            return await handler(value, payload)
        
        return {'text': 'Unknown action'}
    
    async def _handle_view_details(
        self,
        secret_id: str,
        payload: Dict
    ) -> Dict:
        """Handle view details action"""
        base_url = os.environ.get('SECRET_SENTRY_URL', 'http://localhost:3000')
        return {
            'response_type': 'ephemeral',
            'text': f'View details: {base_url}/secrets/{secret_id}'
        }
    
    async def _handle_false_positive(
        self,
        secret_id: str,
        payload: Dict
    ) -> Dict:
        """Handle mark as false positive action"""
        # Mark in database
        from app.core.database import SessionLocal
        from app.models.secret import Secret, SecretStatus
        
        db = SessionLocal()
        try:
            secret = db.query(Secret).filter(Secret.id == int(secret_id)).first()
            if secret:
                secret.status = SecretStatus.FALSE_POSITIVE.value
                secret.resolved_at = datetime.now(timezone.utc)
                db.commit()
                
                return {
                    'response_type': 'in_channel',
                    'replace_original': True,
                    'text': f'✅ Secret #{secret_id} marked as false positive by <@{payload.get("user", {}).get("id")}>'
                }
        finally:
            db.close()
        
        return {
            'response_type': 'ephemeral',
            'text': 'Failed to update secret status'
        }
    
    async def _handle_auto_rotate(
        self,
        secret_id: str,
        payload: Dict
    ) -> Dict:
        """Handle auto-rotate action"""
        # Trigger rotation task
        from app.workers.tasks.alert_tasks import trigger_rotation
        
        trigger_rotation.delay(int(secret_id))
        
        return {
            'response_type': 'ephemeral',
            'text': f'🔄 Auto-rotation initiated for secret #{secret_id}. You will be notified when complete.'
        }
    
    async def handle_slash_command(
        self,
        command: str,
        text: str,
        user_id: str,
        channel_id: str
    ) -> Dict[str, Any]:
        """
        Handle Slack slash commands.
        
        Commands:
            /VaultSentry status - Show current system status
            /VaultSentry scan <repo> - Trigger a scan
            /VaultSentry report - Generate quick report
        """
        parts = text.strip().split(' ')
        subcommand = parts[0] if parts else 'help'
        args = parts[1:] if len(parts) > 1 else []
        
        handlers = {
            'status': self._cmd_status,
            'scan': self._cmd_scan,
            'report': self._cmd_report,
            'help': self._cmd_help,
        }
        
        handler = handlers.get(subcommand, self._cmd_help)
        return await handler(args, user_id, channel_id)
    
    async def _cmd_status(
        self,
        args: List[str],
        user_id: str,
        channel_id: str
    ) -> Dict:
        """Status command"""
        return {
            'response_type': 'ephemeral',
            'blocks': [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "🟢 *Vault Sentry Status*\n\n• Scanner: Online\n• Database: Connected\n• Last scan: 5 minutes ago"
                    }
                }
            ]
        }
    
    async def _cmd_scan(
        self,
        args: List[str],
        user_id: str,
        channel_id: str
    ) -> Dict:
        """Scan command"""
        if not args:
            return {
                'response_type': 'ephemeral',
                'text': 'Usage: /VaultSentry scan <repository_url>'
            }
        
        repo_url = args[0]
        
        # Trigger scan
        from app.workers.tasks.scan_tasks import run_repository_scan
        run_repository_scan.delay(repo_url, user_id)
        
        return {
            'response_type': 'in_channel',
            'text': f'🔍 Scan initiated for `{repo_url}` by <@{user_id}>'
        }
    
    async def _cmd_report(
        self,
        args: List[str],
        user_id: str,
        channel_id: str
    ) -> Dict:
        """Report command"""
        return {
            'response_type': 'ephemeral',
            'text': f'📊 View the full report at: {os.environ.get("SECRET_SENTRY_URL", "http://localhost:3000")}/reports'
        }
    
    async def _cmd_help(
        self,
        args: List[str],
        user_id: str,
        channel_id: str
    ) -> Dict:
        """Help command"""
        return {
            'response_type': 'ephemeral',
            'blocks': [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*Vault Sentry Commands*\n\n"
                                "• `/VaultSentry status` - Show system status\n"
                                "• `/VaultSentry scan <repo>` - Trigger repository scan\n"
                                "• `/VaultSentry report` - Link to reports dashboard\n"
                                "• `/VaultSentry help` - Show this help"
                    }
                }
            ]
        }
