# 🔒 Vault Sentry

<div align="center">

![Vault Sentry](https://img.shields.io/badge/Secret-Sentry-00d4ff?style=for-the-badge&logo=shield&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Python](https://img.shields.io/badge/python-3.11+-blue?style=for-the-badge&logo=python&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript&logoColor=white)

**Automatically scan your code repositories, cloud storage, and CI/CD pipelines to detect exposed API keys, credentials, secrets, and sensitive configuration files.**

[Features](#-features) • [Quick Start](#-quick-start) • [Installation](#-installation) • [Usage](#-usage) • [API](#-api-reference) • [Contributing](#-contributing)

</div>

---

## 🌟 Features

### 🔍 Comprehensive Secret Detection
- **100+ built-in patterns** for AWS, Google Cloud, Azure, GitHub, GitLab, Stripe, and more
- **Entropy-based detection** to catch high-randomness strings that might be secrets
- **Custom pattern support** - define your own regex patterns for proprietary secrets
- **Multi-format scanning** - JSON, YAML, .env files, code files, and more
- **External scanner integration** - TruffleHog, Gitleaks, and custom rules engines

### 🧠 ML-Driven Prioritization
- **XGBoost & Random Forest models** for intelligent risk scoring
- **Business Impact Score** - Factors in environment, data classification, and team ownership
- **Confidence scoring** - ML-powered detection confidence for each finding
- **False positive reduction** - Learn from your feedback to reduce noise
- **Automatic model retraining** - Continuously improve detection accuracy

### ⚡ Automated Remediation
- **Auto-rotation hooks** for AWS IAM keys, Stripe API keys, and GitHub tokens
- **Secret lifecycle tracking** - MTTR, SLA monitoring, and aging reports
- **Policy engine** - Define custom rules for automatic actions
- **Integration with secrets managers** - AWS Secrets Manager, HashiCorp Vault

### 🚀 Multi-Platform Integration
- **GitHub Integration** - Direct repository scanning via GitHub Apps with PR checks
- **GitLab Support** - Scan GitLab repositories with personal access tokens  
- **AWS S3 Scanning** - Scan files stored in S3 buckets
- **CI/CD Integration** - GitHub Actions, GitLab CI, Jenkins, CircleCI
- **Webhooks** - Automatic scanning on push events
- **Slack Integration** - Real-time alerts, interactive actions, and slash commands
- **Jira Integration** - Automatic ticket creation and status synchronization

### 📊 Modern Dashboard
- **Real-time monitoring** with WebSocket updates
- **Risk distribution charts** and trend analysis
- **Repository management** interface
- **Alert management** with Slack/Email notifications
- **Export reports** in PDF, CSV, and JSON formats

### 🛡️ Enterprise Features
- **Role-based access control** (Admin, Developer, Viewer)
- **API key management** for programmatic access
- **Audit logging** for compliance
- **Rate limiting** and security headers
- **Docker & Kubernetes ready**

---

## 🚀 Quick Start

### Single Command (Recommended)

```bash
# Clone the repository
git clone https://github.com/niranjanreddy03/secret-sentry.git
cd secret-sentry

# Install all dependencies
npm run install:all

# Start both frontend & backend
npm run dev

# Or on Windows, just run:
start.bat
```

This starts:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

### Using Docker

```bash
# Clone the repository
git clone https://github.com/niranjanreddy03/secret-sentry.git
cd secret-sentry

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Access the dashboard
open http://localhost:3000
```

### Using the CLI

```bash
# Install the CLI
pip install VaultSentry

# Scan current directory
VaultSentry scan .

# Scan with JSON output
VaultSentry scan ./src -f json -o results.json

# Scan with minimum severity
VaultSentry scan . --severity high
```

---

## 📦 Installation

### Prerequisites

- **Python 3.11+** (for backend and CLI)
- **Node.js 20+** (for frontend)
- **PostgreSQL 15+** (database)
- **Redis 7+** (caching and task queue)
- **Docker** (optional, for containerized deployment)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/VaultSentry"
export REDIS_URL="redis://localhost:6379/0"
export SECRET_KEY="your-secret-key-min-32-chars"

# Run database migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
export NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"

# Start development server
npm run dev
```

### CLI Installation

```bash
cd cli

# Install in development mode
pip install -e .

# Or install from PyPI (when published)
pip install VaultSentry
```

---

## 📖 Usage

### CLI Commands

#### Scan a Directory

```bash
# Basic scan
VaultSentry scan /path/to/code

# Scan with options
VaultSentry scan . \
  --format json \
  --output results.json \
  --severity high \
  --verbose

# Generate SARIF report
VaultSentry scan . -f sarif -o report.sarif
```

#### Configuration

```bash
# Show current config
VaultSentry config show

# Set API key for cloud scanning
VaultSentry config set --key api_key --value YOUR_API_KEY

# Set custom ignore patterns
VaultSentry config set --key ignore_patterns --value "*.test.js,coverage/**"
```

### API Usage

#### Authentication

```bash
# Login and get access token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@VaultSentry.io&password=admin123"

# Response:
# {
#   "access_token": "eyJ...",
#   "refresh_token": "eyJ...",
#   "token_type": "bearer"
# }
```

#### Scan a Repository

```bash
# Create repository
curl -X POST http://localhost:8000/api/v1/repositories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-repo",
    "url": "https://github.com/org/repo",
    "type": "github",
    "branch": "main"
  }'

# Trigger scan
curl -X POST http://localhost:8000/api/v1/scans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repository_id": 1
  }'

