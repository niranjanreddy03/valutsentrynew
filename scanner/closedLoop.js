'use strict';

/**
 * closedLoop.js
 *
 * Node.js implementation of the VaultSentry closed-loop lifecycle:
 * ingest -> detect -> classify -> dedupe -> validate -> decide -> remediate -> audit.
 *
 * Raw secrets are only held in memory during request processing. Persisted
 * records contain redacted previews and tenant-scoped HMAC fingerprints.
 */

const crypto = require('crypto');
const { ALL_RULES } = require('./rules');
const { validate } = require('./engine/validator');
const { assessEntropy } = require('./engine/entropy');

const DEFAULT_TENANT = 'default-org';

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function mask(value) {
  if (!value) return '****';
  if (value.length <= 8) return '*'.repeat(value.length);
  return value.slice(0, 4) + '*'.repeat(Math.max(4, value.length - 8)) + value.slice(-4);
}

function tenantPepper(tenantId) {
  return `${tenantId}:${process.env.VAULTSENTRY_HMAC_PEPPER || 'dev-only-rotate-me'}`;
}

function fingerprint(tenantId, raw) {
  const digest = crypto.createHmac('sha256', tenantPepper(tenantId)).update(raw).digest('hex');
  return `hmac_sha256:v1:${digest}`;
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value, Object.keys(value).sort())).digest('hex');
}

const REDACTION_PATTERNS = [
  /(?:A3T[A-Z0-9]|AKIA|ABIA|ACCA|AGPA|AIDA|AIPA|AROA|APKA|ASCA|ASIA)[A-Z0-9]{16}/g,
  /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g,
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}/g,
  /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s"']+/gi,
];

function redact(text) {
  return REDACTION_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, (m) => mask(m)), String(text || ''));
}

function ensureClosedLoopStore(store) {
  store.incidents = store.incidents || [];
  store.incident_fingerprints = store.incident_fingerprints || {};
  store.remediations = store.remediations || {};
  store.audit_events = store.audit_events || [];
  store.org_configs = store.org_configs || {};
  store.event_queue = store.event_queue || [];
  store.dead_letters = store.dead_letters || [];
}

function defaultConfig(tenantId) {
  return {
    tenant_id: tenantId,
    auto_revoke: { aws: false, github: false, stripe: false },
    auto_pr: true,
    dry_run_remediation: true,
    require_approval_for_production: true,
    require_approval_below_confidence: 0.95,
    protected_repositories: [],
    validation_enabled: { aws: true, github: true, stripe: true, database: false, jwt: true },
    integrations: {},
    updated_at: now(),
  };
}

function getConfig(store, tenantId) {
  ensureClosedLoopStore(store);
  if (!store.org_configs[tenantId]) store.org_configs[tenantId] = defaultConfig(tenantId);
  return store.org_configs[tenantId];
}

function updateConfig(store, tenantId, patch) {
  const current = getConfig(store, tenantId);
  const next = { ...current, ...patch, tenant_id: tenantId, updated_at: now() };
  store.org_configs[tenantId] = next;
  audit(store, tenantId, 'user', 'api', 'org_config.updated', 'tenant_config', tenantId, 'Organization configuration updated', {
    fields: Object.keys(patch || {}).sort(),
  });
  return next;
}

function audit(store, tenantId, actorType, actorId, eventType, resourceType, resourceId, message, metadata = {}) {
  ensureClosedLoopStore(store);
  const previous = store.audit_events.length ? store.audit_events[store.audit_events.length - 1].integrity_hash : null;
  const event = {
    audit_id: id('aud'),
    tenant_id: tenantId,
    actor_type: actorType,
    actor_id: actorId,
    event_type: eventType,
    resource_type: resourceType,
    resource_id: resourceId,
    message,
    metadata,
    created_at: now(),
    previous_hash: previous,
  };
  event.integrity_hash = sha256Json(event);
  store.audit_events.push(event);
  return event;
}

