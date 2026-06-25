import Link from "next/link"
import { Icon } from "./components"
import InteractiveBg from "./InteractiveBg"

const features = [
  {
    icon: "folder_shared",
    title: "Repository Scanning",
    desc: "Connect GitHub, GitLab, or Bitbucket repositories and scan every branch and commit for exposed secrets. Supports monorepos, private repos, and organization-wide bulk scans.",
    href: "/repositories",
    tag: "CORE",
  },
  {
    icon: "cloud",
    title: "S3 Bucket Scanning",
    desc: "Scan AWS S3 buckets for exposed credentials, config files with hardcoded secrets, and sensitive data leaks in cloud storage assets.",
    href: "/s3-buckets",
    tag: "CLOUD",
  },
  {
    icon: "radar",
    title: "Scan Engine",
    desc: "High-performance scanner combining regex pattern matching, Shannon entropy analysis, and custom detection rules. Scheduled and on-demand scan modes.",
    href: "/scans",
    tag: "ENGINE",
  },
  {
    icon: "bug_report",
    title: "Findings Triage",
    desc: "Review detected secrets by severity, source file, commit context, and status. Mask sensitive values, bulk-resolve false positives, and track remediation progress.",
    href: "/secrets",
    tag: "TRIAGE",
  },
  {
    icon: "sync",
    title: "Closed-Loop Remediation",
    desc: "Track the full lifecycle from detection through key rotation, code review, and resolution. Automated verification confirms secrets are actually revoked.",
    href: "/closed-loop",
    tag: "REMEDIATION",
  },
  {
    icon: "psychology",
    title: "ML-Powered Insights",
    desc: "Surface risk signals and model-assisted prioritization. Identify patterns across your organization to predict where the next exposure is likely to occur.",
    href: "/insights",
    tag: "AI",
  },
  {
    icon: "description",
    title: "Reports & Exports",
    desc: "Generate compliance-ready PDF reports, CSV exports, and JSON data dumps. Full repository reports, scan summaries, and executive dashboards.",
    href: "/reports",
    tag: "REPORTS",
  },
  {
    icon: "notifications_active",
    title: "Real-Time Alerts",
    desc: "Instant Slack, email, and webhook notifications when critical secrets are detected. Configurable severity thresholds and routing rules.",
    href: "/alerts",
    tag: "ALERTS",
  },
  {
    icon: "policy",
    title: "Custom Policies",
    desc: "Define custom detection patterns, allowlists, and response rules. Enforce organization-wide security policies across all scan targets.",
    href: "/policies",
    tag: "POLICY",
  },
  {
    icon: "extension",
    title: "Integrations",
    desc: "Connect Git providers, CI/CD pipelines, Slack workspaces, and webhook endpoints. Native GitHub Actions and GitLab CI support.",
    href: "/integrations",
    tag: "INTEGRATIONS",
  },
  {
    icon: "groups",
    title: "Team Management",
    desc: "Invite teammates, assign roles, manage workspace access, and enforce least-privilege principles across your security operations team.",
    href: "/teams",
    tag: "TEAMS",
  },
  {
    icon: "history",
    title: "Audit Logs",
    desc: "Complete audit trail of every security-relevant event: scans triggered, findings resolved, settings changed, and team access modifications.",
    href: "/audit",
    tag: "AUDIT",
  },
]

