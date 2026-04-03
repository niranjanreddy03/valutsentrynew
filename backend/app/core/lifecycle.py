"""
Vault Sentry - Secret Lifecycle Management
Track secret exposure, rotation, and remediation lifecycle
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum
from loguru import logger

from app.core.database import SessionLocal


class LifecycleStage(str, Enum):
    """Stages in secret lifecycle"""
    DETECTED = "detected"
    TRIAGED = "triaged"
    ASSIGNED = "assigned"
    IN_REMEDIATION = "in_remediation"
    ROTATION_PENDING = "rotation_pending"
    ROTATION_COMPLETE = "rotation_complete"
    VERIFIED = "verified"
    CLOSED = "closed"


class RemediationAction(str, Enum):
    """Types of remediation actions"""
    ROTATE = "rotate"
    REVOKE = "revoke"
    DELETE = "delete"
    UPDATE_ENV = "update_env"
    MARK_FALSE_POSITIVE = "mark_false_positive"
    ACKNOWLEDGE = "acknowledge"


@dataclass
class LifecycleEvent:
    """Event in secret lifecycle"""
    stage: str
    action: str
    timestamp: datetime
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[Dict] = None


class SecretLifecycleManager:
    """
    Manages the lifecycle of detected secrets.
    Tracks exposure time, rotation status, and remediation progress.
    """
    
    # SLA targets by severity (in hours)
    REMEDIATION_SLA = {
        'critical': 4,    # 4 hours
        'high': 24,       # 1 day
        'medium': 168,    # 1 week
        'low': 720,       # 30 days
    }
    
    def __init__(self):
        self.logger = logger.bind(module="lifecycle")
    
    def get_lifecycle(self, secret_id: int) -> Dict[str, Any]:
        """Get complete lifecycle information for a secret"""
        from app.models.secret import Secret
        
        db = SessionLocal()
        try:
            secret = db.query(Secret).filter(Secret.id == secret_id).first()
            if not secret:
                return {'error': 'Secret not found'}
            
            # Calculate exposure metrics
            exposure_time = self._calculate_exposure_time(secret)
            sla_status = self._check_sla_status(secret)
            
            # Build lifecycle timeline
            timeline = self._build_timeline(secret)
            
            return {
                'secret_id': secret_id,
                'current_stage': self._determine_current_stage(secret),
                'status': secret.status,
                'severity': secret.risk_level,
                'exposure': {
                    'first_detected': secret.first_detected_at.isoformat() if secret.first_detected_at else None,
                    'exposure_duration_hours': exposure_time,
                    'exposure_duration_human': self._format_duration(exposure_time),
                },
                'sla': sla_status,
                'timeline': timeline,
                'assigned_to': secret.assigned_team,
                'rotation_status': self._get_rotation_status(secret),
            }
        finally:
            db.close()
    
    def _calculate_exposure_time(self, secret) -> float:
        """Calculate total exposure time in hours"""
        if not secret.first_detected_at:
            return 0
        
        end_time = secret.resolved_at or datetime.now(timezone.utc)
        
        # Handle timezone-naive datetime
        if secret.first_detected_at.tzinfo is None:
            start_time = secret.first_detected_at.replace(tzinfo=timezone.utc)
        else:
            start_time = secret.first_detected_at
        
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        
        delta = end_time - start_time
        return round(delta.total_seconds() / 3600, 2)
    
    def _check_sla_status(self, secret) -> Dict[str, Any]:
        """Check if secret is within SLA"""
        severity = secret.risk_level or 'medium'
        sla_hours = self.REMEDIATION_SLA.get(severity, 168)
        
        exposure_hours = self._calculate_exposure_time(secret)
        
        if secret.status in ['resolved', 'false_positive']:
            return {
                'status': 'met',
                'target_hours': sla_hours,
                'actual_hours': exposure_hours,
                'remaining_hours': 0,
            }
        
        remaining = sla_hours - exposure_hours
        
        return {
            'status': 'met' if remaining > 0 else 'breached',
            'target_hours': sla_hours,
            'elapsed_hours': exposure_hours,
            'remaining_hours': max(0, remaining),
            'breach_time': (datetime.now(timezone.utc) + timedelta(hours=remaining)).isoformat() if remaining > 0 else None,
        }
    
    def _determine_current_stage(self, secret) -> str:
        """Determine current lifecycle stage"""
        status = secret.status
        
        stage_map = {
            'open': LifecycleStage.DETECTED.value,
            'in_progress': LifecycleStage.IN_REMEDIATION.value,
            'resolved': LifecycleStage.CLOSED.value,
            'false_positive': LifecycleStage.CLOSED.value,
            'ignored': LifecycleStage.CLOSED.value,
        }
        
        # Check for assignment
        if secret.assigned_team and status == 'open':
            return LifecycleStage.ASSIGNED.value
        
        return stage_map.get(status, LifecycleStage.DETECTED.value)
    
    def _build_timeline(self, secret) -> List[Dict]:
        """Build lifecycle timeline from secret metadata"""
        timeline = []
        
        # Detection event
        timeline.append({
            'stage': LifecycleStage.DETECTED.value,
            'timestamp': secret.first_detected_at.isoformat() if secret.first_detected_at else None,
            'action': 'Secret detected by scan',
            'type': 'system',
        })
        
        # Get events from metadata
        metadata = secret.meta_data or {}
        events = metadata.get('lifecycle_events', [])
        
        for event in events:
            timeline.append({
                'stage': event.get('stage'),
                'timestamp': event.get('timestamp'),
                'action': event.get('action'),
                'user': event.get('user_name'),
                'notes': event.get('notes'),
                'type': 'user',
            })
        
        # Resolution event
        if secret.resolved_at:
            timeline.append({
                'stage': LifecycleStage.CLOSED.value,
                'timestamp': secret.resolved_at.isoformat(),
                'action': f'Secret marked as {secret.status}',
                'notes': secret.resolution_notes,
                'type': 'resolution',
            })
        
        return sorted(timeline, key=lambda x: x.get('timestamp') or '')
    
    def _get_rotation_status(self, secret) -> Dict[str, Any]:
        """Get rotation status for the secret"""
        metadata = secret.meta_data or {}
        rotation = metadata.get('rotation', {})
        
        return {
            'rotated': rotation.get('completed', False),
            'rotated_at': rotation.get('completed_at'),
            'rotation_method': rotation.get('method'),
            'verified': rotation.get('verified', False),
            'verified_at': rotation.get('verified_at'),
        }
    
    def _format_duration(self, hours: float) -> str:
        """Format duration in human readable form"""
        if hours < 1:
            return f"{int(hours * 60)} minutes"
        elif hours < 24:
            return f"{hours:.1f} hours"
        elif hours < 168:
            return f"{hours / 24:.1f} days"
        else:
            return f"{hours / 168:.1f} weeks"
    
    def transition(
        self,
        secret_id: int,
        new_stage: str,
        action: str,
        user_id: int = None,
        user_name: str = None,
        notes: str = None,
        metadata: Dict = None
    ) -> Dict[str, Any]:
        """Transition secret to new lifecycle stage"""
        from app.models.secret import Secret, SecretStatus
        
        db = SessionLocal()
        try:
            secret = db.query(Secret).filter(Secret.id == secret_id).first()
            if not secret:
                return {'error': 'Secret not found'}
            
            # Create event
            event = {
                'stage': new_stage,
                'action': action,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'user_id': user_id,
                'user_name': user_name,
                'notes': notes,
                'metadata': metadata,
            }
            
            # Update secret metadata
            secret_metadata = secret.meta_data or {}
            if 'lifecycle_events' not in secret_metadata:
                secret_metadata['lifecycle_events'] = []
            secret_metadata['lifecycle_events'].append(event)
            secret.meta_data = secret_metadata
            
            # Update status based on stage
            stage_to_status = {
                LifecycleStage.IN_REMEDIATION.value: SecretStatus.IN_PROGRESS.value,
                LifecycleStage.CLOSED.value: SecretStatus.RESOLVED.value,
                LifecycleStage.VERIFIED.value: SecretStatus.RESOLVED.value,
            }
            
            if new_stage in stage_to_status:
                secret.status = stage_to_status[new_stage]
            
            # Set resolution timestamp if closing
            if new_stage in [LifecycleStage.CLOSED.value, LifecycleStage.VERIFIED.value]:
                secret.resolved_at = datetime.now(timezone.utc)
                secret.resolved_by = user_id
                secret.resolution_notes = notes
            
            db.commit()
            
            self.logger.info(f"Secret {secret_id} transitioned to {new_stage}")
            
            return {
                'secret_id': secret_id,
                'new_stage': new_stage,
                'status': secret.status,
                'event': event,
            }
            
        finally:
            db.close()
    
    def assign_owner(
        self,
        secret_id: int,
        team: str,
        assignee_id: int = None,
        assigned_by: int = None
    ) -> Dict[str, Any]:
        """Assign ownership of a secret"""
        from app.models.secret import Secret
        
        db = SessionLocal()
        try:
            secret = db.query(Secret).filter(Secret.id == secret_id).first()
            if not secret:
                return {'error': 'Secret not found'}
            
            secret.assigned_team = team
            
            # Record assignment event
            self.transition(
                secret_id=secret_id,
                new_stage=LifecycleStage.ASSIGNED.value,
                action=f'Assigned to {team}',
                user_id=assigned_by,
                metadata={'assignee_id': assignee_id}
            )
            
            return {
                'secret_id': secret_id,
                'assigned_team': team,
                'assigned_at': datetime.now(timezone.utc).isoformat(),
            }
            
        finally:
            db.close()
    
    def get_mttr(self, time_range_days: int = 30) -> Dict[str, Any]:
        """Calculate Mean Time To Remediate (MTTR) metrics"""
        from app.models.secret import Secret, SecretStatus
        
        db = SessionLocal()
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=time_range_days)
            
            # Get resolved secrets in time range
            resolved = db.query(Secret).filter(
                Secret.status == SecretStatus.RESOLVED.value,
                Secret.resolved_at >= cutoff,
                Secret.resolved_at.isnot(None),
                Secret.first_detected_at.isnot(None)
            ).all()
            
            if not resolved:
                return {
                    'time_range_days': time_range_days,
                    'sample_size': 0,
                    'mttr_hours': 0,
                    'by_severity': {},
                }
            
            # Calculate overall MTTR
            total_hours = 0
            severity_hours = {'critical': [], 'high': [], 'medium': [], 'low': []}
            
            for secret in resolved:
                hours = self._calculate_exposure_time(secret)
                total_hours += hours
                
                severity = secret.risk_level or 'medium'
                if severity in severity_hours:
                    severity_hours[severity].append(hours)
            
            mttr = total_hours / len(resolved)
            
            # Calculate MTTR by severity
            mttr_by_severity = {}
            for severity, hours_list in severity_hours.items():
                if hours_list:
                    mttr_by_severity[severity] = {
                        'mttr_hours': round(sum(hours_list) / len(hours_list), 2),
                        'count': len(hours_list),
                        'sla_target': self.REMEDIATION_SLA.get(severity),
                    }
            
            return {
                'time_range_days': time_range_days,
                'sample_size': len(resolved),
                'mttr_hours': round(mttr, 2),
                'mttr_human': self._format_duration(mttr),
                'by_severity': mttr_by_severity,
            }
            
        finally:
            db.close()
    
    def get_aging_report(self) -> Dict[str, Any]:
        """Get report on secret aging (time exposed)"""
        from app.models.secret import Secret, SecretStatus
        
        db = SessionLocal()
        try:
            # Get open secrets
            open_secrets = db.query(Secret).filter(
                Secret.status.in_([SecretStatus.OPEN.value, SecretStatus.IN_PROGRESS.value])
            ).all()
            
            # Categorize by age
            buckets = {
                '< 24 hours': [],
                '1-7 days': [],
                '7-30 days': [],
                '30-90 days': [],
                '> 90 days': [],
            }
            
            sla_breached = []
            
            now = datetime.now(timezone.utc)
            
            for secret in open_secrets:
                hours = self._calculate_exposure_time(secret)
                
                # Bucket assignment
                if hours < 24:
                    buckets['< 24 hours'].append(secret.id)
                elif hours < 168:
                    buckets['1-7 days'].append(secret.id)
                elif hours < 720:
                    buckets['7-30 days'].append(secret.id)
                elif hours < 2160:
                    buckets['30-90 days'].append(secret.id)
                else:
                    buckets['> 90 days'].append(secret.id)
                
                # Check SLA breach
                severity = secret.risk_level or 'medium'
                sla_hours = self.REMEDIATION_SLA.get(severity, 168)
                if hours > sla_hours:
                    sla_breached.append({
                        'id': secret.id,
                        'type': secret.type,
                        'severity': severity,
                        'exposure_hours': hours,
                        'sla_exceeded_by': hours - sla_hours,
                    })
            
            return {
                'total_open': len(open_secrets),
                'distribution': {k: len(v) for k, v in buckets.items()},
                'sla_breached_count': len(sla_breached),
                'sla_breached_details': sorted(sla_breached, key=lambda x: x['sla_exceeded_by'], reverse=True)[:20],
            }
            
        finally:
            db.close()


# Global instance
_lifecycle_manager: Optional[SecretLifecycleManager] = None


def get_lifecycle_manager() -> SecretLifecycleManager:
    """Get or create lifecycle manager instance"""
    global _lifecycle_manager
    if _lifecycle_manager is None:
        _lifecycle_manager = SecretLifecycleManager()
    return _lifecycle_manager
