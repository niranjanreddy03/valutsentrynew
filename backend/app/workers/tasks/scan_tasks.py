"""
Vault Sentry - Scan Worker Tasks
Background tasks for repository scanning
"""

import os
import shutil
import tempfile
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from celery import shared_task, current_task
from celery.utils.log import get_task_logger
import git

logger = get_task_logger(__name__)


@shared_task(bind=True, name='app.workers.tasks.scan_tasks.run_repository_scan')
def run_repository_scan(
    self,
    scan_id: int,
    repository_id: int,
    repository_url: str,
    branch: str = "main",
    scan_type: str = "full",
    user_id: int = None,
    options: Dict[str, Any] = None
):
    """
    Main scan task - clones repository and runs detection engines.
    
    Args:
        scan_id: Database scan record ID
        repository_id: Repository ID
        repository_url: Git URL to clone
        branch: Branch to scan
        scan_type: full, incremental, or quick
        user_id: User who triggered the scan
        options: Additional scan options
    """
    from app.core.database import SessionLocal
    from app.models.scan import Scan, ScanStatus
    from app.models.secret import Secret
    from app.scanner.engine import SecretScanner
    from app.ml.risk_scorer import get_risk_scorer
    from app.ml.feature_extractor import FeatureExtractor
    
    options = options or {}
    temp_dir = None
    
    try:
        # Update scan status to running
        self.update_state(state='PROGRESS', meta={'status': 'starting', 'progress': 0})
        _update_scan_status(scan_id, ScanStatus.RUNNING.value, started_at=datetime.now(timezone.utc))
        
        # Create temp directory for cloning
        temp_dir = tempfile.mkdtemp(prefix=f"scan_{scan_id}_")
        logger.info(f"Cloning repository {repository_url} to {temp_dir}")
        
        # Clone repository
        self.update_state(state='PROGRESS', meta={'status': 'cloning', 'progress': 10})
        repo = _clone_repository(repository_url, temp_dir, branch)
        
        if not repo:
            raise Exception(f"Failed to clone repository: {repository_url}")
        
        # Initialize scanner
        self.update_state(state='PROGRESS', meta={'status': 'scanning', 'progress': 30})
        scanner = SecretScanner(
            entropy_enabled=options.get('entropy_enabled', True),
            max_workers=options.get('max_workers', 4)
        )
        
        # Run scan
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            scan_result = loop.run_until_complete(
                scanner.scan_directory(
                    temp_dir,
                    recursive=True,
                    report_progress=lambda p: self.update_state(
                        state='PROGRESS',
                        meta={'status': 'scanning', 'progress': 30 + int(p * 40)}
                    )
                )
            )
        finally:
            loop.close()
        
        # ML risk scoring
        self.update_state(state='PROGRESS', meta={'status': 'scoring', 'progress': 75})
        risk_scorer = get_risk_scorer()
        feature_extractor = FeatureExtractor()
        
        # Process findings
        findings_to_store = []
        for finding in scan_result.findings:
            # Extract features
            features = feature_extractor.extract_features(
                secret_value=finding.secret_value,
                secret_type=finding.type,
                file_path=finding.file_path,
                line_number=finding.line_number,
                code_snippet=finding.code_snippet,
                confidence=finding.confidence
            )
            
            # Score with ML
            score, risk_level, explanation = risk_scorer.score_and_classify(features)
            
            findings_to_store.append({
                'finding': finding,
                'ml_score': score,
                'risk_level': risk_level,
                'features': features,
            })
        
        # Store results
        self.update_state(state='PROGRESS', meta={'status': 'storing', 'progress': 85})
        _store_findings(scan_id, findings_to_store)
        
        # Update scan record
        self.update_state(state='PROGRESS', meta={'status': 'finalizing', 'progress': 95})
        
        stats = {
            'files_scanned': scan_result.files_scanned,
            'total_findings': len(findings_to_store),
            'critical_count': sum(1 for f in findings_to_store if f['risk_level'] == 'critical'),
            'high_count': sum(1 for f in findings_to_store if f['risk_level'] == 'high'),
            'medium_count': sum(1 for f in findings_to_store if f['risk_level'] == 'medium'),
            'low_count': sum(1 for f in findings_to_store if f['risk_level'] == 'low'),
            'duration_seconds': scan_result.duration_seconds,
        }
        
        _update_scan_complete(scan_id, stats)
        
        # Trigger alerts for critical findings
        critical_findings = [f for f in findings_to_store if f['risk_level'] == 'critical']
        if critical_findings:
            from app.workers.tasks.alert_tasks import create_alerts_for_findings
            create_alerts_for_findings.delay(scan_id, repository_id, len(critical_findings))
        
        logger.info(f"Scan {scan_id} completed: {stats['total_findings']} findings")
        
        return {
            'scan_id': scan_id,
            'status': 'completed',
            'stats': stats,
        }
        
    except Exception as e:
        logger.error(f"Scan {scan_id} failed: {str(e)}")
        _update_scan_status(scan_id, ScanStatus.FAILED.value, error=str(e))
        
        # Retry logic
        if self.request.retries < 3:
            raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))
        
        return {
            'scan_id': scan_id,
            'status': 'failed',
            'error': str(e),
        }
        
    finally:
        # Cleanup temp directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp dir: {e}")