export default function LandingPage() {
  return (
    <main className="landing-v2" style={{ position: "relative" }}>
      <InteractiveBg />
      <div style={{ position: "relative", zIndex: 1 }}>
      {/* ═══ NAVIGATION ════════════════════════════════════════════════ */}
      <header className="landing-v2-nav">
        <div className="nav-inner">
          <div className="nav-left">
            <Link href="/" className="nav-brand">TheVaultSentry</Link>
            <nav className="nav-links">
              <a href="#features">Features</a>
              <a href="#workflow">Workflow</a>
              <Link href="/pricing">Pricing</Link>
              <a href="#capabilities">Docs</a>
            </nav>
          </div>
          <div className="nav-right">
            <div className="nav-search">
              <Icon>search</Icon>
              <input placeholder="Quick search..." type="text" readOnly />
            </div>
            <Link href="/login" className="nav-link-btn">Login</Link>
            <Link href="/register" className="nav-cta-btn">Start for Free</Link>
          </div>
        </div>
      </header>

      {/* ═══ HERO SECTION ══════════════════════════════════════════════ */}
      <section className="hero-v2">
        <div className="hero-v2-inner">
          <div className="hero-v2-copy">
            <div className="hero-badges">
              <span className="mono-pill">DEVSECOPS PLATFORM</span>
              <span className="eyebrow inline"><span className="status-dot" /> Enterprise Ready</span>
            </div>
            <h1>Detect exposed secrets before they become incidents.</h1>
            <p>
              TheVaultSentry gives engineering teams a complete workspace for repository scanning,
              cloud asset monitoring, findings triage, automated remediation, compliance reports,
              real-time alerts, and team-wide security governance.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/register">Get Started Free</Link>
              <Link className="button secondary" href="/pricing">View Pricing</Link>
            </div>
            <div className="hero-facts">
              <div>
                <span>Scan Sources</span>
                <strong>Repositories, S3, CI/CD Pipelines</strong>
              </div>
              <div>
                <span>Detection</span>
                <strong>Patterns, Entropy, ML, Custom Rules</strong>
              </div>
              <div>
                <span>Integrations</span>
                <strong>GitHub, GitLab, Slack, Webhooks</strong>
              </div>
              <div>
                <span>Compliance</span>
                <strong>PDF Reports, Audit Logs, RBAC</strong>
              </div>
            </div>
          </div>

          <aside className="code-preview">
            <div className="terminal-top">
              <span /><span /><span />
              <code>config/prod.yaml</code>
            </div>
            <div className="code-lines">
              <p><b>01</b> apiVersion: v1</p>
              <p><b>02</b> kind: ConfigMap</p>
              <p><b>03</b> metadata:</p>
              <p><b>04</b> &nbsp; name: api-secrets</p>
              <p className="flagged"><b>05</b> &nbsp; AWS_SECRET_KEY: &quot;AKIA...masked&quot;</p>
              <p className="flagged"><b>06</b> &nbsp; STRIPE_SK: &quot;sk_live_...masked&quot;</p>
              <p><b>07</b> &nbsp; DB_HOST: production-rds.internal</p>
              <p className="flagged"><b>08</b> &nbsp; DB_PASSWORD: &quot;***masked***&quot;</p>
              <p><b>09</b> ---</p>
              <p><b>10</b> # 3 secrets detected, 2 critical</p>
            </div>
            <div className="preview-footer">
              <span><Icon>warning</Icon> Sensitive values stay masked</span>
              <Link href="/secrets">Review Findings</Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ═══ STATS BAR ════════════════════════════════════════════════ */}
      <section className="stats-bar">
        <div className="stats-inner">
          <div className="stat-item">
            <strong><Icon>folder_shared</Icon></strong>
            <span className="stat-label">Multi-Source Scanning</span>
            <span className="stat-desc">GitHub, GitLab, Bitbucket, S3</span>
          </div>
          <div className="stat-item">
            <strong><Icon>speed</Icon></strong>
            <span className="stat-label">Fast Detection</span>
            <span className="stat-desc">Pattern + entropy analysis</span>
          </div>
          <div className="stat-item">
            <strong><Icon>sync</Icon></strong>
            <span className="stat-label">Closed-Loop Remediation</span>
            <span className="stat-desc">Detect, triage, rotate, verify</span>
          </div>
          <div className="stat-item">
            <strong><Icon>shield</Icon></strong>
            <span className="stat-label">Enterprise Ready</span>
            <span className="stat-desc">RBAC, audit logs, compliance</span>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES GRID ═════════════════════════════════════════════ */}
      <section className="features-section" id="features">
        <div className="section-heading">
          <p className="eyebrow"><span className="status-dot" /> Platform Capabilities</p>
          <h2>Everything you need for secret detection and DevSecOps.</h2>
          <p>
            From repository scanning to compliance reporting, TheVaultSentry covers the entire
            secret detection lifecycle with enterprise-grade tooling.
          </p>
        </div>

        <div className="features-grid">
          {features.map((f) => (
            <Link key={f.title} href={f.href} className="feature-tile">
              <div className="feature-tile-header">
                <div className="feature-icon-box">
                  <Icon>{f.icon}</Icon>
                </div>
                <span className="feature-tag">{f.tag}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="feature-link">
                Explore <Icon>arrow_forward</Icon>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ WORKFLOW SECTION ══════════════════════════════════════════ */}
      <section className="architecture-section" id="workflow">
        <div className="section-heading">
          <p className="eyebrow"><span className="status-dot" /> Product Workflow</p>
          <h2>From source discovery to remediation tracking.</h2>
          <p>A continuous closed-loop pipeline: connect sources, detect secrets, triage findings, and track remediation to completion.</p>
        </div>

        <div className="workflow-map">
          <div className="workflow-stack">
            <Link href="/integrations"><Icon>extension</Icon><span>Integrations</span></Link>
            <Link href="/scheduled-scans"><Icon>calendar_clock</Icon><span>Scheduled Scans</span></Link>
          </div>
          <div className="workflow-core">
            <Icon filled>settings_input_component</Icon>
            <strong>VaultSentry Scan Engine</strong>
            <span>Pattern rules, entropy checks, ML analysis, and custom policies</span>
          </div>
          <div className="workflow-stack">
            <Link href="/secrets"><Icon>bug_report</Icon><span>Findings Triage</span></Link>
            <Link href="/alerts"><Icon>notifications_active</Icon><span>Alerts</span></Link>
            <Link href="/closed-loop"><Icon>sync</Icon><span>Closed Loop</span></Link>
          </div>
        </div>
      </section>

      {/* ═══ CAPABILITIES SECTION ═════════════════════════════════════ */}
      <section className="capabilities-section" id="capabilities">
        <div className="capabilities-inner">
          {[
            { icon: "travel_explore", title: "Scan Sources", items: "Repositories, S3 Buckets, CI/CD pipelines, scheduled jobs, API-triggered scans, and organization-wide bulk scans." },
            { icon: "rule", title: "Detection Engine", items: "Regex pattern matching, Shannon entropy analysis, custom policies, external scanner integrations, and ML-powered risk signals." },
            { icon: "fact_check", title: "Triage & Remediation", items: "Severity filters, finding status management, masked secret values, bulk actions, closed-loop rotation tracking." },
            { icon: "hub", title: "Operations & Governance", items: "PDF/CSV/JSON reports, real-time Slack alerts, team RBAC, API keys, complete audit logs, and compliance dashboards." },
          ].map((cap) => (
            <article key={cap.title} className="capability-card">
              <div className="capability-icon">
                <Icon>{cap.icon}</Icon>
              </div>
              <h3>{cap.title}</h3>
              <p>{cap.items}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ═══ CTA SECTION ══════════════════════════════════════════════ */}
      <section className="cta-section">
        <h2>Ready to secure your codebase?</h2>
        <p>Start scanning repositories in minutes. No credit card required for the free tier.</p>
        <div className="hero-actions">
          <Link className="button primary" href="/register">Create Free Account</Link>
          <Link className="button secondary dark" href="/dashboard">Open Console</Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════ */}
      <footer className="landing-v2-footer">
        <div
          className="footer-inner"
          style={{
            gridTemplateColumns: "1.4fr 1fr 1fr",
            alignItems: "start",
          }}
        >
          <div className="footer-brand-col">
            <span className="footer-brand">TheVaultSentry</span>
            <p>Next-generation secret detection and security posture management for modern engineering teams.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Link href="/register" className="button primary" style={{ minHeight: 36 }}>
                Get started free
              </Link>
              <Link href="/pricing" className="button secondary" style={{ minHeight: 36 }}>
                View pricing
              </Link>
            </div>
          </div>

          <div className="footer-col">
            <h4>COMPANY</h4>
            <ul>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/support">Support</Link></li>
              <li><Link href="/help">Help Center</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>LEGAL</h4>
            <ul>
              <li><Link href="/terms">Terms of Service</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div
          className="footer-bottom"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            padding: "16px 24px",
            maxWidth: 1280,
            margin: "0 auto",
          }}
        >
          <p>&copy; 2025 TheVaultSentry Inc. All rights reserved.</p>
          <p style={{ fontSize: 13, color: "var(--outline)" }}>
            Made for engineering teams who ship securely.
          </p>
        </div>
      </footer>
      </div>
    </main>
  )
}
