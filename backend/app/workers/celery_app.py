"""
Vault Sentry - Celery Application Configuration
"""

from celery import Celery
from kombu import Queue, Exchange
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "secret_sentry",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tasks.scan_tasks",
        "app.workers.tasks.alert_tasks",
        "app.workers.tasks.ml_tasks",
    ]
)

# Define exchanges
default_exchange = Exchange('default', type='direct')
scan_exchange = Exchange('scan', type='direct')
alert_exchange = Exchange('alert', type='direct')
ml_exchange = Exchange('ml', type='direct')

# Configure Celery
celery_app.conf.update(
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Task execution settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_track_started=True,
    
    # Result backend settings
    result_expires=3600,  # 1 hour
    result_extended=True,
    
    # Queue configuration
    task_queues=(
        Queue('default', default_exchange, routing_key='default'),
        Queue('scan_queue', scan_exchange, routing_key='scan'),
        Queue('alert_queue', alert_exchange, routing_key='alert'),
        Queue('ml_queue', ml_exchange, routing_key='ml'),
    ),
    
    # Default queue
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='default',
    
    # Task routing
    task_routes={
        # Scan tasks
        'app.workers.tasks.scan_tasks.*': {
            'queue': 'scan_queue',
            'routing_key': 'scan',
        },
        # Alert tasks
        'app.workers.tasks.alert_tasks.*': {
            'queue': 'alert_queue',
            'routing_key': 'alert',
        },
        # ML tasks
        'app.workers.tasks.ml_tasks.*': {
            'queue': 'ml_queue',
            'routing_key': 'ml',
        },
    },
    
    # Concurrency settings
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
    
    # Rate limiting
    task_annotations={
        'app.workers.tasks.scan_tasks.run_repository_scan': {
            'rate_limit': '10/m',  # 10 scans per minute
        },
        'app.workers.tasks.alert_tasks.send_slack_alert': {
            'rate_limit': '30/m',  # 30 alerts per minute
        },
    },
    
    # Task time limits
    task_soft_time_limit=1800,  # 30 minutes soft limit
    task_time_limit=3600,  # 1 hour hard limit
    
    # Beat scheduler for periodic tasks
    beat_schedule={
        'cleanup-old-scans': {
            'task': 'app.workers.tasks.scan_tasks.cleanup_old_scans',
            'schedule': 86400.0,  # Daily
        },
        'refresh-ml-model': {
            'task': 'app.workers.tasks.ml_tasks.retrain_model',
            'schedule': 604800.0,  # Weekly
        },
        'sync-repositories': {
            'task': 'app.workers.tasks.scan_tasks.sync_all_repositories',
            'schedule': 3600.0,  # Hourly
        },
    },
)


# Worker event handlers
@celery_app.task(bind=True)
def debug_task(self):
    """Debug task for testing"""
    return f'Request: {self.request!r}'
