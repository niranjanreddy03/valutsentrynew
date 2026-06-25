export const primaryNav = [
  { slug: "dashboard", href: "/dashboard", icon: "dashboard", label: "Dashboard", summary: "Security posture, scan activity, findings, and alerts in one console." },
  { slug: "repositories", href: "/repositories", icon: "folder_shared", label: "Repositories", summary: "Connect source repositories, review branch coverage, and trigger scans." },
  { slug: "s3-buckets", href: "/s3-buckets", icon: "cloud", label: "S3 Buckets", summary: "Configure cloud storage scan targets for exposed secrets and sensitive files." },
  { slug: "scans", href: "/scans", icon: "radar", label: "Scans", summary: "Start, monitor, cancel, and review scan runs across configured assets." },
  { slug: "secrets", href: "/secrets", icon: "bug_report", label: "Findings", summary: "Triage detected secrets by severity, source, file context, and status." },
  { slug: "closed-loop", href: "/closed-loop", icon: "sync", label: "Closed Loop", summary: "Track remediation work from detection through rotation, review, and resolution." },
  { slug: "insights", href: "/insights", icon: "psychology", label: "ML Insights", summary: "Surface risk signals and model-assisted prioritization where enabled." },
  { slug: "policies", href: "/policies", icon: "policy", label: "Policies", summary: "Manage custom detection patterns and response rules." },
  { slug: "alerts", href: "/alerts", icon: "notifications_active", label: "Alerts", summary: "Review generated alerts and route security events to your workflow." },
  { slug: "reports", href: "/reports", icon: "description", label: "Reports", summary: "Generate full, repository, scan, CSV, JSON, and PDF-style reports." },
  { slug: "scheduled-scans", href: "/scheduled-scans", icon: "calendar_clock", label: "Scheduled Scans", summary: "Set recurring scans for repositories and supported assets." },
  { slug: "integrations", href: "/integrations", icon: "extension", label: "Integrations", summary: "Configure Git providers, Slack/webhooks, and scanner integrations." },
]

export const adminNav = [
  { slug: "teams", href: "/teams", icon: "groups", label: "Teams", summary: "Invite teammates and manage workspace access." },
  { slug: "api-keys", href: "/api-keys", icon: "key", label: "API Keys", summary: "Create and rotate API credentials for automation." },
  { slug: "audit", href: "/audit", icon: "history", label: "Audit Logs", summary: "Review security-relevant workspace events." },
]

export const utilityNav = [
  { slug: "pricing", href: "/pricing", icon: "payments", label: "Pricing", summary: "Review plan access and upgrade paths configured in the app." },
  { slug: "settings", href: "/settings", icon: "settings", label: "Settings", summary: "Update workspace preferences and security settings." },
  { slug: "profile", href: "/profile", icon: "person", label: "Profile", summary: "Manage account details." },
  { slug: "support", href: "/support", icon: "support_agent", label: "Support", summary: "Send support requests and view help options." },
  { slug: "help", href: "/help", icon: "help", label: "Help", summary: "Read product guidance and next steps." },
]

export const authNav = [
  { slug: "forgot-password", href: "/forgot-password", icon: "lock_reset", label: "Forgot Password", summary: "Request a password reset flow." },
  { slug: "reset-password", href: "/reset-password", icon: "password", label: "Reset Password", summary: "Set a new password after verification." },
  { slug: "mfa-setup", href: "/mfa-setup", icon: "phonelink_lock", label: "MFA Setup", summary: "Enroll an additional authentication factor." },
  { slug: "mfa-challenge", href: "/mfa-challenge", icon: "verified_user", label: "MFA Challenge", summary: "Verify your sign-in with a second factor." },
]

export const legalNav = [
  { slug: "terms", href: "/terms", icon: "gavel", label: "Terms", summary: "Product terms placeholder for the public route." },
  { slug: "privacy", href: "/privacy", icon: "privacy_tip", label: "Privacy", summary: "Privacy information placeholder for the public route." },
]

export const commerceNav = [
  { slug: "choose-plan", href: "/choose-plan", icon: "workspace_premium", label: "Choose Plan", summary: "Select the access level for your workspace." },
  { slug: "checkout", href: "/checkout", icon: "shopping_cart", label: "Checkout", summary: "Complete plan checkout when billing is configured." },
]

export const allFeatures = [
  ...primaryNav,
  ...adminNav,
  ...utilityNav,
  ...authNav,
  ...legalNav,
  ...commerceNav,
  { slug: "home", href: "/home", icon: "home", label: "Home", summary: "Authenticated landing view for the workspace." },
  { slug: "thevaultsentry", href: "/thevaultsentry", icon: "shield", label: "TheVaultSentry", summary: "Product overview route from the main frontend." },
]

export const featureBySlug = Object.fromEntries(allFeatures.map((feature) => [feature.slug, feature]))

export const capabilityGroups = [
  {
    title: "Scan Sources",
    icon: "travel_explore",
    items: ["Repositories", "S3 Buckets", "CI/CD and API-triggered scans", "Scheduled scan jobs"],
  },
  {
    title: "Detection",
    icon: "rule",
    items: ["Pattern rules", "Entropy checks", "Custom policies", "External scanner integrations"],
  },
  {
    title: "Triage",
    icon: "fact_check",
    items: ["Severity filters", "Finding status", "Repository context", "Masked secret values"],
  },
  {
    title: "Operations",
    icon: "hub",
    items: ["Reports", "Alerts", "Team access", "Audit logs", "API keys"],
  },
]
