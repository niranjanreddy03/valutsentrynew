# VaultSentry — Node.js Secret Scanning Engine

A production-grade, async, rule-based secret scanning engine for VaultSentry written in pure Node.js v16+. It requires **zero mandatory dependencies** (only the optional `ignore` package for `.gitignore` support).

---

## File Structure

```
scanner/
├── rules.js              # All detection rules (regex patterns + metadata)
├── scanner.js            # File-level scanning logic
├── directoryScanner.js   # Recursive async directory traversal
├── logger.js             # Minimal structured logger
├── main.js               # CLI entry point
├── package.json          # NPM manifest
└── test/
    ├── scanner.test.js   # Full test suite (no external framework)
    └── fixtures/
        └── fake_secrets.js  # Intentionally fake secrets for testing
```

---

## Quick Start

```bash
# From the scanner/ directory:
npm install           # Installs optional 'ignore' package

# Scan a directory
node main.js ./path/to/project

# Scan with options
node main.js --min-severity high --output results.json /path/to/repo

# Run tests
npm test
```

---

## CLI Options

| Flag                   | Default  | Description                                            |
|------------------------|----------|--------------------------------------------------------|
| `--output <file>`      | stdout   | Write JSON results to a file                           |
| `--no-mask`            | —        | Expose full secret values ⚠️                           |
| `--no-gitignore`       | —        | Disable `.gitignore` rule parsing                      |
| `--concurrency <n>`    | 10       | Parallel file scan workers                             |
| `--min-severity <lvl>` | low      | Filter: `critical` \| `high` \| `medium` \| `low`     |
| `--summary-only`       | —        | Print only the summary, not the findings array         |
| `--quiet`              | —        | Suppress progress bar (stderr)                         |
| `--help`               | —        | Show help                                              |

**Environment variable**: `LOG_LEVEL=debug|info|warn|error` (default: `info`)

---

## Output Format

```json
{
  "scanId": "scan-196a...",
  "target": "/absolute/path/to/project",
  "startedAt": "2026-03-27T10:00:00.000Z",
  "completedAt": "2026-03-27T10:00:00.046Z",
  "durationMs": 46,
  "summary": {
    "filesScanned": 42,
    "filesSkipped": 3,
    "totalIssues": 5,
    "bySeverity": {
      "critical": 2,
      "high": 2,
      "medium": 1,
      "low": 0
    }
  },
  "errors": [],
  "findings": [
    {
      "type": "AWS Access Key ID",
      "severity": "critical",
      "file": "src/config.js",
      "line": 12,
      "value": "AKIA****AMPLE",
      "maskedValue": "AKIA****AMPLE",
      "category": "aws",
      "ruleId": "aws-access-key-id",
      "confidence": 0.95,
      "isTestFile": false,
      "hash": "sha256-of-raw-value",
      "snippet": "11: // config\n12: const key = 'AKIAIOSFODNN7EXAMPLE';\n13: module.exports = { key };"
    }
  ]
}
```

---

## Detection Rules

| Category     | Rules                                               | Severity          |
|--------------|------------------------------------------------------|-------------------|
| AWS          | Access Key, Secret Key, Session Token, Account ID    | Critical – Medium |
| GitHub       | PAT (classic), PAT (fine-grained), OAuth, App tokens | Critical – High   |
| JWT          | JWT Tokens, JWT Signing Secrets                      | Critical – High   |
| Private Keys | RSA, OpenSSH, EC, PGP                                | Critical          |
| Databases    | PostgreSQL, MySQL, MongoDB, Redis DSNs               | Critical – High   |
| Passwords    | Hardcoded passwords, secret key variables            | High              |
| API Keys     | Stripe, Slack, SendGrid, NPM, Twilio, Generic        | Critical – Medium |
| OAuth        | Client secrets, Facebook tokens                      | High              |
| Google       | API keys, OAuth tokens, Service Account files        | Critical – High   |
| Azure        | Storage account keys, AD client secrets              | Critical – High   |

---

## Production Features

| Feature                        | Details                                                                 |
|--------------------------------|-------------------------------------------------------------------------|
| **Async / await**              | All I/O is non-blocking; concurrency controlled via worker pool         |
| **Deduplication**              | Per-file and global dedup by SHA-256 of rule+value+location             |
| **Value masking**              | Shows first/last 4 chars; full value only with `--no-mask`              |
| **Binary file detection**      | Extension allowlist + NULL byte sniff                                   |
| **Large file skipping**        | Default 2 MB limit per file                                             |
| **`.gitignore` support**       | Via the `ignore` npm package (graceful degradation if not installed)    |
| **False positive filtering**   | Per-rule regex lists that suppress common noise                         |
| **Test-file flagging**         | Findings in `test/`, `spec/`, `fixture/` etc. are flagged `isTestFile` |
| **Severity sorting**           | Findings sorted critical → high → medium → low                         |
| **Structured logging**         | Colorized, level-gated, always on stderr so stdout stays clean JSON     |
| **Exit codes**                 | `0` = clean, `1` = critical/high findings found (CI-friendly)           |

---

## Programmatic API

```js
const { scanDirectory } = require('./directoryScanner');
const { scanFile }      = require('./scanner');

// Scan a whole directory
const summary = await scanDirectory('/path/to/project', {
  maskValues:    true,      // mask secrets in output
  useGitignore:  true,      // honour .gitignore
  concurrency:   10,        // parallel workers
  onProgress: (done, total, file) => console.log(`${done}/${total}: ${file}`),
});

console.log(summary.findings);  // Finding[]
console.log(summary.totalIssues);

// Scan a single file
const findings = await scanFile('/path/to/file.js', { maskValues: true });
```

---

## Exit Codes

| Code | Meaning                                              |
|------|------------------------------------------------------|
| `0`  | Scan complete, no critical or high findings          |
| `1`  | Scan complete, critical or high findings detected    |
| `1`  | Fatal error (file not found, invalid directory, …)   |

This makes the scanner CI/CD-pipeline friendly — you can block deployments on non-zero exit.