function detectContent(content, filePath) {
  const findings = [];
  const seen = new Set();
  const seenRawHashes = new Set();
  const text = String(content || '');

  for (const rule of ALL_RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      const raw = match[1] !== undefined ? match[1] : match[0];
      if (rule.falsePositives && rule.falsePositives.some((fp) => fp.test(raw))) continue;

      const verdict = validate({
        raw,
        ruleSeverity: rule.severity,
        ruleConfidence: rule.confidence,
        filePath,
        category: rule.category,
      });
      if (!verdict.accepted) continue;

      const rawHash = crypto.createHash('sha256').update(raw).digest('hex');
      const dedupe = `${rule.id}:${rawHash}`;
      if (seen.has(dedupe) || seenRawHashes.has(rawHash)) continue;
      seen.add(dedupe);
      seenRawHashes.add(rawHash);

      findings.push({
        raw,
        rule_id: rule.id,
        detector_id: rule.type,
        type: rule.type,
        category: rule.category,
        severity: rule.severity,
        confidence: rule.confidence,
        public_severity: verdict.severity,
        entropy: Number(verdict.entropy.toFixed(2)),
        file_path: filePath,
        line: text.slice(0, match.index).split('\n').length,
        snippet: lineSnippet(text, match.index),
        source: 'pattern',
      });
    }
  }

  const assignRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*["']([^"'\n]{20,200})["']/g;
  let assignment;
  while ((assignment = assignRe.exec(text)) !== null) {
    const keyName = assignment[1];
    const raw = assignment[2];
    if (!/secret|token|key|password|credential|api|auth/i.test(keyName)) continue;
    const rawHash = crypto.createHash('sha256').update(raw).digest('hex');
    const dedupe = `entropy:${rawHash}`;
    if (seen.has(dedupe) || seenRawHashes.has(rawHash)) continue;
    const entropy = assessEntropy(raw);
    if (!entropy.isSuspicious) continue;
    const verdict = validate({ raw, ruleSeverity: 'medium', ruleConfidence: 0.6, filePath, category: 'generic' });
    if (!verdict.accepted) continue;
    seen.add(dedupe);
    seenRawHashes.add(rawHash);
    findings.push({
      raw,
      rule_id: 'entropy-generic',
      detector_id: `High entropy value in ${keyName}`,
      type: 'High Entropy Secret',
      category: 'generic',
      severity: 'medium',
      confidence: 0.6,
      public_severity: verdict.severity,
      entropy: Number(entropy.entropy.toFixed(2)),
      file_path: filePath,
      line: text.slice(0, assignment.index).split('\n').length,
      snippet: lineSnippet(text, assignment.index),
      source: 'entropy',
    });
  }

  return findings;
}

function lineSnippet(content, index) {
  const lines = String(content || '').split('\n');
  const lineNumber = String(content || '').slice(0, index).split('\n').length;
  const start = Math.max(1, lineNumber - 1);
  const end = Math.min(lines.length, lineNumber + 1);
  const out = [];
  for (let line = start; line <= end; line++) {
    out.push(`${line === lineNumber ? '>>> ' : '    '}${line}: ${lines[line - 1] || ''}`);
  }
  return out.join('\n');
}

function classify(finding) {
  const type = String(finding.type || '').toLowerCase();
  const category = String(finding.category || '').toLowerCase();
  const raw = finding.raw || '';
  if (category === 'aws' || raw.startsWith('AKIA') || raw.startsWith('ASIA')) {
    return { provider: 'aws', secret_type: 'aws_access_key' };
  }
  if (category === 'github' || /^(ghp|gho|ghu|ghs|ghr)_/.test(raw) || raw.startsWith('github_pat_')) {
    return { provider: 'github', secret_type: 'github_token' };
  }
  if (category === 'stripe' || /^(sk|pk|rk)_(live|test)_/.test(raw) || type.includes('stripe')) {
    return { provider: 'stripe', secret_type: 'stripe_api_key' };
  }
  if (category === 'database' || type.includes('database')) {
    return { provider: 'database', secret_type: 'database_uri' };
  }
  if (category === 'jwt' || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw)) {
    return { provider: 'jwt', secret_type: 'jwt' };
  }
  return { provider: category || 'generic', secret_type: type.replace(/\s+/g, '_') || 'generic_secret' };
}

async function validateSecret(config, provider, raw) {
  if (config.validation_enabled && config.validation_enabled[provider] === false) {
    return validationResult(provider, 'tenant_policy', 'skipped', 0, { reason: 'validation disabled' });
  }
  if (provider === 'github') return validateGithub(raw);
  if (provider === 'stripe') return validateStripe(raw);
  if (provider === 'aws') return validateAws(config, raw);
  if (provider === 'jwt') return validationResult('jwt', 'local_shape_check', 'unknown', 0.75, { reason: 'signature validation needs issuer config' });
  if (provider === 'database') return validationResult('database', 'network_db_validation_disabled', 'unknown', 0.2, { reason: 'requires tenant-approved egress' });
  return validationResult(provider, 'format_only', 'unknown', 0.4, {});
}

