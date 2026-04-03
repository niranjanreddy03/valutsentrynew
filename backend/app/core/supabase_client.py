"""
Vault Sentry - Supabase Client Configuration
Provides Supabase client for backend operations
"""

from typing import Optional
from supabase import create_client, Client
from loguru import logger

from app.core.config import settings

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Get or create Supabase client singleton.
    Uses service role key to bypass RLS for backend operations.
    """
    global _supabase_client
    
    if _supabase_client is None:
        if not settings.SUPABASE_URL:
            raise ValueError("SUPABASE_URL is not configured")
        
        # Prefer service key for backend operations (bypasses RLS)
        # Skip placeholder values that haven't been configured
        service_key = settings.SUPABASE_SERVICE_KEY
        if service_key and service_key.startswith('your-'):
            service_key = None
            logger.warning("SUPABASE_SERVICE_KEY is a placeholder — falling back to anon key")
        key = service_key or settings.SUPABASE_KEY
        
        if not key:
            raise ValueError("SUPABASE_SERVICE_KEY or SUPABASE_KEY is required")
        
        _supabase_client = create_client(settings.SUPABASE_URL, key)
        logger.info("Supabase client initialized")
    
    return _supabase_client


def is_supabase_configured() -> bool:
    """Check if Supabase is properly configured"""
    service_key = settings.SUPABASE_SERVICE_KEY
    if service_key and service_key.startswith('your-'):
        service_key = None
    return bool(
        settings.SUPABASE_URL and 
        (service_key or settings.SUPABASE_KEY)
    )