# Get scan results
curl http://localhost:8000/api/v1/scans/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Dashboard Features

1. **Dashboard Overview**
   - Total scans and secrets statistics
   - Risk distribution pie chart
   - Scan activity timeline
   - Recent scans and alerts

2. **Repository Management**
   - Add/remove repositories
   - Configure scanning schedules
   - View per-repository statistics

3. **Secrets Management**
   - View all detected secrets
   - Filter by risk level, type, repository
   - Mark as resolved/ignored
   - Export to various formats

4. **Alerts & Notifications**
   - Configure Slack webhooks
   - Email notifications for critical findings
   - Custom alert rules

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT signing key (min 32 chars) | Required |
| `GITHUB_APP_ID` | GitHub App ID for integration | Optional |
| `GITHUB_PRIVATE_KEY` | GitHub App private key | Optional |
| `AWS_ACCESS_KEY_ID` | AWS credentials for S3 scanning | Optional |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Optional |
| `SLACK_WEBHOOK_URL` | Slack notification webhook | Optional |
| `SMTP_HOST` | Email server for notifications | Optional |

### Custom Patterns

Add custom detection patterns via the API or dashboard:

```json
{
  "name": "Internal API Key",
  "description": "Detect internal service API keys",
  "pattern": "internal_api_[a-zA-Z0-9]{32}",
  "pattern_type": "regex",
  "risk_level": "high"
}
```

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Vault Sentry PLATFORM                           │
│                    Enterprise Secret Detection & Remediation                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                    │
│   │   Web UI    │    │     CLI     │    │   CI/CD     │                    │
│   │  Dashboard  │    │   Client    │    │  Webhooks   │                    │
│   │ (Next.js)   │    │  (Python)   │    │  (GitHub)   │                    │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                    │
│          │                  │                   │                           │
│          └────────────────┬─┴───────────────────┘                           │
│                           │                                                  │
│                    ┌──────▼──────┐                                          │
│                    │   NGINX     │                                          │
│                    │   Reverse   │                                          │
│                    │   Proxy     │                                          │
│                    └──────┬──────┘                                          │
│                           │                                                  │
│              ┌────────────▼────────────┐                                    │
│              │     FastAPI Backend     │                                    │
│              │    (REST API Server)    │                                    │
│              │   - JWT Authentication  │                                    │
│              │   - RBAC Authorization  │                                    │
│              │   - Policy Engine       │                                    │
│              └────────────┬────────────┘                                    │
│                           │                                                  │
│   ┌───────────────────────┼───────────────────────┐                         │
│   │                       │                       │                         │
│   ▼                       ▼                       ▼                         │
│ ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────────────┐   │
│ │ PostgreSQL  │   │   Redis     │   │       Celery Workers            │   │
│ │  Database   │   │   Cache     │   │   (3 Dedicated Queues)          │   │
│ │             │   │  & Queue    │   │                                 │   │
│ │ - Users     │   │             │   │  ┌─────────────────────────┐   │   │
│ │ - Repos     │   │ - Sessions  │   │  │ scan_queue              │   │   │
│ │ - Scans     │   │ - Rate Lim  │   │  │ - Repository scans      │   │   │
│ │ - Secrets   │   │ - Job Queue │   │  │ - CI/CD artifact scans  │   │   │
│ │ - Policies  │   │             │   │  │ - PR scanning           │   │   │
│ └─────────────┘   └─────────────┘   │  └─────────────────────────┘   │   │
│                                     │  ┌─────────────────────────┐   │   │
│                                     │  │ alert_queue             │   │   │
│                                     │  │ - Slack notifications   │   │   │
│                                     │  │ - Jira ticket creation  │   │   │
│                                     │  │ - Email alerts          │   │   │
│                                     │  └─────────────────────────┘   │   │
│                                     │  ┌─────────────────────────┐   │   │
│                                     │  │ ml_queue                │   │   │
│                                     │  │ - Model retraining      │   │   │
│                                     │  │ - Batch risk scoring    │   │   │
│                                     │  │ - Risk report generation│   │   │
│                                     │  └─────────────────────────┘   │   │
│                                     └─────────────────────────────────┘   │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                     Detection & ML Pipeline                        │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│   │  │ Built-in │  │Trufflehog│  │ Gitleaks │  │ Custom Rules     │   │  │
│   │  │ Patterns │  │ Scanner  │  │ Scanner  │  │ Engine           │   │  │
│   │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │  │
│   │       └──────────────┴──────────────┴───────────────┘             │  │
│   │                              │                                     │  │
│   │                       ┌──────▼──────┐                             │  │
│   │                       │ ML Risk     │                             │  │
│   │                       │ Scorer      │                             │  │
│   │                       │ (XGBoost/RF)│                             │  │
│   │                       └──────┬──────┘                             │  │
│   │                              ▼                                     │  │
│   │   ┌────────────────────────────────────────────────────────┐      │  │
│   │   │ Lifecycle Manager: SLA Tracking, MTTR, Auto-Rotation   │      │  │
│   │   └────────────────────────────────────────────────────────┘      │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                       Integrations                                 │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │  │
│   │  │  Slack   │  │   Jira   │  │  GitHub  │  │ Auto-Rotation    │   │  │
│   │  │ Webhooks │  │  Issues  │  │ PR/Checks│  │ (AWS/Stripe/etc) │   │  │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Request Flow Diagram