@shared_task(name='app.workers.tasks.scan_tasks.run_quick_scan')
def run_quick_scan(
    scan_id: int,
    content: str,
    file_name: str = "uploaded_file",
    user_id: int = None
):
    """Quick scan of uploaded content without full repository clone"""
    from app.scanner.engine import SecretScanner
    from app.ml.risk_scorer import get_risk_scorer
    from app.ml.feature_extractor import FeatureExtractor
    
    try:
        _update_scan_status(scan_id, 'running')
        
        # Scan content
        scanner = SecretScanner()
        findings = scanner.scan_content(content, file_name)
        
        # Score findings
        risk_scorer = get_risk_scorer()
        feature_extractor = FeatureExtractor()
        
        results = []
        for finding in findings:
            features = feature_extractor.extract_features(
                secret_value=finding.secret_value,
                secret_type=finding.type,
                file_path=finding.file_path,
                line_number=finding.line_number,
                code_snippet=finding.code_snippet,
            )
            score, risk_level, _ = risk_scorer.score_and_classify(features)
            results.append({
                'type': finding.type,
                'severity': risk_level,
                'line': finding.line_number,
                'score': score,
            })
        
        _update_scan_complete(scan_id, {'total_findings': len(results)})
        
        return {'scan_id': scan_id, 'findings': results}
        
    except Exception as e:
        logger.error(f"Quick scan failed: {e}")
        _update_scan_status(scan_id, 'failed', error=str(e))
        return {'scan_id': scan_id, 'error': str(e)}


@shared_task(name='app.workers.tasks.scan_tasks.run_incremental_scan')
def run_incremental_scan(
    scan_id: int,
    repository_id: int,
    repository_url: str,
    since_commit: str,
    branch: str = "main"
):
    """Scan only changes since a specific commit"""
    # Implementation would use git diff + selective scanning
    # For now, delegates to full scan with commit range
    return run_repository_scan(
        scan_id=scan_id,
        repository_id=repository_id,
        repository_url=repository_url,
        branch=branch,
        scan_type='incremental',
        options={'since_commit': since_commit}
    )


@shared_task(name='app.workers.tasks.scan_tasks.scan_cicd_artifact')
def scan_cicd_artifact(
    artifact_url: str,
    artifact_type: str,  # docker, npm, pypi, etc.
    scan_id: int = None,
    repository_id: int = None
):
    """
    Scan CI/CD build artifacts for secrets.
    
    Supports:
    - Docker images
    - NPM packages
    - PyPI packages
    - Build archives (zip, tar)
    """
    from app.scanner.engine import SecretScanner
    
    temp_dir = tempfile.mkdtemp(prefix="artifact_scan_")
    
    try:
        # Download/extract artifact
        if artifact_type == 'docker':
            # Pull and export docker image
            _scan_docker_image(artifact_url, temp_dir)
        elif artifact_type in ['npm', 'pypi']:
            # Download package
            _download_package(artifact_url, artifact_type, temp_dir)
        else:
            # Download archive
            _download_archive(artifact_url, temp_dir)
        
        # Scan extracted contents
        scanner = SecretScanner()
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                scanner.scan_directory(temp_dir, recursive=True)
            )
        finally:
            loop.close()
        
        return {
            'artifact_url': artifact_url,
            'artifact_type': artifact_type,
            'findings_count': len(result.findings),
            'findings': [
                {
                    'type': f.type,
                    'severity': f.severity,
                    'file_path': f.file_path,
                    'line': f.line_number,
                }
                for f in result.findings[:50]  # Limit response size
            ]
        }
        
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


