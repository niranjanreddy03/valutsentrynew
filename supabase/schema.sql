-- Vault Sentry Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('admin', 'developer', 'viewer');
CREATE TYPE subscription_tier AS ENUM ('basic', 'premium', 'premium_plus');
CREATE TYPE provider_type AS ENUM ('github', 'gitlab', 'bitbucket', 'azure');
CREATE TYPE scan_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE risk_level AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE secret_status AS ENUM ('active', 'resolved', 'ignored', 'false_positive');
CREATE TYPE alert_type AS ENUM ('critical_secret', 'high_secret', 'scan_failed', 'new_repository', 'scan_completed');
CREATE TYPE trigger_type AS ENUM ('manual', 'webhook', 'scheduled', 'api');
CREATE TYPE integration_provider AS ENUM ('github', 'gitlab', 'bitbucket', 'slack', 'discord', 'jira', 'aws');

-- =====================================================
-- USERS TABLE (extends Supabase auth.users)
-- =====================================================

CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'developer',
    company TEXT,
    timezone TEXT DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{"email": true, "slack": false, "critical_only": false}'::jsonb,
    -- Subscription fields
    subscription_tier subscription_tier DEFAULT 'basic',
    subscription_started_at TIMESTAMPTZ,
    subscription_expires_at TIMESTAMPTZ,
    is_trial BOOLEAN DEFAULT FALSE,
    trial_ends_at TIMESTAMPTZ,
    scans_this_week INTEGER DEFAULT 0,
    scans_today INTEGER DEFAULT 0,
    last_scan_reset_date TIMESTAMPTZ,
    last_weekly_reset_date TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can insert their own profile (needed if trigger fails)
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- REPOSITORIES TABLE
-- =====================================================

CREATE TABLE public.repositories (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    provider provider_type DEFAULT 'github',
    branch TEXT DEFAULT 'main',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_scan_at TIMESTAMPTZ,
    secrets_count INTEGER DEFAULT 0,
    webhook_secret TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, url)
);

-- Enable RLS
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

-- Users can manage their own repositories
CREATE POLICY "Users can view own repositories" ON public.repositories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own repositories" ON public.repositories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own repositories" ON public.repositories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own repositories" ON public.repositories
    FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_repositories_user_id ON public.repositories(user_id);
CREATE INDEX idx_repositories_status ON public.repositories(status);

-- =====================================================
-- SCANS TABLE
-- =====================================================