function validationResult(provider, method, status, confidence, metadata) {
  return {
    validation_id: id('val'),
    provider,
    method,
    status,
    confidence,
    safe: true,
    metadata,
    validated_at: now(),
  };
}

async function validateGithub(token) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (response.status === 200) {
      const body = await response.json();
      return validationResult('github', 'GET /user', 'active', 0.99, {
        login_hash: crypto.createHash('sha256').update(String(body.login || '')).digest('hex'),
      });
    }
    if (response.status === 401 || response.status === 403) {
      return validationResult('github', 'GET /user', 'inactive', 0.9, {});
    }
  } catch {
    // Network validation is best effort and must never block detection.
  }
  return validationResult('github', 'GET /user', 'unknown', 0.5, {});
}

async function validateStripe(key) {
  try {
    const auth = Buffer.from(`${key}:`).toString('base64');
    const response = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (response.status === 200) return validationResult('stripe', 'GET /v1/account', 'active', 0.99, {});
    if (response.status === 401) return validationResult('stripe', 'GET /v1/account', 'inactive', 0.9, {});
  } catch {
    // Keep validation read-only and best effort.
  }
  return validationResult('stripe', 'GET /v1/account', 'unknown', 0.5, {});
}

function validateAws(config, accessKeyId) {
  const inventory = config.integrations?.aws?.known_access_key_ids || [];
  if (inventory.includes(accessKeyId)) {
    return validationResult('aws', 'tenant_inventory_match', 'active', 0.95, { source: 'tenant AWS inventory' });
  }
  return validationResult('aws', 'format_plus_optional_inventory', 'unknown', 0.6, {
    reason: 'AWS access key id found; secret access key is not persisted',
  });
}

function decide(config, incident) {
  const activeOrUnknown = incident.validation && ['active', 'unknown'].includes(incident.validation.status);
  const highConfidence = incident.confidence >= config.require_approval_below_confidence;
  const actions = [];

  if (activeOrUnknown && highConfidence && config.auto_revoke?.[incident.provider]) actions.push('revoke_or_rotate');
  if (config.auto_pr) actions.push('create_pull_request');
  actions.push('notify');

  let requiresApproval = incident.confidence < config.require_approval_below_confidence;
  if (config.require_approval_for_production && config.protected_repositories.includes(incident.repository)) {
    requiresApproval = true;
  }
  if (incident.validation?.status === 'inactive') {
    return { actions: config.auto_pr ? ['create_pull_request', 'notify'] : ['notify'], requires_approval: false, dry_run: config.dry_run_remediation };
  }
  return {
    actions: [...new Set(actions)],
    requires_approval: requiresApproval,
    dry_run: config.dry_run_remediation,
    reason: 'provider-aware validation plus tenant policy',
  };
}

async function remediate(store, config, incident, raw, manual = false) {
  const idempotencyKey = `${incident.tenant_id}:${incident.incident_id}:closed-loop:v1`;
  if (store.remediations[idempotencyKey]) return store.remediations[idempotencyKey];

  const action = {
    remediation_id: id('rem'),
    incident_id: incident.incident_id,
    tenant_id: incident.tenant_id,
    action_type: 'closed_loop_remediation',
    idempotency_key: idempotencyKey,
    status: 'pending',
    steps: [],
    created_at: now(),
    completed_at: null,
  };

  if (incident.decision.requires_approval && !manual) {
    action.status = 'needs_approval';
    action.steps.push({ name: 'approval_gate', status: 'waiting' });
    action.completed_at = now();
    store.remediations[idempotencyKey] = action;
    return action;
  }

  if (config.dry_run_remediation) {
    if (incident.decision.actions.includes('revoke_or_rotate')) action.steps.push({ name: `${incident.provider}_revoke_or_rotate`, status: 'planned' });
    if (incident.decision.actions.includes('create_pull_request')) action.steps.push({ name: 'github_create_pr', status: 'planned' });
    action.steps.push({ name: 'dry_run_guard', status: 'succeeded' });
    action.status = 'succeeded';
    action.completed_at = now();
    store.remediations[idempotencyKey] = action;
    return action;
  }

  if (incident.decision.actions.includes('revoke_or_rotate')) {
    action.steps.push(await providerRemediationStep(config, incident, raw));
  }
  if (incident.decision.actions.includes('create_pull_request')) {
    action.steps.push(await githubPrStep(config, incident));
  }
  action.status = action.steps.every((s) => ['succeeded', 'skipped', 'planned_external'].includes(s.status)) ? 'succeeded' : 'failed';
  action.completed_at = now();
  store.remediations[idempotencyKey] = action;
  return action;
}