@shared_task(name='app.workers.tasks.scan_tasks.sync_all_repositories')
def sync_all_repositories():
    """Periodic task to sync all repositories and check for changes"""
    from app.core.database import SessionLocal
    from app.models.repository import Repository, RepositoryStatus
    
    db = SessionLocal()
    try:
        repos = db.query(Repository).filter(
            Repository.status == RepositoryStatus.ACTIVE.value,
            Repository.auto_scan == True
        ).all()
        
        triggered = 0
        for repo in repos:
            # Check if repo has new commits
            if _has_new_commits(repo):
                # Trigger scan
                run_repository_scan.delay(
                    scan_id=None,  # Will create new scan record
                    repository_id=repo.id,
                    repository_url=repo.url,
                    branch=repo.branch,
                    scan_type='incremental',
                    options={'triggered_by': 'sync'}
                )
                triggered += 1
        
        logger.info(f"Sync complete: {triggered} scans triggered")
        return {'synced': len(repos), 'scans_triggered': triggered}
        
    finally:
        db.close()


@shared_task(name='app.workers.tasks.scan_tasks.cleanup_old_scans')
def cleanup_old_scans(days_old: int = 90):
    """Periodic task to cleanup old scan data"""
    from app.core.database import SessionLocal
    from app.models.scan import Scan
    from datetime import timedelta
    
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_old)
        
        old_scans = db.query(Scan).filter(
            Scan.created_at < cutoff,
            Scan.status.in_(['completed', 'failed', 'cancelled'])
        ).all()
        
        deleted = 0
        for scan in old_scans:
            db.delete(scan)
            deleted += 1
        
        db.commit()
        logger.info(f"Cleaned up {deleted} old scans")
        return {'deleted': deleted}
        
    finally:
        db.close()


# Helper functions
def _clone_repository(url: str, target_dir: str, branch: str = "main"):
    """Clone a git repository"""
    try:
        repo = git.Repo.clone_from(
            url,
            target_dir,
            branch=branch,
            depth=1,  # Shallow clone for speed
            single_branch=True
        )
        return repo
    except Exception as e:
        logger.error(f"Git clone failed: {e}")
        return None


def _update_scan_status(scan_id: int, status: str, **kwargs):
    """Update scan status in database (Supabase or fallback to local)"""
    from app.core.supabase_client import is_supabase_configured, get_supabase_client
    
    if is_supabase_configured():
        try:
            supabase = get_supabase_client()
            updates = {'status': status, **kwargs}
            # Convert datetime objects to ISO strings
            for key, value in updates.items():
                if hasattr(value, 'isoformat'):
                    updates[key] = value.isoformat()
            supabase.table('scans').update(updates).eq('id', scan_id).execute()
            return
        except Exception as e:
            logger.warning(f"Supabase update failed, falling back to local DB: {e}")
    
    # Fallback to local database
    from app.core.database import SessionLocal
    from app.models.scan import Scan
    
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            scan.status = status
            for key, value in kwargs.items():
                if hasattr(scan, key):
                    setattr(scan, key, value)
            db.commit()
    finally:
        db.close()


def _update_scan_complete(scan_id: int, stats: Dict):
    """Update scan with completion stats (Supabase or fallback to local)"""
    from app.core.supabase_client import is_supabase_configured, get_supabase_client
    
    if is_supabase_configured():
        try:
            supabase = get_supabase_client()
            updates = {
                'status': 'completed',
                'completed_at': datetime.now(timezone.utc).isoformat(),
                'files_scanned': stats.get('files_scanned', 0),
                'secrets_found': stats.get('total_findings', 0),
                'critical_count': stats.get('critical_count', 0),
                'high_count': stats.get('high_count', 0),
                'medium_count': stats.get('medium_count', 0),
                'low_count': stats.get('low_count', 0),
                'duration_seconds': stats.get('duration_seconds', 0),
            }
            supabase.table('scans').update(updates).eq('id', scan_id).execute()
            return
        except Exception as e:
            logger.warning(f"Supabase update failed, falling back to local DB: {e}")
    
    # Fallback to local database
    from app.core.database import SessionLocal
    from app.models.scan import Scan, ScanStatus
    
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if scan:
            scan.status = ScanStatus.COMPLETED.value
            scan.completed_at = datetime.now(timezone.utc)
            scan.files_scanned = stats.get('files_scanned', 0)
            scan.secrets_found = stats.get('total_findings', 0)
            scan.critical_count = stats.get('critical_count', 0)
            scan.high_count = stats.get('high_count', 0)
            scan.medium_count = stats.get('medium_count', 0)
            scan.low_count = stats.get('low_count', 0)
            scan.duration_seconds = stats.get('duration_seconds', 0)
            db.commit()
    finally:
        db.close()