CREATE TABLE public.scans (
    id SERIAL PRIMARY KEY,
    scan_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    repository_id INTEGER REFERENCES public.repositories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status scan_status DEFAULT 'pending',
    branch TEXT DEFAULT 'main',
    commit_hash TEXT,
    trigger_type trigger_type DEFAULT 'manual',
    files_scanned INTEGER DEFAULT 0,
    secrets_found INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Users can manage their own scans
CREATE POLICY "Users can view own scans" ON public.scans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scans" ON public.scans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scans" ON public.scans
    FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_scans_repository_id ON public.scans(repository_id);
CREATE INDEX idx_scans_user_id ON public.scans(user_id);
CREATE INDEX idx_scans_status ON public.scans(status);
CREATE INDEX idx_scans_created_at ON public.scans(created_at DESC);

-- =====================================================
-- SECRETS TABLE
-- =====================================================

CREATE TABLE public.secrets (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER REFERENCES public.scans(id) ON DELETE CASCADE NOT NULL,
    repository_id INTEGER REFERENCES public.repositories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    risk_level risk_level DEFAULT 'medium',
    file_path TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    column_start INTEGER,
    column_end INTEGER,
    masked_value TEXT NOT NULL,
    raw_match TEXT, -- Encrypted sensitive data
    entropy_score DECIMAL(5,2),
    pattern_name TEXT,
    status secret_status DEFAULT 'active',
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.secrets ENABLE ROW LEVEL SECURITY;

-- Users can manage their own secrets
CREATE POLICY "Users can view own secrets" ON public.secrets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own secrets" ON public.secrets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own secrets" ON public.secrets
    FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_secrets_repository_id ON public.secrets(repository_id);
CREATE INDEX idx_secrets_scan_id ON public.secrets(scan_id);
CREATE INDEX idx_secrets_risk_level ON public.secrets(risk_level);
CREATE INDEX idx_secrets_status ON public.secrets(status);
CREATE INDEX idx_secrets_type ON public.secrets(type);

-- =====================================================
-- ALERTS TABLE
-- =====================================================

CREATE TABLE public.alerts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    secret_id INTEGER REFERENCES public.secrets(id) ON DELETE SET NULL,
    scan_id INTEGER REFERENCES public.scans(id) ON DELETE SET NULL,
    repository_id INTEGER REFERENCES public.repositories(id) ON DELETE SET NULL,
    type alert_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity risk_level DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own alerts
CREATE POLICY "Users can view own alerts" ON public.alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON public.alerts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts" ON public.alerts
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX idx_alerts_is_read ON public.alerts(is_read);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at DESC);

-- =====================================================
-- API KEYS TABLE
-- =====================================================

CREATE TABLE public.api_keys (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL, -- First 8 chars for identification
    permissions TEXT[] DEFAULT ARRAY['read']::TEXT[],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can manage their own API keys
CREATE POLICY "Users can view own api keys" ON public.api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys" ON public.api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys" ON public.api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys" ON public.api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- INTEGRATIONS TABLE
-- =====================================================

CREATE TABLE public.integrations (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    provider integration_provider NOT NULL,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    webhook_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Users can manage their own integrations
CREATE POLICY "Users can view own integrations" ON public.integrations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations" ON public.integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" ON public.integrations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations" ON public.integrations
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- SCAN PATTERNS TABLE (for custom secret patterns)
-- =====================================================

CREATE TABLE public.scan_patterns (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    pattern TEXT NOT NULL,
    is_regex BOOLEAN DEFAULT TRUE,
    risk_level risk_level DEFAULT 'medium',
    is_enabled BOOLEAN DEFAULT TRUE,
    is_global BOOLEAN DEFAULT FALSE, -- Global patterns are system-wide
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.scan_patterns ENABLE ROW LEVEL SECURITY;

-- Users can view global patterns and their own
CREATE POLICY "Users can view patterns" ON public.scan_patterns
    FOR SELECT USING (is_global = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns" ON public.scan_patterns
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_global = FALSE);

CREATE POLICY "Users can update own patterns" ON public.scan_patterns
    FOR UPDATE USING (auth.uid() = user_id AND is_global = FALSE);

CREATE POLICY "Users can delete own patterns" ON public.scan_patterns
    FOR DELETE USING (auth.uid() = user_id AND is_global = FALSE);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON public.repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_secrets_updated_at
    BEFORE UPDATE ON public.secrets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_patterns_updated_at
    BEFORE UPDATE ON public.scan_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup with basic subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url, subscription_tier, subscription_started_at)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        'basic',
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update repository secrets count
CREATE OR REPLACE FUNCTION update_repository_secrets_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.repositories
        SET secrets_count = secrets_count + 1
        WHERE id = NEW.repository_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.repositories
        SET secrets_count = GREATEST(0, secrets_count - 1)
        WHERE id = OLD.repository_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_secrets_count
    AFTER INSERT OR DELETE ON public.secrets
    FOR EACH ROW EXECUTE FUNCTION update_repository_secrets_count();

-- Function to create alert when critical/high secret is found
CREATE OR REPLACE FUNCTION create_secret_alert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.risk_level IN ('critical', 'high') THEN
        INSERT INTO public.alerts (
            user_id,
            secret_id,
            scan_id,
            repository_id,
            type,
            title,
            message,
            severity,
            action_url
        )
        SELECT
            NEW.user_id,
            NEW.id,
            NEW.scan_id,
            NEW.repository_id,
            CASE WHEN NEW.risk_level = 'critical' THEN 'critical_secret'::alert_type ELSE 'high_secret'::alert_type END,
            NEW.risk_level || ' risk secret detected: ' || NEW.type,
            'A ' || NEW.risk_level || ' risk ' || NEW.type || ' was found in ' || NEW.file_path || ' at line ' || NEW.line_number,
            NEW.risk_level,
            '/secrets?id=' || NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_alert_on_secret
    AFTER INSERT ON public.secrets
    FOR EACH ROW EXECUTE FUNCTION create_secret_alert();

-- =====================================================
-- VIEWS FOR DASHBOARD
-- =====================================================

-- Dashboard stats view
CREATE OR REPLACE VIEW public.dashboard_stats AS
SELECT
    id as user_id,
    (SELECT COUNT(*) FROM public.scans WHERE scans.user_id = users.id) as total_scans,
    (SELECT COUNT(*) FROM public.secrets WHERE secrets.user_id = users.id) as secrets_found,
    (SELECT COUNT(*) FROM public.secrets WHERE secrets.user_id = users.id AND risk_level IN ('critical', 'high') AND status = 'active') as high_risk_issues,
    (SELECT COUNT(*) FROM public.repositories WHERE repositories.user_id = users.id) as repositories_monitored,
    (SELECT COUNT(*) FROM public.scans WHERE scans.user_id = users.id AND created_at > NOW() - INTERVAL '7 days') as scans_this_week,
    (SELECT COUNT(*) FROM public.secrets WHERE secrets.user_id = users.id AND status = 'resolved') as secrets_resolved,
    (SELECT COUNT(*) FROM public.alerts WHERE alerts.user_id = users.id AND is_read = FALSE) as unread_alerts
FROM public.users;

-- Risk distribution view
CREATE OR REPLACE VIEW public.risk_distribution AS
SELECT
    user_id,
    COUNT(*) FILTER (WHERE risk_level = 'critical') as critical,
    COUNT(*) FILTER (WHERE risk_level = 'high') as high,
    COUNT(*) FILTER (WHERE risk_level = 'medium') as medium,
    COUNT(*) FILTER (WHERE risk_level = 'low') as low,
    COUNT(*) FILTER (WHERE risk_level = 'info') as info
FROM public.secrets
WHERE status = 'active'
GROUP BY user_id;

-- =====================================================
-- INSERT DEFAULT SCAN PATTERNS
-- =====================================================

INSERT INTO public.scan_patterns (name, description, pattern, risk_level, is_global) VALUES
('AWS Access Key ID', 'AWS Access Key identifier', 'AKIA[0-9A-Z]{16}', 'critical', TRUE),
('AWS Secret Access Key', 'AWS Secret Access Key', '(?i)aws(.{0,20})?[''"][0-9a-zA-Z/+]{40}[''"]', 'critical', TRUE),
('GitHub Token', 'GitHub Personal Access Token', 'gh[pousr]_[A-Za-z0-9_]{36,251}', 'critical', TRUE),
('Google API Key', 'Google API Key', 'AIza[0-9A-Za-z\\-_]{35}', 'high', TRUE),
('Stripe API Key', 'Stripe Live/Test API Key', '(sk|rk)_(live|test)_[0-9a-zA-Z]{24,99}', 'critical', TRUE),
('Slack Token', 'Slack Bot/User Token', 'xox[baprs]-([0-9a-zA-Z]{10,48})', 'high', TRUE),
('Private Key', 'RSA/SSH Private Key', '-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----', 'critical', TRUE),
('JWT Token', 'JSON Web Token', 'eyJ[A-Za-z0-9-_]+\\.eyJ[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+', 'medium', TRUE),
('Database URL', 'Database connection string', '(postgres|mysql|mongodb)(\\+\\w+)?://[^\\s<>]+', 'high', TRUE),
('Generic API Key', 'Generic API Key pattern', '(?i)(api[_-]?key|apikey|api_secret)[''\"\\s:=]+[''"]?[a-zA-Z0-9_\\-]{20,}[''"]?', 'medium', TRUE),
('Twilio API Key', 'Twilio API Key', 'SK[0-9a-fA-F]{32}', 'high', TRUE),
('SendGrid API Key', 'SendGrid API Key', 'SG\\.[a-zA-Z0-9_-]{22}\\.[a-zA-Z0-9_-]{43}', 'high', TRUE),
('Discord Token', 'Discord Bot Token', '[MN][A-Za-z\\d]{23,}\\.[\\w-]{6}\\.[\\w-]{27}', 'high', TRUE),
('Heroku API Key', 'Heroku API Key', '(?i)heroku(.{0,20})?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'high', TRUE),
('Password in URL', 'Password embedded in URL', '://[^:]+:[^@]+@', 'critical', TRUE);

-- =====================================================
-- USER SUBSCRIPTION MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to update user subscription tier (for admin use)
CREATE OR REPLACE FUNCTION public.update_user_subscription(
    p_user_email TEXT,
    p_new_tier subscription_tier,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    old_tier subscription_tier,
    new_tier subscription_tier,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_user_id UUID;
    v_old_tier subscription_tier;
BEGIN
    -- Get user by email
    SELECT u.id, u.subscription_tier INTO v_user_id, v_old_tier
    FROM public.users u
    WHERE u.email = p_user_email;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', p_user_email;
    END IF;
    
    -- Update subscription
    UPDATE public.users
    SET 
        subscription_tier = p_new_tier,
        subscription_started_at = COALESCE(subscription_started_at, NOW()),
        subscription_expires_at = p_expires_at,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RETURN QUERY
    SELECT v_user_id, p_user_email, v_old_tier, p_new_tier, NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quick helper functions for common tier changes
CREATE OR REPLACE FUNCTION public.set_user_basic(user_email TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM public.update_user_subscription(user_email, 'basic'::subscription_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_user_premium(user_email TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM public.update_user_subscription(user_email, 'premium'::subscription_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_user_premium_plus(user_email TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM public.update_user_subscription(user_email, 'premium_plus'::subscription_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View to list all users with their subscription info
CREATE OR REPLACE VIEW public.user_subscriptions AS
SELECT 
    id,
    email,
    full_name,
    subscription_tier,
    subscription_started_at,
    subscription_expires_at,
    is_trial,
    trial_ends_at,
    created_at
FROM public.users
ORDER BY created_at DESC;

-- Grant access to admin functions (only for service role)
GRANT EXECUTE ON FUNCTION public.update_user_subscription TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_basic TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_premium TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_premium_plus TO service_role;
GRANT SELECT ON public.user_subscriptions TO service_role;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant select on views
GRANT SELECT ON public.dashboard_stats TO authenticated;
GRANT SELECT ON public.risk_distribution TO authenticated;
