-- ========================================
-- Vault Sentry Database Initialization
-- ========================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------
-- Users Table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'developer' CHECK (role IN ('admin', 'developer', 'viewer')),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- ----------------------------------------
-- Repositories Table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS repositories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('github', 'gitlab', 'bitbucket', 'local', 's3')),
    branch VARCHAR(255) DEFAULT 'main',
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    access_token_encrypted VARCHAR(500),
    webhook_secret VARCHAR(255),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total_scans INTEGER DEFAULT 0,
    secrets_found INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(url, user_id)
);

-- ----------------------------------------
-- Scans Table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    repository_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    branch VARCHAR(255),
    commit_hash VARCHAR(100),
    files_scanned INTEGER DEFAULT 0,
    secrets_found INTEGER DEFAULT 0,
    scan_type VARCHAR(50) DEFAULT 'full' CHECK (scan_type IN ('full', 'incremental', 'quick')),
    triggered_by VARCHAR(50) DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'webhook', 'scheduled', 'api')),
    triggered_by_user_id INTEGER REFERENCES users(id),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- ----------------------------------------
-- Secrets Table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS secrets (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,
    repository_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('critical', 'high', 'medium', 'low', 'info')),
    file_path VARCHAR(1000) NOT NULL,
    line_number INTEGER NOT NULL,
    column_start INTEGER,
    column_end INTEGER,
    masked_value VARCHAR(255),
    hash_value VARCHAR(64), -- SHA256 hash for deduplication
    entropy_score FLOAT,
    pattern_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'ignored', 'false_positive')),
    resolved_by_user_id INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repository_id, file_path, line_number, hash_value)
);

-- ----------------------------------------
-- Alerts Table
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('critical', 'warning', 'info', 'success')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    repository_id INTEGER REFERENCES repositories(id) ON DELETE SET NULL,
    scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
    secret_id INTEGER REFERENCES secrets(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- ----------------------------------------
-- API Keys Table (for programmatic access)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL, -- First 8 chars for identification
    scopes TEXT[] DEFAULT ARRAY['read'],
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- Scan Rules Table (custom patterns)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS scan_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pattern TEXT NOT NULL,
    pattern_type VARCHAR(50) DEFAULT 'regex' CHECK (pattern_type IN ('regex', 'keyword', 'entropy')),
    risk_level VARCHAR(50) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT TRUE,
    is_global BOOLEAN DEFAULT FALSE, -- Global rules apply to all users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------
-- Indexes for Performance
-- ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_repositories_user_id ON repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_repositories_type ON repositories(type);
CREATE INDEX IF NOT EXISTS idx_scans_repository_id ON scans(repository_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_secrets_scan_id ON secrets(scan_id);
CREATE INDEX IF NOT EXISTS idx_secrets_repository_id ON secrets(repository_id);
CREATE INDEX IF NOT EXISTS idx_secrets_risk_level ON secrets(risk_level);
CREATE INDEX IF NOT EXISTS idx_secrets_status ON secrets(status);
CREATE INDEX IF NOT EXISTS idx_secrets_type ON secrets(type);
CREATE INDEX IF NOT EXISTS idx_secrets_hash ON secrets(hash_value);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);

-- ----------------------------------------
-- Full Text Search Indexes
-- ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_secrets_file_path_trgm ON secrets USING gin(file_path gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_repositories_name_trgm ON repositories USING gin(name gin_trgm_ops);

-- ----------------------------------------
-- Functions
-- ----------------------------------------

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_repositories_updated_at ON repositories;
CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scan_rules_updated_at ON scan_rules;
CREATE TRIGGER update_scan_rules_updated_at
    BEFORE UPDATE ON scan_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------
-- Default Admin User (password: admin123)
-- ----------------------------------------
INSERT INTO users (email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
    'admin@VaultSentry.io',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.s8BlNCwYh3PyGu', -- bcrypt hash of 'admin123'
    'System Administrator',
    'admin',
    TRUE,
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------
-- Sample Scan Rules
-- ----------------------------------------
INSERT INTO scan_rules (name, description, pattern, pattern_type, risk_level, is_active, is_global)
VALUES 
    ('Custom API Key', 'Detect custom API keys with specific prefix', 'my_api_key_[a-zA-Z0-9]{32}', 'regex', 'high', TRUE, TRUE),
    ('Internal Token', 'Internal service tokens', 'internal_token_[a-zA-Z0-9_]{20,}', 'regex', 'critical', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Grant permissions (for security in production environments)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO VaultSentry;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO VaultSentry;