def _store_findings(scan_id: int, findings: List[Dict]):
    """Store findings in database (Supabase or fallback to local)"""
    from app.core.supabase_client import is_supabase_configured, get_supabase_client
    
    if is_supabase_configured():
        try:
            supabase = get_supabase_client()
            
            # Get scan to find repository_id
            scan_result = supabase.table('scans').select('repository_id').eq('id', scan_id).single().execute()
            repository_id = scan_result.data.get('repository_id') if scan_result.data else None
            
            secrets_to_insert = []
            for item in findings:
                finding = item['finding']
                secrets_to_insert.append({
                    'scan_id': scan_id,
                    'repository_id': repository_id,
                    'type': finding.type,
                    'description': finding.match_rule or finding.type,
                    'file_path': finding.file_path,
                    'line_number': finding.line_number,
                    'masked_value': finding.secret_masked,
                    'secret_hash': finding.secret_hash,
                    'code_snippet': finding.code_snippet,
                    'risk_level': item['risk_level'],
                    'risk_score': item['ml_score'],
                    'entropy_score': finding.entropy_score,
                    'status': 'active',
                })
            
            if secrets_to_insert:
                supabase.table('secrets').insert(secrets_to_insert).execute()
            
            # Update repository secrets_count
            if repository_id:
                count_result = supabase.table('secrets').select('id', count='exact').eq('repository_id', repository_id).eq('status', 'active').execute()
                supabase.table('repositories').update({'secrets_count': count_result.count or 0}).eq('id', repository_id).execute()
            
            return
        except Exception as e:
            logger.warning(f"Supabase insert failed, falling back to local DB: {e}")
    
    # Fallback to local database
    from app.core.database import SessionLocal
    from app.models.secret import Secret, SecretStatus
    import hashlib
    
    db = SessionLocal()
    try:
        for item in findings:
            finding = item['finding']
            
            secret = Secret(
                finding_id=finding.finding_id,
                scan_id=scan_id,
                type=finding.type,
                file_path=finding.file_path,
                line_number=finding.line_number,
                column_start=finding.column_start,
                column_end=finding.column_end,
                secret_value_masked=finding.secret_masked,
                secret_hash=finding.secret_hash,
                code_snippet=finding.code_snippet,
                match_rule=finding.match_rule,
                risk_level=item['risk_level'],
                risk_score=item['ml_score'],
                entropy_score=finding.entropy_score,
                is_test_file=finding.is_test_file,
                status=SecretStatus.OPEN.value,
            )
            db.add(secret)
        
        db.commit()
    finally:
        db.close()


def _has_new_commits(repo) -> bool:
    """Check if repository has new commits since last scan"""
    # Implementation would compare HEAD with last scanned commit
    return True  # Placeholder


def _scan_docker_image(image_url: str, target_dir: str):
    """Pull and extract docker image for scanning"""
    import subprocess
    
    # Pull image
    subprocess.run(['docker', 'pull', image_url], check=True)
    
    # Export as tar
    tar_path = os.path.join(target_dir, 'image.tar')
    subprocess.run(['docker', 'save', '-o', tar_path, image_url], check=True)
    
    # Extract tar
    import tarfile
    with tarfile.open(tar_path) as tar:
        tar.extractall(target_dir)


def _download_package(url: str, package_type: str, target_dir: str):
    """Download npm/pypi package"""
    import urllib.request
    import zipfile
    import tarfile
    
    # Download package
    file_name = os.path.join(target_dir, 'package.archive')
    urllib.request.urlretrieve(url, file_name)
    
    # Extract
    if file_name.endswith('.tar.gz') or file_name.endswith('.tgz'):
        with tarfile.open(file_name) as tar:
            tar.extractall(target_dir)
    elif file_name.endswith('.zip'):
        with zipfile.ZipFile(file_name) as z:
            z.extractall(target_dir)


def _download_archive(url: str, target_dir: str):
    """Download and extract archive"""
    import urllib.request
    
    file_name = os.path.join(target_dir, 'archive')
    urllib.request.urlretrieve(url, file_name)
    
    # Auto-detect and extract
    import tarfile
    import zipfile
    
    if tarfile.is_tarfile(file_name):
        with tarfile.open(file_name) as tar:
            tar.extractall(target_dir)
    elif zipfile.is_zipfile(file_name):
        with zipfile.ZipFile(file_name) as z:
            z.extractall(target_dir)
