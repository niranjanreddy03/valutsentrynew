/**
 * Test fixture — intentionally contains FAKE secrets for scanner validation.
 * Do NOT use any of these values in production.
 * NOTE: These are literal code-style assignments so the scanner regex can match them.
 */

// AWS Access Key (fake) — direct identifier, not in a string
const AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';

// AWS Secret Access Key (fake) — env-var style assignment
// aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

// GitHub PAT (fake)
const GITHUB_TOKEN = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12';

// JWT Token (fake)
const JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// Hardcoded password (fake) — actual JS assignment that regex can match
const password = "Sup3rS3cr3tPassw0rd";

// Generic API key (fake) — actual assignment
const api_key = "AbCdEfGhIjKlMnOpQrStUvWx1234";

// Stripe key (fake) — actual value
const stripeKey = 'sk_live_51ABCDEFGHIJKLMNOPQRSTUVWXYZtest123456789';

// Slack webhook (fake)
const slackWebhook = 'https://hooks.slack.com/services/TABCDEF123/BABCDEF456/xxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// PostgreSQL DSN (fake)
const dbUrl = 'postgres://admin:SecretPass123@db.example.com:5432/mydb';

// NPM token (fake)
const npmToken = 'npm_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12';

// SendGrid key (fake)
const sgKey = 'SG.ABCDEFGHIJKLMNOPQRSTUVWX.YZABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// JWT Secret (fake) — actual assignment
const jwt_secret = "my-super-long-jwt-signing-secret-value-here-xyz";

module.exports = {};

