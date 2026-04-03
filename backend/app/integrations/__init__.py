"""
Vault Sentry - Integrations Module
Auto-rotation hooks for AWS, Stripe, GitHub, etc.
"""

from app.integrations.auto_rotate import SecretRotator, RotationResult
from app.integrations.slack_integration import SlackIntegration
from app.integrations.jira_integration import JiraIntegration
from app.integrations.github_integration import GitHubIntegration
from app.integrations.aws_integration import AWSIntegration, AWSIntegrationResult

__all__ = [
    "SecretRotator",
    "RotationResult",
    "SlackIntegration",
    "JiraIntegration",
    "GitHubIntegration",
    "AWSIntegration",
    "AWSIntegrationResult",
]