async function providerRemediationStep(config, incident, raw) {
  if (incident.provider === 'aws') {
    const known = config.integrations?.aws?.known_access_key_ids || [];
    if (!known.includes(raw)) return { name: 'aws_disable_access_key', status: 'skipped', reason: 'key ownership not proven' };
    return { name: 'aws_disable_access_key', status: 'planned_external', reason: 'requires AWS cross-account role execution worker' };
  }
  if (incident.provider === 'github') {
    return { name: 'github_revoke_token', status: 'planned_external', reason: 'requires GitHub App/OAuth owner credentials' };
  }
  if (incident.provider === 'stripe') {
    return { name: 'stripe_rotate_key', status: 'skipped', reason: 'Stripe live key rotation usually requires dashboard/manual flow' };
  }
  return { name: `${incident.provider}_remediation`, status: 'skipped', reason: 'no provider mutating action configured' };
}

async function githubPrStep(config, incident) {
  if (!incident.repository || !incident.repository.includes('/')) {
    return { name: 'github_create_pr', status: 'skipped', reason: 'repository must be owner/repo' };
  }
  return {
    name: 'github_create_pr',
    status: 'planned_external',
    branch: `vaultsentry/remove-${incident.incident_id}`,
    file_path: incident.file_path,
  };
}

async function ingestCommitEvent(store, payload) {
  ensureClosedLoopStore(store);
  const started = Date.now();
  const tenantId = payload.tenant_id || DEFAULT_TENANT;
  const eventId = payload.event_id || id('evt');
  const repository = payload.repository || payload.repo || 'unknown/repository';
  const branch = payload.branch || 'main';
  const commitSha = payload.commit_sha || payload.after || 'unknown';
  const files = Array.isArray(payload.files) ? payload.files : [];
  const config = getConfig(store, tenantId);
  const incidents = [];

  store.event_queue.push({ topic: 'repo.events.raw', event_id: eventId, tenant_id: tenantId, created_at: now() });
  audit(store, tenantId, 'system', 'ingestion-service', 'repo_event.received', 'event', eventId, 'Repository event accepted', {
    repository,
    files: files.length,
  });

  try {
    for (const file of files) {
      const filePath = file.path || file.filename || 'unknown';
      const findings = detectContent(file.content || file.patch || '', filePath);
      for (const finding of findings) {
        const incident = await processFinding(store, config, tenantId, repository, branch, commitSha, finding);
        incidents.push(incident);
      }
    }
  } catch (err) {
    store.dead_letters.push({ event_id: eventId, tenant_id: tenantId, error: err.message, failed_at: now() });
    audit(store, tenantId, 'system', 'ingestion-service', 'repo_event.failed', 'event', eventId, 'Repository event moved to DLQ', {
      error: err.message,
    });
    throw err;
  }

  return {
    event_id: eventId,
    tenant_id: tenantId,
    repository,
    incidents,
    latency_ms: Date.now() - started,
    topics: pipelineTopics(),
  };
}

async function processFinding(store, config, tenantId, repository, branch, commitSha, finding) {
  const classified = classify(finding);
  const secretFingerprint = fingerprint(tenantId, finding.raw);
  const fingerprintKey = `${tenantId}:${secretFingerprint}`;
  const existingId = store.incident_fingerprints[fingerprintKey];

  if (existingId) {
    const existing = store.incidents.find((i) => i.incident_id === existingId);
    if (existing) {
      existing.last_seen_at = now();
      existing.exposure_count = (existing.exposure_count || 1) + 1;
      audit(store, tenantId, 'system', 'deduplication-service', 'secret.duplicate_seen', 'incident', existingId, 'Duplicate exposure linked to existing incident', {
        repository,
        file_path: finding.file_path,
      });
      return existing;
    }
  }

  const incident = {
    incident_id: id('inc'),
    tenant_id: tenantId,
    repository,
    branch,
    commit_sha: commitSha,
    file_path: finding.file_path,
    line_start: finding.line,
    line_end: finding.line,
    secret_type: classified.secret_type,
    provider: classified.provider,
    fingerprint: secretFingerprint,
    redacted_preview: mask(finding.raw),
    detector_id: finding.detector_id,
    confidence: finding.confidence,
    entropy: finding.entropy,
    severity: finding.severity,
    status: 'detected',
    validation: null,
    decision: {},
    remediation: null,
    first_seen_at: now(),
    last_seen_at: now(),
    exposure_count: 1,
    metadata: {
      public_severity: finding.public_severity,
      source: finding.source,
      code_snippet_redacted: redact(finding.snippet),
    },
  };

  audit(store, tenantId, 'system', 'detection-service', 'secret.detected', 'incident', incident.incident_id, 'Secret candidate detected', {
    provider: incident.provider,
    type: incident.secret_type,
  });

  incident.validation = await validateSecret(config, incident.provider, finding.raw);
  incident.status = 'validated';
  audit(store, tenantId, 'system', 'validation-service', 'secret.validated', 'incident', incident.incident_id, 'Secret validation completed', {
    status: incident.validation.status,
    method: incident.validation.method,
  });

  incident.decision = decide(config, incident);
  audit(store, tenantId, 'system', 'decision-engine', 'remediation.decided', 'incident', incident.incident_id, 'Remediation decision produced', incident.decision);

  if (incident.decision.actions.length) {
    incident.status = 'remediation_pending';
    incident.remediation = await remediate(store, config, incident, finding.raw);
    if (incident.remediation.status === 'needs_approval') incident.status = 'needs_approval';
    else if (incident.remediation.status === 'succeeded') incident.status = 'remediated';
    else if (incident.remediation.status === 'failed') incident.status = 'failed';
    audit(store, tenantId, 'system', 'remediation-orchestrator', 'remediation.completed', 'incident', incident.incident_id, 'Remediation workflow completed', incident.remediation);
  }

  store.incident_fingerprints[fingerprintKey] = incident.incident_id;
  store.incidents.push(incident);
  return incident;
}