```
   ┌────────┐     ┌───────────┐     ┌─────────┐     ┌─────────┐     ┌──────────┐     ┌───────┐
   │  USER  │────▶│ DASHBOARD │────▶│   API   │────▶│ SCANNER │────▶│ DATABASE │────▶│ ALERT │
   └────────┘     └───────────┘     └─────────┘     └─────────┘     └──────────┘     └───────┘
        │              │                 │               │               │               │
        │   1. Login   │                 │               │               │               │
        │─────────────▶│                 │               │               │               │
        │              │  2. Authenticate│               │               │               │
        │              │────────────────▶│               │               │               │
        │              │                 │ 3. Validate   │               │               │
        │              │                 │──────────────▶│               │               │
        │              │    JWT Token    │               │               │               │
        │◀─────────────│◀────────────────│               │               │               │
        │              │                 │               │               │               │
        │ 4. Scan Repo │                 │               │               │               │
        │─────────────▶│                 │               │               │               │
        │              │ 5. POST /scans  │               │               │               │
        │              │────────────────▶│               │               │               │
        │              │                 │ 6. Queue Job  │               │               │
        │              │                 │──────────────▶│               │               │
        │              │                 │               │ 7. Scan Files │               │
        │              │                 │               │───────────────│               │
        │              │                 │               │               │               │
        │              │                 │               │ 8. Store Results              │
        │              │                 │               │──────────────▶│               │
        │              │                 │               │               │               │
        │              │                 │               │               │ 9. Send Alert │
        │              │                 │               │               │──────────────▶│
        │              │                 │               │               │               │
        │              │ 10. Poll Status │               │               │               │
        │              │────────────────▶│               │               │               │
        │              │                 │ 11. Get Results               │               │
        │              │                 │──────────────────────────────▶│               │
        │              │ 12. Display Results             │               │               │
        │◀─────────────│◀────────────────│               │               │               │
        │              │                 │               │               │               │
```

