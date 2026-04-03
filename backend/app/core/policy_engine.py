"""
Vault Sentry - Policy Engine
Rule-based policy enforcement for secret detection and remediation.
"""

import os
import re
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger
from pathlib import Path


class PolicyAction(str, Enum):
    """Actions that can be taken when a policy matches"""
    ALLOW = "allow"
    DENY = "deny"
    WARN = "warn"
    NOTIFY = "notify"
    REQUIRE_APPROVAL = "require_approval"
    AUTO_ROTATE = "auto_rotate"
    CREATE_TICKET = "create_ticket"
    BLOCK_PR = "block_pr"
    QUARANTINE = "quarantine"


class PolicySeverity(str, Enum):
    """Policy severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class PolicyCondition:
    """A condition for policy evaluation"""
    field: str  # Field to check (e.g., 'secret_type', 'repository', 'risk_score')
    operator: str  # Comparison operator ('equals', 'contains', 'gt', 'lt', 'regex', 'in')
    value: Any  # Value to compare against
    
    def evaluate(self, context: Dict[str, Any]) -> bool:
        """Evaluate this condition against a context"""
        field_value = context.get(self.field)
        
        if field_value is None:
            return False
        
        if self.operator == 'equals':
            return field_value == self.value
        elif self.operator == 'not_equals':
            return field_value != self.value
        elif self.operator == 'contains':
            return self.value in str(field_value)
        elif self.operator == 'not_contains':
            return self.value not in str(field_value)
        elif self.operator == 'gt':
            return float(field_value) > float(self.value)
        elif self.operator == 'gte':
            return float(field_value) >= float(self.value)
        elif self.operator == 'lt':
            return float(field_value) < float(self.value)
        elif self.operator == 'lte':
            return float(field_value) <= float(self.value)
        elif self.operator == 'regex':
            return bool(re.search(self.value, str(field_value)))
        elif self.operator == 'in':
            return field_value in self.value
        elif self.operator == 'not_in':
            return field_value not in self.value
        elif self.operator == 'starts_with':
            return str(field_value).startswith(self.value)
        elif self.operator == 'ends_with':
            return str(field_value).endswith(self.value)
        
        return False


@dataclass
class Policy:
    """A policy rule"""
    id: str
    name: str
    description: str
    enabled: bool = True
    priority: int = 100  # Lower = higher priority
    conditions: List[PolicyCondition] = field(default_factory=list)
    actions: List[PolicyAction] = field(default_factory=list)
    action_params: Dict[str, Any] = field(default_factory=dict)
    severity: PolicySeverity = PolicySeverity.MEDIUM
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def matches(self, context: Dict[str, Any]) -> bool:
        """Check if all conditions match"""
        if not self.enabled:
            return False
        
        return all(cond.evaluate(context) for cond in self.conditions)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert policy to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'enabled': self.enabled,
            'priority': self.priority,
            'conditions': [
                {'field': c.field, 'operator': c.operator, 'value': c.value}
                for c in self.conditions
            ],
            'actions': [a.value for a in self.actions],
            'action_params': self.action_params,
            'severity': self.severity.value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'tags': self.tags,
            'metadata': self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Policy':
        """Create policy from dictionary"""
        conditions = [
            PolicyCondition(
                field=c['field'],
                operator=c['operator'],
                value=c['value']
            )
            for c in data.get('conditions', [])
        ]
        
        actions = [PolicyAction(a) for a in data.get('actions', [])]
        
        return cls(
            id=data['id'],
            name=data['name'],
            description=data.get('description', ''),
            enabled=data.get('enabled', True),
            priority=data.get('priority', 100),
            conditions=conditions,
            actions=actions,
            action_params=data.get('action_params', {}),
            severity=PolicySeverity(data.get('severity', 'medium')),
            created_by=data.get('created_by'),
            tags=data.get('tags', []),
            metadata=data.get('metadata', {}),
        )


@dataclass
class PolicyEvaluationResult:
    """Result of policy evaluation"""
    policy_id: str
    policy_name: str
    matched: bool
    actions: List[PolicyAction]
    action_params: Dict[str, Any]
    severity: PolicySeverity
    message: str = ""


class PolicyEngine:
    """
    Policy engine for Vault Sentry.
    Evaluates findings against policies and determines actions.
    """
    
    def __init__(self):
        self.logger = logger.bind(module="policy_engine")
        self.policies: Dict[str, Policy] = {}
        self._action_handlers: Dict[PolicyAction, Callable] = {}
        
        # Load default policies
        self._load_default_policies()
    
    def _load_default_policies(self):
        """Load built-in default policies"""
        default_policies = [
            # Critical secrets - auto-rotate and notify
            Policy(
                id="default-critical-secrets",
                name="Critical Secrets Auto-Response",
                description="Auto-rotate and create tickets for critical secrets (AWS, production keys)",
                priority=10,
                conditions=[
                    PolicyCondition('risk_score', 'gte', 85),
                    PolicyCondition('environment', 'equals', 'production')
                ],
                actions=[PolicyAction.AUTO_ROTATE, PolicyAction.CREATE_TICKET, PolicyAction.NOTIFY],
                action_params={
                    'notify_channels': ['slack', 'email'],
                    'ticket_priority': 'highest',
                },
                severity=PolicySeverity.CRITICAL,
                tags=['critical', 'auto-remediation']
            ),
            
            # AWS Keys - always high priority
            Policy(
                id="default-aws-keys",
                name="AWS Credentials Policy",
                description="AWS keys require immediate attention",
                priority=20,
                conditions=[
                    PolicyCondition('secret_type', 'in', ['aws_access_key', 'aws_secret_key', 'aws'])
                ],
                actions=[PolicyAction.NOTIFY, PolicyAction.CREATE_TICKET, PolicyAction.BLOCK_PR],
                action_params={
                    'ticket_priority': 'high',
                },
                severity=PolicySeverity.HIGH,
                tags=['aws', 'cloud']
            ),
            
            # Database credentials
            Policy(
                id="default-database-creds",
                name="Database Credentials Policy",
                description="Database credentials in code require review",
                priority=30,
                conditions=[
                    PolicyCondition('secret_type', 'in', ['database_url', 'postgres', 'mysql', 'mongodb'])
                ],
                actions=[PolicyAction.NOTIFY, PolicyAction.BLOCK_PR],
                severity=PolicySeverity.HIGH,
                tags=['database']
            ),
            
            # API Keys in production repos
            Policy(
                id="default-prod-api-keys",
                name="Production API Keys",
                description="API keys in production repositories",
                priority=40,
                conditions=[
                    PolicyCondition('repository', 'contains', 'prod'),
                    PolicyCondition('secret_type', 'contains', 'api_key')
                ],
                actions=[PolicyAction.CREATE_TICKET, PolicyAction.NOTIFY],
                severity=PolicySeverity.HIGH,
                tags=['production', 'api']
            ),
            
            # Test/mock secrets - allow
            Policy(
                id="default-test-secrets",
                name="Test/Mock Secrets",
                description="Allow test and mock secrets in test directories",
                priority=5,
                conditions=[
                    PolicyCondition('file_path', 'regex', r'(test|spec|mock|fixture|__test__|__spec__)'),
                ],
                actions=[PolicyAction.WARN],
                severity=PolicySeverity.INFO,
                tags=['test', 'allow']
            ),
            
            # Old secrets requiring rotation
            Policy(
                id="default-old-secrets",
                name="Aging Secrets Policy",
                description="Secrets older than 90 days should be rotated",
                priority=60,
                conditions=[
                    PolicyCondition('days_old', 'gt', 90)
                ],
                actions=[PolicyAction.NOTIFY, PolicyAction.WARN],
                action_params={
                    'message': 'Secret is over 90 days old and should be rotated',
                },
                severity=PolicySeverity.MEDIUM,
                tags=['rotation', 'hygiene']
            ),
            
            # High entropy values (likely real secrets)
            Policy(
                id="default-high-entropy",
                name="High Entropy Secrets",
                description="High entropy values are likely real secrets",
                priority=50,
                conditions=[
                    PolicyCondition('entropy', 'gt', 4.5),
                    PolicyCondition('confidence', 'gte', 80)
                ],
                actions=[PolicyAction.BLOCK_PR, PolicyAction.NOTIFY],
                severity=PolicySeverity.HIGH,
                tags=['entropy', 'high-confidence']
            ),
        ]
        
        for policy in default_policies:
            self.policies[policy.id] = policy
    
    def add_policy(self, policy: Policy) -> None:
        """Add a policy to the engine"""
        self.policies[policy.id] = policy
        self.logger.info(f"Added policy: {policy.name} ({policy.id})")
    
    def remove_policy(self, policy_id: str) -> bool:
        """Remove a policy from the engine"""
        if policy_id in self.policies:
            del self.policies[policy_id]
            self.logger.info(f"Removed policy: {policy_id}")
            return True
        return False
    
    def get_policy(self, policy_id: str) -> Optional[Policy]:
        """Get a policy by ID"""
        return self.policies.get(policy_id)
    
    def list_policies(
        self,
        enabled_only: bool = False,
        tags: List[str] = None
    ) -> List[Policy]:
        """List all policies"""
        policies = list(self.policies.values())
        
        if enabled_only:
            policies = [p for p in policies if p.enabled]
        
        if tags:
            policies = [p for p in policies if any(t in p.tags for t in tags)]
        
        return sorted(policies, key=lambda p: p.priority)
    
    def evaluate(
        self,
        finding: Dict[str, Any]
    ) -> List[PolicyEvaluationResult]:
        """
        Evaluate a finding against all policies.
        
        Args:
            finding: Secret finding to evaluate
            
        Returns:
            List of matching policy results
        """
        results = []
        
        # Sort policies by priority
        sorted_policies = sorted(
            self.policies.values(),
            key=lambda p: p.priority
        )
        
        for policy in sorted_policies:
            if not policy.enabled:
                continue
            
            matched = policy.matches(finding)
            
            if matched:
                results.append(PolicyEvaluationResult(
                    policy_id=policy.id,
                    policy_name=policy.name,
                    matched=True,
                    actions=policy.actions,
                    action_params=policy.action_params,
                    severity=policy.severity,
                    message=policy.description
                ))
        
        return results
    
    def get_required_actions(
        self,
        finding: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Get all required actions for a finding.
        
        Args:
            finding: Secret finding to evaluate
            
        Returns:
            Dictionary with actions and their parameters
        """
        results = self.evaluate(finding)
        
        # Aggregate actions from all matching policies
        actions = {
            'block_pr': False,
            'auto_rotate': False,
            'create_ticket': False,
            'notify': False,
            'quarantine': False,
            'require_approval': False,
            'highest_severity': PolicySeverity.INFO,
            'matching_policies': [],
            'notifications': [],
            'ticket_params': {},
        }
        
        for result in results:
            actions['matching_policies'].append({
                'id': result.policy_id,
                'name': result.policy_name,
                'severity': result.severity.value,
            })
            
            # Update highest severity
            severity_order = [PolicySeverity.INFO, PolicySeverity.LOW, PolicySeverity.MEDIUM, 
                           PolicySeverity.HIGH, PolicySeverity.CRITICAL]
            if severity_order.index(result.severity) > severity_order.index(actions['highest_severity']):
                actions['highest_severity'] = result.severity
            
            # Process actions
            for action in result.actions:
                if action == PolicyAction.BLOCK_PR:
                    actions['block_pr'] = True
                elif action == PolicyAction.AUTO_ROTATE:
                    actions['auto_rotate'] = True
                elif action == PolicyAction.CREATE_TICKET:
                    actions['create_ticket'] = True
                    actions['ticket_params'].update(result.action_params)
                elif action == PolicyAction.NOTIFY:
                    actions['notify'] = True
                    channels = result.action_params.get('notify_channels', ['slack'])
                    actions['notifications'].extend(channels)
                elif action == PolicyAction.QUARANTINE:
                    actions['quarantine'] = True
                elif action == PolicyAction.REQUIRE_APPROVAL:
                    actions['require_approval'] = True
        
        # Deduplicate notifications
        actions['notifications'] = list(set(actions['notifications']))
        actions['highest_severity'] = actions['highest_severity'].value
        
        return actions
    
    async def execute_actions(
        self,
        finding: Dict[str, Any],
        actions: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute the required actions for a finding.
        
        Args:
            finding: Secret finding
            actions: Actions to execute
            
        Returns:
            Execution results
        """
        results = {
            'executed': [],
            'failed': [],
        }
        
        # Block PR (handled by caller)
        if actions.get('block_pr'):
            results['executed'].append({
                'action': 'block_pr',
                'status': 'flagged'
            })
        
        # Auto-rotate
        if actions.get('auto_rotate'):
            try:
                from app.integrations.auto_rotate import SecretRotator
                rotator = SecretRotator()
                
                if rotator.can_auto_rotate(finding.get('secret_type', '')):
                    rotation_task = self._action_handlers.get(PolicyAction.AUTO_ROTATE)
                    if rotation_task:
                        await rotation_task(finding)
                        results['executed'].append({
                            'action': 'auto_rotate',
                            'status': 'initiated'
                        })
            except Exception as e:
                results['failed'].append({
                    'action': 'auto_rotate',
                    'error': str(e)
                })
        
        # Create ticket
        if actions.get('create_ticket'):
            try:
                from app.integrations.jira_integration import JiraIntegration
                jira = JiraIntegration()
                
                if jira.is_configured:
                    result = await jira.create_secret_issue(
                        finding,
                        severity=actions.get('highest_severity', 'medium')
                    )
                    results['executed'].append({
                        'action': 'create_ticket',
                        'status': 'created',
                        'ticket_key': result.get('key')
                    })
            except Exception as e:
                results['failed'].append({
                    'action': 'create_ticket',
                    'error': str(e)
                })
        
        # Notify
        if actions.get('notify'):
            for channel in actions.get('notifications', []):
                try:
                    if channel == 'slack':
                        from app.integrations.slack_integration import SlackIntegration
                        slack = SlackIntegration()
                        if slack.is_configured:
                            await slack.send_alert(
                                finding,
                                severity=actions.get('highest_severity', 'medium')
                            )
                            results['executed'].append({
                                'action': f'notify_{channel}',
                                'status': 'sent'
                            })
                    elif channel == 'email':
                        # Email notification would go here
                        results['executed'].append({
                            'action': f'notify_{channel}',
                            'status': 'queued'
                        })
                except Exception as e:
                    results['failed'].append({
                        'action': f'notify_{channel}',
                        'error': str(e)
                    })
        
        return results
    
    def register_action_handler(
        self,
        action: PolicyAction,
        handler: Callable
    ):
        """Register a handler function for an action"""
        self._action_handlers[action] = handler
    
    def load_policies_from_file(
        self,
        file_path: str
    ) -> int:
        """
        Load policies from a JSON file.
        
        Args:
            file_path: Path to JSON file
            
        Returns:
            Number of policies loaded
        """
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            count = 0
            for policy_data in data.get('policies', []):
                policy = Policy.from_dict(policy_data)
                self.add_policy(policy)
                count += 1
            
            self.logger.info(f"Loaded {count} policies from {file_path}")
            return count
        except Exception as e:
            self.logger.error(f"Failed to load policies: {e}")
            return 0
    
    def save_policies_to_file(
        self,
        file_path: str
    ) -> bool:
        """
        Save policies to a JSON file.
        
        Args:
            file_path: Path to save JSON file
            
        Returns:
            True if saved successfully
        """
        try:
            data = {
                'version': '1.0',
                'exported_at': datetime.now(timezone.utc).isoformat(),
                'policies': [p.to_dict() for p in self.policies.values()]
            }
            
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            self.logger.info(f"Saved {len(self.policies)} policies to {file_path}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to save policies: {e}")
            return False
    
    def validate_policy(
        self,
        policy: Policy
    ) -> List[str]:
        """
        Validate a policy.
        
        Args:
            policy: Policy to validate
            
        Returns:
            List of validation errors (empty if valid)
        """
        errors = []
        
        if not policy.id:
            errors.append("Policy ID is required")
        
        if not policy.name:
            errors.append("Policy name is required")
        
        if not policy.conditions:
            errors.append("At least one condition is required")
        
        if not policy.actions:
            errors.append("At least one action is required")
        
        # Validate conditions
        valid_operators = ['equals', 'not_equals', 'contains', 'not_contains',
                         'gt', 'gte', 'lt', 'lte', 'regex', 'in', 'not_in',
                         'starts_with', 'ends_with']
        
        for i, cond in enumerate(policy.conditions):
            if cond.operator not in valid_operators:
                errors.append(f"Condition {i}: Invalid operator '{cond.operator}'")
            
            if cond.operator == 'regex':
                try:
                    re.compile(cond.value)
                except re.error as e:
                    errors.append(f"Condition {i}: Invalid regex '{cond.value}': {e}")
        
        return errors


# Global policy engine instance
_policy_engine: Optional[PolicyEngine] = None


def get_policy_engine() -> PolicyEngine:
    """Get the global policy engine instance"""
    global _policy_engine
    if _policy_engine is None:
        _policy_engine = PolicyEngine()
    return _policy_engine
