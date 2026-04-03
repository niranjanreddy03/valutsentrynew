/**
 * VaultSentry Node.js Scanning Engine
 * rules.js — Secret detection rules with regex patterns
 *
 * Each rule defines:
 *  - id         : unique rule identifier
 *  - type       : human-readable secret type
 *  - category   : grouping (aws, github, jwt, password, api_key, …)
 *  - severity   : critical | high | medium | low
 *  - confidence : 0–1, how reliable the pattern is
 *  - pattern    : compiled RegExp
 *  - description: short description
 *  - falsePositives: optional array of RegExp that mark a match as a false positive
 */

'use strict';

/** @typedef {Object} Rule
 * @property {string}   id
 * @property {string}   type
 * @property {string}   category
 * @property {'critical'|'high'|'medium'|'low'} severity
 * @property {number}   confidence
 * @property {RegExp}   pattern
 * @property {string}   description
 * @property {RegExp[]} [falsePositives]
 */

// ─────────────────────────── AWS ──────────────────────────────────────────────

const AWS_RULES = [
  {
    id: 'aws-access-key-id',
    type: 'AWS Access Key ID',
    category: 'aws',
    severity: 'critical',
    confidence: 0.95,
    pattern: /(?:A3T[A-Z0-9]|AKIA|ABIA|ACCA|AGPA|AIDA|AIPA|AROA|APKA|ASCA|ASIA)[A-Z0-9]{16}/g,
    description: 'AWS Access Key ID — provides programmatic access to AWS resources',
  },
  {
    id: 'aws-secret-access-key',
    type: 'AWS Secret Access Key',
    category: 'aws',
    severity: 'critical',
    confidence: 0.90,
    pattern: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[=:]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
    description: 'AWS Secret Access Key — paired with Access Key ID for authentication',
  },
  {
    id: 'aws-session-token',
    type: 'AWS Session Token',
    category: 'aws',
    severity: 'high',
    confidence: 0.85,
    pattern: /(?:aws_session_token|session_token)\s*[=:]\s*["']?([A-Za-z0-9/+=]{100,})["']?/gi,
    description: 'AWS Session Token — temporary security credential',
  },
  {
    id: 'aws-account-id',
    type: 'AWS Account ID',
    category: 'aws',
    severity: 'medium',
    confidence: 0.70,
    pattern: /(?:aws_account_id|account[_-]?id)\s*[=:]\s*["']?(\d{12})["']?/gi,
    description: 'AWS Account ID — 12-digit account identifier',
  },
];

// ─────────────────────────── Google ───────────────────────────────────────────

const GOOGLE_RULES = [
  {
    id: 'google-api-key',
    type: 'Google API Key',
    category: 'google',
    severity: 'high',
    confidence: 0.95,
    pattern: /AIza[0-9A-Za-z\-_]{35}/g,
    description: 'Google Cloud API Key',
  },
  {
    id: 'google-oauth-token',
    type: 'Google OAuth Token',
    category: 'google',
    severity: 'high',
    confidence: 0.90,
    pattern: /ya29\.[0-9A-Za-z\-_]+/g,
    description: 'Google OAuth 2.0 Access Token',
  },
  {
    id: 'google-service-account',
    type: 'Google Service Account',
    category: 'google',
    severity: 'critical',
    confidence: 0.95,
    pattern: /"type"\s*:\s*"service_account"/gi,
    description: 'Google Cloud Service Account JSON key file indicator',
  },
];

// ─────────────────────────── GitHub ───────────────────────────────────────────

const GITHUB_RULES = [
  {
    id: 'github-pat-classic',
    type: 'GitHub Personal Access Token (Classic)',
    category: 'github',
    severity: 'critical',
    confidence: 0.99,
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    description: 'GitHub Personal Access Token (Classic)',
  },
  {
    id: 'github-pat-fine-grained',
    type: 'GitHub Fine-grained PAT',
    category: 'github',
    severity: 'critical',
    confidence: 0.99,
    pattern: /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g,
    description: 'GitHub Fine-grained Personal Access Token',
  },
  {
    id: 'github-oauth-token',
    type: 'GitHub OAuth Token',
    category: 'github',
    severity: 'high',
    confidence: 0.99,
    pattern: /gho_[A-Za-z0-9]{36}/g,
    description: 'GitHub OAuth Access Token',
  },
  {
    id: 'github-app-token',
    type: 'GitHub App Token',
    category: 'github',
    severity: 'high',
    confidence: 0.99,
    pattern: /(?:ghu|ghs)_[A-Za-z0-9]{36}/g,
    description: 'GitHub App Installation / User Access Token',
  },
  {
    id: 'github-refresh-token',
    type: 'GitHub Refresh Token',
    category: 'github',
    severity: 'high',
    confidence: 0.99,
    pattern: /ghr_[A-Za-z0-9]{36}/g,
    description: 'GitHub Refresh Token',
  },
];

// ─────────────────────────── JWT ──────────────────────────────────────────────

const JWT_RULES = [
  {
    id: 'jwt-token',
    type: 'JWT Token',
    category: 'jwt',
    severity: 'high',
    confidence: 0.95,
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/g,
    description: 'JSON Web Token (JWT) — may encode sensitive session data',
  },
  {
    id: 'jwt-secret',
    type: 'JWT Secret',
    category: 'jwt',
    severity: 'critical',
    confidence: 0.85,
    pattern: /(?:jwt[_-]?secret|jwt[_-]?key)\s*[=:]\s*["']?([A-Za-z0-9+/=]{20,})["']?/gi,
    description: 'JWT Signing Secret / Key hardcoded in source',
  },
];

// ─────────────────────────── Private Keys ─────────────────────────────────────

const PRIVATE_KEY_RULES = [
  {
    id: 'rsa-private-key',
    type: 'RSA Private Key',
    category: 'private_key',
    severity: 'critical',
    confidence: 0.99,
    pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/g,
    description: 'RSA Private Key',
  },
  {
    id: 'openssh-private-key',
    type: 'OpenSSH Private Key',
    category: 'private_key',
    severity: 'critical',
    confidence: 0.99,
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----/g,
    description: 'OpenSSH Private Key',
  },
  {
    id: 'ec-private-key',
    type: 'EC Private Key',
    category: 'private_key',
    severity: 'critical',
    confidence: 0.99,
    pattern: /-----BEGIN EC PRIVATE KEY-----[\s\S]+?-----END EC PRIVATE KEY-----/g,
    description: 'Elliptic Curve Private Key',
  },
  {
    id: 'pgp-private-key',
    type: 'PGP Private Key',
    category: 'private_key',
    severity: 'critical',
    confidence: 0.99,
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----/g,
    description: 'PGP Private Key Block',
  },
];

// ─────────────────────────── Database ─────────────────────────────────────────

const DATABASE_RULES = [
  {
    id: 'postgres-connection',
    type: 'PostgreSQL Connection String',
    category: 'database',
    severity: 'critical',
    confidence: 0.95,
    pattern: /postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>]+@[^\s"'<>]+/gi,
    description: 'PostgreSQL connection string with embedded credentials',
  },
  {
    id: 'mysql-connection',
    type: 'MySQL Connection String',
    category: 'database',
    severity: 'critical',
    confidence: 0.95,
    pattern: /mysql:\/\/[^\s"'<>]+:[^\s"'<>]+@[^\s"'<>]+/gi,
    description: 'MySQL connection string with embedded credentials',
  },
  {
    id: 'mongodb-connection',
    type: 'MongoDB Connection String',
    category: 'database',
    severity: 'critical',
    confidence: 0.95,
    pattern: /mongodb(?:\+srv)?:\/\/[^\s"'<>]+:[^\s"'<>]+@[^\s"'<>]+/gi,
    description: 'MongoDB connection string with embedded credentials',
  },
  {
    id: 'redis-connection',
    type: 'Redis Connection String',
    category: 'database',
    severity: 'high',
    confidence: 0.90,
    pattern: /redis:\/\/[^\s"'<>]+:[^\s"'<>]+@[^\s"'<>]+/gi,
    description: 'Redis connection string with embedded credentials',
  },
];

// ─────────────────────────── Passwords ────────────────────────────────────────

const PASSWORD_RULES = [
  {
    id: 'hardcoded-password',
    type: 'Hardcoded Password',
    category: 'password',
    severity: 'high',
    confidence: 0.70,
    pattern: /(?:password|passwd|pwd|pass)\s*[=:]\s*["']([^"']{8,})["']/gi,
    description: 'Hardcoded password value in source code',
    falsePositives: [
      /password\s*[=:]\s*["']?\s*$/i,           // empty
      /password\s*[=:]\s*["']?password["']?/i,   // password = password
      /password\s*[=:]\s*["']?\*+["']?/i,        // masked
      /password\s*[=:]\s*["']?your[_-]?password/i,
      /password\s*[=:]\s*["']?example/i,
      /password\s*[=:]\s*["']?<[^>]+>/i,         // HTML placeholder
    ],
  },
  {
    id: 'hardcoded-secret-key',
    type: 'Hardcoded Secret Key',
    category: 'password',
    severity: 'high',
    confidence: 0.75,
    pattern: /(?:secret[_-]?key|api[_-]?secret)\s*[=:]\s*["']([^"']{16,})["']/gi,
    description: 'Hardcoded secret key value in source code',
  },
];

// ─────────────────────────── API Keys ─────────────────────────────────────────

const API_KEY_RULES = [
  {
    id: 'stripe-key',
    type: 'Stripe API Key',
    category: 'api_key',
    severity: 'critical',
    confidence: 0.99,
    pattern: /(?:sk_live|sk_test|pk_live|pk_test)_[A-Za-z0-9]{24,}/g,
    description: 'Stripe Live / Test API Key',
  },
  {
    id: 'slack-token',
    type: 'Slack Token',
    category: 'api_key',
    severity: 'high',
    confidence: 0.95,
    pattern: /xox[baprs]-[0-9]+-[A-Za-z0-9-]+/g,
    description: 'Slack Bot / App / User Token',
  },
  {
    id: 'slack-webhook',
    type: 'Slack Webhook URL',
    category: 'api_key',
    severity: 'high',
    confidence: 0.99,
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g,
    description: 'Slack Incoming Webhook URL',
  },
  {
    id: 'sendgrid-key',
    type: 'SendGrid API Key',
    category: 'api_key',
    severity: 'high',
    confidence: 0.99,
    pattern: /SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    description: 'SendGrid API Key',
  },
  {
    id: 'npm-token',
    type: 'NPM Access Token',
    category: 'api_key',
    severity: 'critical',
    confidence: 0.99,
    pattern: /npm_[A-Za-z0-9]{36}/g,
    description: 'NPM Access Token — allows publishing packages',
  },
  {
    id: 'twilio-key',
    type: 'Twilio API Key',
    category: 'api_key',
    severity: 'high',
    confidence: 0.90,
    pattern: /SK[a-z0-9]{32}/g,
    description: 'Twilio API Key SID',
  },
  {
    id: 'generic-api-key',
    type: 'Generic API Key',
    category: 'api_key',
    severity: 'medium',
    confidence: 0.60,
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*["']([A-Za-z0-9_\-]{20,})["']/gi,
    description: 'Generic API key assignment in source code',
  },
];

// ─────────────────────────── OAuth ────────────────────────────────────────────

const OAUTH_RULES = [
  {
    id: 'oauth-client-secret',
    type: 'OAuth Client Secret',
    category: 'oauth',
    severity: 'high',
    confidence: 0.75,
    pattern: /(?:client[_-]?secret|oauth[_-]?secret)\s*[=:]\s*["']([A-Za-z0-9_\-]{20,})["']/gi,
    description: 'OAuth 2.0 Client Secret hardcoded in source',
  },
  {
    id: 'facebook-token',
    type: 'Facebook Access Token',
    category: 'oauth',
    severity: 'high',
    confidence: 0.90,
    pattern: /EAA[A-Za-z0-9]{100,}/g,
    description: 'Facebook / Meta OAuth Access Token',
  },
];

// ─────────────────────────── Azure ────────────────────────────────────────────

const AZURE_RULES = [
  {
    id: 'azure-storage-key',
    type: 'Azure Storage Account Key',
    category: 'azure',
    severity: 'critical',
    confidence: 0.95,
    pattern: /DefaultEndpointsProtocol=https;AccountName=[A-Za-z0-9]+;AccountKey=[A-Za-z0-9+/=]{88}/gi,
    description: 'Azure Storage Account Connection String',
  },
  {
    id: 'azure-client-secret',
    type: 'Azure AD Client Secret',
    category: 'azure',
    severity: 'high',
    confidence: 0.70,
    pattern: /(?:client_secret|clientsecret)\s*[=:]\s*["']?([a-zA-Z0-9~._\-]{34,})["']?/gi,
    description: 'Azure Active Directory Client Secret',
  },
];

// ─────────────────────────── All rules ────────────────────────────────────────

/**
 * All detection rules, combined and flattened.
 * Each rule's `pattern` RegExp MUST have the `g` flag so that
 * exec() / matchAll() re-enters on subsequent calls.
 * @type {Rule[]}
 */
const ALL_RULES = [
  ...AWS_RULES,
  ...GOOGLE_RULES,
  ...GITHUB_RULES,
  ...JWT_RULES,
  ...PRIVATE_KEY_RULES,
  ...DATABASE_RULES,
  ...PASSWORD_RULES,
  ...API_KEY_RULES,
  ...OAUTH_RULES,
  ...AZURE_RULES,
];

module.exports = { ALL_RULES };