### Component Description

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Web Dashboard** | Next.js 14, Tailwind CSS, Recharts | User interface for monitoring, configuration, and reporting |
| **CLI Client** | Python, Rich, Click | Command-line scanning and CI/CD integration |
| **API Server** | FastAPI, Pydantic, SQLAlchemy | RESTful API, authentication, authorization |
| **Scanner Engine** | Python, Regex, Shannon Entropy | Secret detection using pattern matching and entropy analysis |
| **S3 Scanner** | boto3, asyncio | Scan AWS S3 buckets for exposed secrets |
| **Env Analyzer** | Python | Analyze .env files and environment configurations |
| **Database** | PostgreSQL 15 | Persistent storage for users, scans, secrets, alerts |
| **Cache/Queue** | Redis 7 | Session caching, rate limiting, job queue |
| **Workers** | Celery | Background task processing for scans |
| **Alert System** | SMTP, Slack API, Webhooks | Real-time notifications for security events |

### Data Flow

1. **User Authentication**: User logs in via Dashboard → API validates credentials → JWT token issued
2. **Repository Addition**: User adds repo → API stores config → Webhook configured (if GitHub)
3. **Scan Execution**: Scan triggered → Job queued to Redis → Celery worker processes → Results stored in PostgreSQL
4. **Secret Detection**: Scanner analyzes files → Pattern matching + Entropy analysis → Findings categorized by risk
5. **Alert Dispatch**: High-risk findings detected → Alert system notifies via configured channels
6. **Report Generation**: User requests report → API aggregates data → PDF generated and delivered

---

## 📊 API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/login` | POST | Login with email/password |
| `/api/v1/auth/logout` | POST | Invalidate current token |
| `/api/v1/auth/refresh` | POST | Refresh access token |
| `/api/v1/auth/register` | POST | Register new user |

### Repositories

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/repositories` | GET | List all repositories |
| `/api/v1/repositories` | POST | Add new repository |
| `/api/v1/repositories/{id}` | GET | Get repository details |
| `/api/v1/repositories/{id}` | PUT | Update repository |
| `/api/v1/repositories/{id}` | DELETE | Remove repository |
| `/api/v1/repositories/{id}/sync` | POST | Sync repository |

### Scans

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/scans` | GET | List all scans |
| `/api/v1/scans` | POST | Start new scan |
| `/api/v1/scans/{id}` | GET | Get scan details |
| `/api/v1/scans/{id}/cancel` | POST | Cancel running scan |
| `/api/v1/scans/{id}/progress` | GET | Get scan progress |

### Secrets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/secrets` | GET | List all secrets |
| `/api/v1/secrets/{id}` | GET | Get secret details |
| `/api/v1/secrets/{id}/resolve` | POST | Mark as resolved |
| `/api/v1/secrets/{id}/ignore` | POST | Mark as ignored |

### Dashboard

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/dashboard/stats` | GET | Get dashboard statistics |
| `/api/v1/dashboard/risk-distribution` | GET | Get risk breakdown |
| `/api/v1/dashboard/scan-activity` | GET | Get scan history |

---

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test file
pytest tests/test_scanner.py -v
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

---

## 🚢 Deployment

### Docker Compose (Development)

```bash
docker-compose up -d
```

### Docker Compose (Production)

```bash
docker-compose --profile production up -d
```

### Kubernetes

```bash
# Apply configurations
kubectl apply -f k8s/

# Or use Helm
helm install secret-sentry ./helm/secret-sentry
```

### AWS ECS

Refer to the `terraform/` directory for AWS infrastructure templates.

---

## 📁 Project Structure

```
secret-sentry/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── api/v1/endpoints/  # API route handlers
│   │   ├── core/              # Core configuration
│   │   ├── models/            # SQLAlchemy models
│   │   ├── scanner/           # Secret detection engine
│   │   └── middleware/        # Custom middleware
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── app/               # App router pages
│   │   ├── components/        # React components
│   │   └── lib/               # Utilities & API client
│   ├── Dockerfile
│   └── package.json
├── cli/                        # Command Line Interface
│   ├── VaultSentry.py
│   └── setup.py
├── docker/                     # Docker configs
│   ├── nginx/
│   └── init-db.sql
├── .github/workflows/          # CI/CD pipelines
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/), [Next.js](https://nextjs.org/), and [Tailwind CSS](https://tailwindcss.com/)
- Inspired by tools like [TruffleHog](https://github.com/trufflesecurity/trufflehog) and [GitLeaks](https://github.com/gitleaks/gitleaks)
- Icons by [Lucide](https://lucide.dev/)

---

<div align="center">

**[⬆ Back to Top](#-secret-sentry)**

Made with ❤️ by the Vault Sentry Team

</div>
