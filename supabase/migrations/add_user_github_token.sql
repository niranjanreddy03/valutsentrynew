-- Migration: Secure GitHub Token Storage
-- This allows each user to configure their own GitHub Personal Access Token
-- for scanning private repositories with proper security controls.

-- =====================================================
-- Add encrypted token columns to users table
-- =====================================================

-- GitHub token (AES-256-GCM encrypted)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS github_token TEXT;

-- GitLab token (encrypted)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS gitlab_token TEXT;

-- Bitbucket app password (encrypted)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS bitbucket_token TEXT;

-- GitHub username associated with the token
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS github_username TEXT;

-- Token hash for lookup without decryption (SHA-256)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS github_token_hash TEXT;

-- Timestamp when token was added
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS github_token_added_at TIMESTAMPTZ;

-- Timestamp when token was revoked (for audit)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS github_token_revoked_at TIMESTAMPTZ;

-- Comments for documentation
COMMENT ON COLUMN public.users.github_token IS 'AES-256-GCM encrypted GitHub PAT. NEVER store plaintext.';
COMMENT ON COLUMN public.users.github_username IS 'GitHub username verified from token.';
COMMENT ON COLUMN public.users.github_token_hash IS 'SHA-256 hash for token lookup without decryption.';

-- =====================================================
-- Create audit_logs table for security tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for efficient querying
    CONSTRAINT audit_logs_event_type_check CHECK (
        event_type IN (
            'github_token_added',
            'github_token_revoked',
            'github_token_validated',
            'token_validation_failed',
            'repo_permission_checked',
            'scan_started',
            'scan_completed',
            'scan_failed',
            'unauthorized_access_attempt'
        )
    )
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Only backend (service role) can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- =====================================================
-- Create rate_limits table for API abuse prevention
-- =====================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, operation)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Comment
COMMENT ON TABLE public.rate_limits IS 'Rate limiting tracking for API operations';

-- =====================================================
-- RLS policies remain - users can only access own data
-- =====================================================