function listIncidents(store, tenantId, filters = {}) {
  ensureClosedLoopStore(store);
  return store.incidents
    .filter((i) => i.tenant_id === tenantId)
    .filter((i) => !filters.status || i.status === filters.status)
    .filter((i) => !filters.provider || i.provider === filters.provider)
    .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
}

function getIncident(store, tenantId, incidentId) {
  ensureClosedLoopStore(store);
  return store.incidents.find((i) => i.tenant_id === tenantId && i.incident_id === incidentId) || null;
}

async function manualRemediate(store, tenantId, incidentId) {
  const incident = getIncident(store, tenantId, incidentId);
  if (!incident) return null;
  const config = getConfig(store, tenantId);
  incident.remediation = await remediate(store, config, { ...incident, decision: { ...incident.decision, requires_approval: false } }, '', true);
  incident.status = incident.remediation.status === 'succeeded' ? 'remediated' : incident.remediation.status;
  audit(store, tenantId, 'user', 'api', 'remediation.manual_triggered', 'incident', incidentId, 'Manual remediation triggered', incident.remediation);
  return incident;
}

function exposureHistory(store, tenantId, secretFingerprint) {
  ensureClosedLoopStore(store);
  return store.incidents.filter((i) => i.tenant_id === tenantId && i.fingerprint === secretFingerprint);
}

function auditEvents(store, tenantId, resourceId) {
  ensureClosedLoopStore(store);
  return store.audit_events
    .filter((e) => e.tenant_id === tenantId)
    .filter((e) => !resourceId || e.resource_id === resourceId)
    .slice(-500);
}

function pipelineTopics() {
  return [
    'repo.events.raw',
    'repo.content.changed',
    'secrets.detected',
    'secrets.classified',
    'secrets.unique',
    'secrets.validated',
    'remediation.commands',
    'remediation.results',
    'audit.events',
  ];
}

function pipelineDescription(tenantId) {
  return {
    tenant_id: tenantId,
    topics: pipelineTopics(),
    workers: [
      'ingestion-service',
      'detection-service',
      'classification-service',
      'deduplication-service',
      'validation-service',
      'decision-engine',
      'remediation-orchestrator',
      'integration-layer',
      'audit-storage-layer',
    ],
    security: {
      raw_secret_storage: 'forbidden',
      fingerprinting: 'tenant-scoped HMAC-SHA256',
      remediation_default: 'dry-run unless org config disables it',
    },
  };
}

function verifyWebhookSignature(req, rawBody) {
  const secret = process.env.VAULTSENTRY_WEBHOOK_SECRET;
  if (!secret) return true;
  const provided = req.headers['x-hub-signature-256'];
  if (!provided) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(provided)));
}

module.exports = {
  DEFAULT_TENANT,
  ensureClosedLoopStore,
  getConfig,
  updateConfig,
  ingestCommitEvent,
  listIncidents,
  getIncident,
  manualRemediate,
  exposureHistory,
  auditEvents,
  pipelineDescription,
  verifyWebhookSignature,
  detectContent,
  redact,
};
