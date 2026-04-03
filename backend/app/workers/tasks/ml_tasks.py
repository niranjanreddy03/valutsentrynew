"""
Vault Sentry - ML Worker Tasks
Background tasks for machine learning model training and scoring
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(name='app.workers.tasks.ml_tasks.retrain_model')
def retrain_model(
    include_feedback: bool = True,
    model_type: str = "xgboost"
):
    """
    Periodic task to retrain the ML risk scoring model.
    Uses historical data and user feedback to improve accuracy.
    """
    from app.ml.model_trainer import ModelTrainer
    from app.core.database import SessionLocal
    from app.models.secret import Secret, SecretStatus
    
    db = SessionLocal()
    trainer = ModelTrainer(model_type=model_type)
    
    try:
        # Collect training data from historical findings
        findings = db.query(Secret).filter(
            Secret.status.in_([
                SecretStatus.RESOLVED.value,
                SecretStatus.FALSE_POSITIVE.value,
                SecretStatus.IGNORED.value
            ])
        ).all()
        
        if len(findings) < 50:
            logger.info("Not enough training data yet. Using synthetic data.")
            # Generate synthetic data for initial training
            training_findings, labels = trainer.generate_synthetic_data(n_samples=1000)
        else:
            # Convert to training format
            training_findings = []
            labels = []
            
            for f in findings:
                training_findings.append({
                    'secret_value': f.secret_value_masked,
                    'type': f.type,
                    'file_path': f.file_path,
                    'line_number': f.line_number,
                    'code_snippet': f.code_snippet or '',
                    'confidence': 0.9,
                })
                
                # Label: 0 = false positive/low risk, 1 = true positive/high risk
                if f.status == SecretStatus.FALSE_POSITIVE.value:
                    labels.append(0)
                elif f.status == SecretStatus.IGNORED.value:
                    labels.append(0)
                else:  # RESOLVED = was a real secret
                    labels.append(1)
        
        # Prepare and train
        X, y = trainer.prepare_training_data(training_findings, labels)
        
        results = trainer.train(
            X, y,
            validation_split=0.2,
            cross_validate=True,
            hyperparameter_tuning=len(training_findings) > 500
        )
        
        # Save model
        trainer.save_model(additional_metadata={
            'training_samples': len(training_findings),
            'retraining_reason': 'scheduled',
        })
        
        # Reload in risk scorer
        from app.ml.risk_scorer import get_risk_scorer
        scorer = get_risk_scorer()
        scorer.reload_model()
        
        logger.info(f"Model retrained successfully. F1: {results.get('f1_score', 0):.3f}")
        
        return {
            'status': 'success',
            'model_type': model_type,
            'training_samples': len(training_findings),
            'f1_score': results.get('f1_score'),
            'accuracy': results.get('accuracy'),
        }
        
    except Exception as e:
        logger.error(f"Model retraining failed: {e}")
        return {
            'status': 'failed',
            'error': str(e)
        }
    finally:
        db.close()


@shared_task(name='app.workers.tasks.ml_tasks.score_findings_batch')
def score_findings_batch(
    finding_ids: List[int]
):
    """
    Batch score multiple findings with ML model.
    Used for rescoring after model updates.
    """
    from app.core.database import SessionLocal
    from app.models.secret import Secret
    from app.ml.risk_scorer import get_risk_scorer
    from app.ml.feature_extractor import FeatureExtractor
    
    db = SessionLocal()
    scorer = get_risk_scorer()
    extractor = FeatureExtractor()
    
    try:
        findings = db.query(Secret).filter(Secret.id.in_(finding_ids)).all()
        
        updated = 0
        for finding in findings:
            # Extract features
            features = extractor.extract_features(
                secret_value=finding.secret_value_masked,
                secret_type=finding.type,
                file_path=finding.file_path,
                line_number=finding.line_number,
                code_snippet=finding.code_snippet or '',
            )
            
            # Score
            score, risk_level, _ = scorer.score_and_classify(features)
            
            # Update if changed
            if finding.risk_score != score or finding.risk_level != risk_level:
                finding.risk_score = score
                finding.risk_level = risk_level
                updated += 1
        
        db.commit()
        
        logger.info(f"Batch scoring complete: {updated}/{len(findings)} updated")
        return {
            'processed': len(findings),
            'updated': updated
        }
        
    finally:
        db.close()


@shared_task(name='app.workers.tasks.ml_tasks.record_feedback')
def record_feedback(
    finding_id: int,
    feedback_type: str,  # false_positive, true_positive, severity_adjustment
    user_id: int,
    notes: str = None
):
    """
    Record user feedback for model improvement.
    """
    from app.core.database import SessionLocal
    from app.models.secret import Secret, SecretStatus
    
    db = SessionLocal()
    try:
        finding = db.query(Secret).filter(Secret.id == finding_id).first()
        if not finding:
            return {'status': 'error', 'reason': 'finding_not_found'}
        
        # Update status based on feedback
        if feedback_type == 'false_positive':
            finding.status = SecretStatus.FALSE_POSITIVE.value
        elif feedback_type == 'true_positive':
            finding.status = SecretStatus.OPEN.value  # Or RESOLVED if fixed
        
        # Store feedback metadata
        feedback_data = finding.meta_data or {}
        feedback_data['feedback'] = {
            'type': feedback_type,
            'user_id': user_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'notes': notes,
        }
        finding.meta_data = feedback_data
        
        db.commit()
        
        # Check if we should trigger retraining
        _check_retrain_trigger(db)
        
        return {
            'status': 'recorded',
            'finding_id': finding_id,
            'feedback_type': feedback_type
        }
        
    finally:
        db.close()


@shared_task(name='app.workers.tasks.ml_tasks.calculate_business_impact')
def calculate_business_impact(
    finding_id: int,
    repo_classification: str = 'internal',
    data_classification: str = 'internal'
):
    """
    Calculate business impact score for a finding.
    """
    from app.core.database import SessionLocal
    from app.models.secret import Secret
    from app.ml.risk_scorer import get_risk_scorer
    from app.ml.feature_extractor import FeatureExtractor
    
    db = SessionLocal()
    scorer = get_risk_scorer()
    extractor = FeatureExtractor()
    
    try:
        finding = db.query(Secret).filter(Secret.id == finding_id).first()
        if not finding:
            return {'status': 'error', 'reason': 'finding_not_found'}
        
        # Extract features
        features = extractor.extract_features(
            secret_value=finding.secret_value_masked,
            secret_type=finding.type,
            file_path=finding.file_path,
            line_number=finding.line_number,
            code_snippet=finding.code_snippet or '',
        )
        
        # Calculate business impact
        impact = scorer.calculate_business_impact(
            features=features,
            base_score=finding.risk_score,
            repo_type=repo_classification,
            data_classification=data_classification
        )
        
        # Store impact data
        metadata = finding.meta_data or {}
        metadata['business_impact'] = impact
        finding.meta_data = metadata
        
        db.commit()
        
        return {
            'finding_id': finding_id,
            'impact': impact
        }
        
    finally:
        db.close()


@shared_task(name='app.workers.tasks.ml_tasks.analyze_repository_risk')
def analyze_repository_risk(repository_id: int):
    """
    Calculate aggregate risk score for a repository.
    """
    from app.core.database import SessionLocal
    from app.models.repository import Repository
    from app.models.secret import Secret, SecretStatus
    from app.models.scan import Scan
    
    db = SessionLocal()
    try:
        repo = db.query(Repository).filter(Repository.id == repository_id).first()
        if not repo:
            return {'status': 'error', 'reason': 'repository_not_found'}
        
        # Get all open findings for this repo
        subquery = db.query(Scan.id).filter(Scan.repository_id == repository_id)
        findings = db.query(Secret).filter(
            Secret.scan_id.in_(subquery),
            Secret.status == SecretStatus.OPEN.value
        ).all()
        
        if not findings:
            repo.risk_score = 0
            repo.risk_level = 'low'
            db.commit()
            return {
                'repository_id': repository_id,
                'risk_score': 0,
                'risk_level': 'low',
                'finding_count': 0
            }
        
        # Calculate aggregate risk
        scores = [f.risk_score for f in findings]
        max_score = max(scores)
        avg_score = sum(scores) / len(scores)
        
        # Weight by severity distribution
        critical_count = sum(1 for f in findings if f.risk_level == 'critical')
        high_count = sum(1 for f in findings if f.risk_level == 'high')
        
        # Risk calculation: max + bonus for multiple critical/high
        risk_score = min(100, max_score + (critical_count * 5) + (high_count * 2))
        
        # Determine level
        if risk_score >= 80 or critical_count > 0:
            risk_level = 'critical'
        elif risk_score >= 60 or high_count > 2:
            risk_level = 'high'
        elif risk_score >= 40:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        # Update repository
        repo.risk_score = round(risk_score, 1)
        repo.risk_level = risk_level
        repo.last_risk_assessment = datetime.now(timezone.utc)
        db.commit()
        
        return {
            'repository_id': repository_id,
            'risk_score': round(risk_score, 1),
            'risk_level': risk_level,
            'finding_count': len(findings),
            'critical_count': critical_count,
            'high_count': high_count,
        }
        
    finally:
        db.close()


@shared_task(name='app.workers.tasks.ml_tasks.generate_risk_report')
def generate_risk_report(
    repository_ids: List[int] = None,
    time_range_days: int = 30
):
    """
    Generate aggregate risk report across repositories.
    """
    from app.core.database import SessionLocal
    from app.models.repository import Repository
    from app.models.secret import Secret, SecretStatus
    from app.models.scan import Scan
    from datetime import timedelta
    
    db = SessionLocal()
    try:
        if repository_ids:
            repos = db.query(Repository).filter(Repository.id.in_(repository_ids)).all()
        else:
            repos = db.query(Repository).all()
        
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=time_range_days)
        
        report = {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'time_range_days': time_range_days,
            'repositories': [],
            'summary': {
                'total_repos': len(repos),
                'total_findings': 0,
                'critical_count': 0,
                'high_count': 0,
                'medium_count': 0,
                'low_count': 0,
                'avg_risk_score': 0,
            }
        }
        
        total_risk_score = 0
        
        for repo in repos:
            # Get recent findings
            subquery = db.query(Scan.id).filter(
                Scan.repository_id == repo.id,
                Scan.created_at >= cutoff_date
            )
            findings = db.query(Secret).filter(
                Secret.scan_id.in_(subquery)
            ).all()
            
            repo_data = {
                'id': repo.id,
                'name': repo.name,
                'risk_score': repo.risk_score or 0,
                'risk_level': repo.risk_level or 'low',
                'finding_count': len(findings),
                'severity_breakdown': {
                    'critical': sum(1 for f in findings if f.risk_level == 'critical'),
                    'high': sum(1 for f in findings if f.risk_level == 'high'),
                    'medium': sum(1 for f in findings if f.risk_level == 'medium'),
                    'low': sum(1 for f in findings if f.risk_level == 'low'),
                }
            }
            
            report['repositories'].append(repo_data)
            
            # Update summary
            report['summary']['total_findings'] += len(findings)
            report['summary']['critical_count'] += repo_data['severity_breakdown']['critical']
            report['summary']['high_count'] += repo_data['severity_breakdown']['high']
            report['summary']['medium_count'] += repo_data['severity_breakdown']['medium']
            report['summary']['low_count'] += repo_data['severity_breakdown']['low']
            total_risk_score += repo.risk_score or 0
        
        if repos:
            report['summary']['avg_risk_score'] = round(total_risk_score / len(repos), 1)
        
        # Sort repos by risk
        report['repositories'].sort(key=lambda x: x['risk_score'], reverse=True)
        
        return report
        
    finally:
        db.close()


def _check_retrain_trigger(db):
    """Check if we should trigger model retraining based on feedback volume"""
    from app.models.secret import Secret, SecretStatus
    
    # Count recent feedback
    recent_feedback_count = db.query(Secret).filter(
        Secret.status.in_([
            SecretStatus.FALSE_POSITIVE.value,
            SecretStatus.RESOLVED.value
        ])
    ).count()
    
    # Trigger retraining if we have enough new feedback (e.g., 100 new items)
    if recent_feedback_count % 100 == 0 and recent_feedback_count > 0:
        logger.info(f"Triggering model retraining due to feedback volume: {recent_feedback_count}")
        retrain_model.delay(include_feedback=True)
