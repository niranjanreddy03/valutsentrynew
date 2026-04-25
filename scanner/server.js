#!/usr/bin/env node
'use strict';

/**
 * VaultSentry Scanner API Server
 * Express server that wraps the Node.js scanning engine
 * and provides REST endpoints compatible with the frontend.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { scanRepository } = require('./repoScanner');
const { scanDirectory } = require('./directoryScanner');
const logger = require('./logger');

const app = express();
const PORT = process.env.SCANNER_PORT || 8000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for dev
  credentials: true,
}));
app.use(express.json());

// ─── Persistent Data Store (file-backed) ────────────────────────────────────
// Saves to scanner/data/store.json so data survives server restarts

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const saved = JSON.parse(raw);
      logger.info(`[STORE] Loaded ${saved.repositories?.length || 0} repos, ${saved.scans?.length || 0} scans, ${saved.secrets?.length || 0} secrets from disk`);
      return {
        repositories: saved.repositories || [],
        scans: saved.scans || [],
        secrets: saved.secrets || [],
        teams: saved.teams || [],
        team_members: saved.team_members || [],
        _nextRepoId: saved._nextRepoId || 1,
        _nextScanId: saved._nextScanId || 1,
        _nextSecretId: saved._nextSecretId || 1,
        _nextTeamId: saved._nextTeamId || 1,
        _nextMemberId: saved._nextMemberId || 1,
      };
    }
  } catch (err) {
    logger.error(`[STORE] Failed to load: ${err.message}`);
  }
  return {
    repositories: [],
    scans: [],
    secrets: [],
    teams: [],
    team_members: [],
    _nextRepoId: 1,
    _nextScanId: 1,
    _nextSecretId: 1,
    _nextTeamId: 1,
    _nextMemberId: 1,
  };
}

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    logger.error(`[STORE] Failed to save: ${err.message}`);
  }
}

const store = loadStore();

// Helper: get user ID from request header
function getUserId(req) {
  return req.headers['x-user-id'] || 'local-user';
}

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'vaultsentry-scanner-api',
    version: '1.0.0',
    engine: 'nodejs',
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'VaultSentry Scanner API',
    version: '1.0.0',
    description: 'Node.js Secret Detection Engine',
  });
});

// ─── Load env from .env files ───────────────────────────────────────────────
function loadEnv() {
  const backendEnv = path.join(__dirname, '..', 'backend', '.env');
  if (fs.existsSync(backendEnv)) {
    const lines = fs.readFileSync(backendEnv, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
  const frontendEnv = path.join(__dirname, '..', 'frontend', '.env.local');
  if (fs.existsSync(frontendEnv)) {
    const lines = fs.readFileSync(frontendEnv, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

// ═══════════════════════════════════════════════════════════════════════════
//  REPOSITORIES API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v1/repositories', (req, res) => {
  const userId = getUserId(req);
  const userRepos = store.repositories.filter(r => r.user_id === userId);
  res.json(userRepos);
});

app.post('/api/v1/repositories', (req, res) => {
  const { name, url, provider = 'github', branch = 'main' } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'name and url are required' });
  }
  const repo = {
    id: store._nextRepoId++,
    user_id: getUserId(req),
    name,
    url,
    provider,
    branch,
    status: 'active',
    last_scan_at: null,
    secrets_count: 0,
    webhook_secret: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.repositories.push(repo);
  saveStore();
  logger.info(`[REPO] Added: ${name} (${url})`);
  res.status(201).json(repo);
});

app.delete('/api/v1/repositories/:id', (req, res) => {
  const id = parseInt(req.params.id);
  store.repositories = store.repositories.filter(r => r.id !== id);
  store.scans = store.scans.filter(s => s.repository_id !== id);
  store.secrets = store.secrets.filter(s => s.repository_id !== id);
  saveStore();
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SCANS API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v1/scans', (req, res) => {
  const userId = getUserId(req);
  // Return scans belonging to this user
  const userScans = store.scans.filter(s => s.user_id === userId);
  const scans = userScans.map(scan => {
    const repo = store.repositories.find(r => r.id === scan.repository_id);
    return {
      ...scan,
      repository_name: repo?.name || 'Unknown',
      repository_url: repo?.url || '',
    };
  });
  res.json(scans.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.get('/api/v1/scans/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const scan = store.scans.find(s => s.id === id);
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  
  const secrets = store.secrets.filter(s => s.scan_id === id);
  res.json({ ...scan, secrets });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SECRETS / FINDINGS API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v1/secrets', (req, res) => {
  const userId = getUserId(req);
  // Return secrets belonging to this user
  const userSecrets = store.secrets.filter(s => s.user_id === userId);
  const secrets = userSecrets.map(secret => {
    const repo = store.repositories.find(r => r.id === secret.repository_id);
    return {
      ...secret,
      repository_name: repo?.name || 'Unknown',
    };
  });
  res.json(secrets);
});

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD STATS API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v1/stats', (req, res) => {
  const userId = getUserId(req);
  const userSecrets = store.secrets.filter(s => s.user_id === userId);
  const userScans = store.scans.filter(s => s.user_id === userId);
  const userRepos = store.repositories.filter(r => r.user_id === userId);

  const totalSecrets = userSecrets.length;
  const activeSecrets = userSecrets.filter(s => s.status === 'active').length;
  const resolvedSecrets = userSecrets.filter(s => s.status === 'resolved').length;
  const criticalSecrets = userSecrets.filter(s => s.risk_level === 'critical').length;
  const highSecrets = userSecrets.filter(s => s.risk_level === 'high').length;
  const totalScans = userScans.length;
  const completedScans = userScans.filter(s => s.status === 'completed').length;
  const totalRepos = userRepos.length;
  
  res.json({
    totalSecrets,
    activeSecrets,
    resolvedSecrets,
    criticalSecrets,
    highSecrets,
    totalScans,
    completedScans,
    totalRepos,
    recentScans: userScans
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(s => {
        const repo = userRepos.find(r => r.id === s.repository_id);
        return { ...s, repository_name: repo?.name || 'Unknown' };
      }),
    secretsBySeverity: {
      critical: criticalSecrets,
      high: highSecrets,
      medium: userSecrets.filter(s => s.risk_level === 'medium').length,
      low: userSecrets.filter(s => s.risk_level === 'low').length,
    },
    secretsByType: userSecrets.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {}),
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  TRIGGER SCAN
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/v1/scans/trigger', async (req, res) => {
  const { scan_id, repository_id, repository_url, branch = 'main' } = req.body;

  if (!repository_url) {
    return res.status(400).json({ error: 'Missing repository_url' });
  }

  // Find or create repo in store
  let repo = store.repositories.find(r => r.url === repository_url);
  if (!repo) {
    const repoName = repository_url.split('/').pop() || 'unknown';
    repo = {
      id: store._nextRepoId++,
      user_id: getUserId(req),
      name: repoName,
      url: repository_url,
      provider: 'github',
      branch: branch,
      status: 'active',
      last_scan_at: null,
      secrets_count: 0,
      webhook_secret: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.repositories.push(repo);
  }

  // Create scan record
  const scanRecord = {
    id: store._nextScanId++,
    repository_id: repo.id,
    user_id: getUserId(req),
    status: 'queued',
    trigger_type: 'manual',
    branch: branch,
    files_scanned: 0,
    secrets_found: 0,
    duration_seconds: 0,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.scans.push(scanRecord);
  saveStore();

  logger.info(`[TRIGGER] Scan #${scanRecord.id} queued for ${repository_url}`);

  // Respond immediately
  res.status(202).json({ status: 'queued', scan_id: scanRecord.id });

  // Run in background
  runScanInBackground(scanRecord, repo, branch);
});

async function runScanInBackground(scanRecord, repo, branch) {
  try {
    // Update status to running
    scanRecord.status = 'running';
    scanRecord.started_at = new Date().toISOString();
    logger.info(`[SCAN #${scanRecord.id}] Status → running`);

    // Run the scanner
    const startTime = Date.now();
    const result = await scanRepository(repo.url, {
      branch,
      maskValues: true,
      useGitignore: true,
      // Match the scanner's new default; SSD/NVMe handles this fine and
      // scan wall-time is dominated by I/O, not CPU.
      concurrency: 24,
    });

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Store findings
    const newSecrets = result.findings.map(f => ({
      id: store._nextSecretId++,
      scan_id: scanRecord.id,
      repository_id: repo.id,
      user_id: scanRecord.user_id,
      type: f.type || f.ruleId || 'unknown',
      file_path: f.file,
      line_number: f.line || 0,
      column_start: 0,
      column_end: 0,
      masked_value: f.maskedValue || f.value || '',
      raw_match: f.hash || '',
      description: f.snippet || `${f.type} found in ${f.file}:${f.line}`,
      pattern_name: f.ruleId || f.type || '',
      risk_level: f.severity || 'medium',
      entropy_score: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    store.secrets.push(...newSecrets);

    // Update scan record
    scanRecord.status = 'completed';
    scanRecord.completed_at = new Date().toISOString();
    scanRecord.files_scanned = result.filesScanned;
    scanRecord.secrets_found = newSecrets.length;
    scanRecord.duration_seconds = durationSeconds;

    // Update repo stats
    repo.last_scan_at = new Date().toISOString();
    repo.secrets_count = store.secrets.filter(s => s.repository_id === repo.id).length;

    saveStore();
    logger.info(`[SCAN #${scanRecord.id}] ✅ Complete: ${newSecrets.length} findings in ${result.filesScanned} files (${durationSeconds}s)`);

  } catch (err) {
    scanRecord.status = 'failed';
    scanRecord.error_message = err.message;
    scanRecord.completed_at = new Date().toISOString();
    saveStore();
    logger.error(`[SCAN #${scanRecord.id}] ❌ Failed: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  QUICK SCAN (synchronous, returns results directly)
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/v1/scans/quick', async (req, res) => {
  const { repository_url, branch = 'main' } = req.body;
  if (!repository_url) {
    return res.status(400).json({ error: 'Missing repository_url' });
  }
  try {
    logger.info(`[QUICK] Scanning ${repository_url}`);
    const result = await scanRepository(repository_url, {
      branch,
      maskValues: true,
      useGitignore: true,
      concurrency: 10,
    });
    res.json({
      status: 'completed',
      filesScanned: result.filesScanned,
      totalFindings: result.findings.length,
      bySeverity: {
        critical: result.findings.filter(f => f.severity === 'critical').length,
        high: result.findings.filter(f => f.severity === 'high').length,
        medium: result.findings.filter(f => f.severity === 'medium').length,
        low: result.findings.filter(f => f.severity === 'low').length,
      },
      findings: result.findings,
    });
  } catch (err) {
    logger.error(`[QUICK] Scan failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  UPDATE SECRET STATUS (resolve/dismiss)
// ═══════════════════════════════════════════════════════════════════════════

app.patch('/api/v1/secrets/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const secret = store.secrets.find(s => s.id === id);
  if (!secret) return res.status(404).json({ error: 'Secret not found' });
  
  const { status } = req.body;
  if (status) secret.status = status;
  secret.updated_at = new Date().toISOString();
  
  saveStore();
  res.json(secret);
});

app.patch('/api/v1/secrets/bulk', (req, res) => {
  const { ids, status } = req.body;
  if (!ids || !status) return res.status(400).json({ error: 'ids and status required' });
  
  let updated = 0;
  for (const id of ids) {
    const secret = store.secrets.find(s => s.id === id);
    if (secret) {
      secret.status = status;
      secret.updated_at = new Date().toISOString();
      updated++;
    }
  }
  saveStore();
  res.json({ updated });
});

// ═══════════════════════════════════════════════════════════════════════════
//  REPORT GENERATION & DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/v1/reports/scan/:scanId', (req, res) => {
  const userId = getUserId(req);
  const scanId = parseInt(req.params.scanId);
  const scan = store.scans.find(s => s.id === scanId && s.user_id === userId);
  if (!scan) return res.status(404).json({ error: 'Scan not found' });
  
  const repo = store.repositories.find(r => r.id === scan.repository_id);
  const secrets = store.secrets.filter(s => s.scan_id === scanId && s.user_id === userId);
  
  const report = {
    report_type: 'scan',
    generated_at: new Date().toISOString(),
    scan: {
      id: scan.id,
      status: scan.status,
      repository: repo?.name || 'Unknown',
      repository_url: repo?.url || '',
      branch: scan.branch,
      started_at: scan.started_at,
      completed_at: scan.completed_at,
      duration_seconds: scan.duration_seconds,
      files_scanned: scan.files_scanned,
      secrets_found: scan.secrets_found,
    },
    summary: {
      total: secrets.length,
      critical: secrets.filter(s => s.risk_level === 'critical').length,
      high: secrets.filter(s => s.risk_level === 'high').length,
      medium: secrets.filter(s => s.risk_level === 'medium').length,
      low: secrets.filter(s => s.risk_level === 'low').length,
    },
    findings: secrets.map(s => ({
      id: s.id,
      type: s.type,
      severity: s.risk_level,
      file: s.file_path,
      line: s.line_number,
      description: s.description,
      masked_value: s.masked_value,
      status: s.status,
      detected_at: s.created_at,
    })),
  };
  
  res.json(report);
});

// Full report across all scans (filtered by user)
app.get('/api/v1/reports/full', (req, res) => {
  const userId = getUserId(req);
  const userRepos = store.repositories.filter(r => r.user_id === userId);
  const userScans = store.scans.filter(s => s.user_id === userId);
  const userSecrets = store.secrets.filter(s => s.user_id === userId);

  const report = {
    report_type: 'full',
    generated_at: new Date().toISOString(),
    organization: 'VaultSentry Scan Report',
    summary: {
      total_repositories: userRepos.length,
      total_scans: userScans.length,
      completed_scans: userScans.filter(s => s.status === 'completed').length,
      total_secrets: userSecrets.length,
      active_secrets: userSecrets.filter(s => s.status === 'active').length,
      by_severity: {
        critical: userSecrets.filter(s => s.risk_level === 'critical').length,
        high: userSecrets.filter(s => s.risk_level === 'high').length,
        medium: userSecrets.filter(s => s.risk_level === 'medium').length,
        low: userSecrets.filter(s => s.risk_level === 'low').length,
      },
    },
    repositories: userRepos.map(r => ({
      name: r.name,
      url: r.url,
      branch: r.branch,
      secrets_count: r.secrets_count,
      last_scan_at: r.last_scan_at,
    })),
    scans: userScans.map(s => {
      const repo = userRepos.find(r => r.id === s.repository_id);
      return {
        id: s.id,
        repository: repo?.name || 'Unknown',
        status: s.status,
        branch: s.branch,
        files_scanned: s.files_scanned,
        secrets_found: s.secrets_found,
        duration_seconds: s.duration_seconds,
        started_at: s.started_at,
        completed_at: s.completed_at,
      };
    }),
    findings: userSecrets.map(s => {
      const repo = userRepos.find(r => r.id === s.repository_id);
      return {
        id: s.id,
        repository: repo?.name || 'Unknown',
        type: s.type,
        severity: s.risk_level,
        file: s.file_path,
        line: s.line_number,
        description: s.description,
        masked_value: s.masked_value,
        status: s.status,
        detected_at: s.created_at,
      };
    }),
  };
  
  res.json(report);
});

// CSV download (filtered by user)
app.get('/api/v1/reports/csv', (req, res) => {
  const userId = getUserId(req);
  const userSecrets = store.secrets.filter(s => s.user_id === userId);
  const header = 'ID,Repository,Type,Severity,File,Line,Description,Status,Detected At\n';
  const rows = userSecrets.map(s => {
    const repo = store.repositories.find(r => r.id === s.repository_id);
    return [
      s.id,
      `"${(repo?.name || 'Unknown').replace(/"/g, '""')}"`,
      `"${s.type.replace(/"/g, '""')}"`,
      s.risk_level,
      `"${s.file_path.replace(/"/g, '""')}"`,
      s.line_number,
      `"${(s.description || '').replace(/"/g, '""')}"`,
      s.status,
      s.created_at,
    ].join(',');
  }).join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=vaultsentry-report.csv');
  res.send(header + rows);
});

// ═══════════════════════════════════════════════════════════════════════════
//  TEAMS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// GET teams for user
app.get('/api/v1/teams', (req, res) => {
  const userId = getUserId(req);
  // Get teams where user is a member
  const memberRecords = store.team_members.filter(m => m.user_id === userId);
  const teamIds = memberRecords.map(m => m.team_id);
  const userTeams = store.teams.filter(t => teamIds.includes(t.id));
  
  const teamsWithCounts = userTeams.map(t => ({
    ...t,
    members_count: store.team_members.filter(m => m.team_id === t.id).length,
    repositories_count: 0,
  }));
  
  res.json(teamsWithCounts);
});

// POST create team
app.post('/api/v1/teams', (req, res) => {
  const userId = getUserId(req);
  const { name, description } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Team name is required' });
  
  const team = {
    id: store._nextTeamId++,
    name,
    description: description || '',
    owner_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.teams.push(team);
  
  // Add creator as owner member
  const member = {
    id: store._nextMemberId++,
    team_id: team.id,
    user_id: userId,
    email: req.headers['x-user-email'] || 'owner@team.com',
    name: req.headers['x-user-name'] || 'Team Owner',
    role: 'owner',
    status: 'active',
    joined_at: new Date().toISOString(),
  };
  store.team_members.push(member);
  
  saveStore();
  res.status(201).json({ ...team, members_count: 1, repositories_count: 0 });
});

// DELETE team
app.delete('/api/v1/teams/:id', (req, res) => {
  const userId = getUserId(req);
  const teamId = parseInt(req.params.id);
  
  const team = store.teams.find(t => t.id === teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (team.owner_id !== userId) return res.status(403).json({ error: 'Only team owner can delete' });
  
  store.teams = store.teams.filter(t => t.id !== teamId);
  store.team_members = store.team_members.filter(m => m.team_id !== teamId);
  saveStore();
  res.json({ success: true });
});

// GET team members
app.get('/api/v1/teams/:id/members', (req, res) => {
  const teamId = parseInt(req.params.id);
  const members = store.team_members.filter(m => m.team_id === teamId);
  res.json(members);
});

// GET all members across user's teams
app.get('/api/v1/members', (req, res) => {
  const userId = getUserId(req);
  // Get all teams where user is a member
  const userTeamIds = store.team_members
    .filter(m => m.user_id === userId)
    .map(m => m.team_id);
  // Get all members of those teams
  const allMembers = store.team_members.filter(m => userTeamIds.includes(m.team_id));
  // Deduplicate by email
  const seen = new Set();
  const uniqueMembers = allMembers.filter(m => {
    if (seen.has(m.email)) return false;
    seen.add(m.email);
    return true;
  });
  res.json(uniqueMembers);
});

// POST invite member to team
app.post('/api/v1/teams/:id/members', (req, res) => {
  const userId = getUserId(req);
  const teamId = parseInt(req.params.id);
  const { email, role, name } = req.body;
  
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  const team = store.teams.find(t => t.id === teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  
  // Check if already a member
  const existing = store.team_members.find(m => m.team_id === teamId && m.email === email);
  if (existing) return res.status(409).json({ error: 'Already a member of this team' });
  
  const member = {
    id: store._nextMemberId++,
    team_id: teamId,
    user_id: email, // Will be replaced when user accepts invite
    email,
    name: name || '',
    role: role || 'member',
    status: 'pending',
    invited_by: userId,
    joined_at: new Date().toISOString(),
  };
  store.team_members.push(member);
  saveStore();
  
  res.status(201).json(member);
});

// DELETE remove member from team
app.delete('/api/v1/teams/:teamId/members/:memberId', (req, res) => {
  const teamId = parseInt(req.params.teamId);
  const memberId = parseInt(req.params.memberId);
  
  const member = store.team_members.find(m => m.id === memberId && m.team_id === teamId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (member.role === 'owner') return res.status(403).json({ error: 'Cannot remove team owner' });
  
  store.team_members = store.team_members.filter(m => !(m.id === memberId && m.team_id === teamId));
  saveStore();
  res.json({ success: true });
});

// PATCH update member role
app.patch('/api/v1/teams/:teamId/members/:memberId', (req, res) => {
  const teamId = parseInt(req.params.teamId);
  const memberId = parseInt(req.params.memberId);
  const { role } = req.body;
  
  const member = store.team_members.find(m => m.id === memberId && m.team_id === teamId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (member.role === 'owner') return res.status(403).json({ error: 'Cannot change owner role' });
  
  member.role = role || member.role;
  saveStore();
  res.json(member);
});

// ─── Start server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║     VaultSentry Scanner API Server       ║
╠══════════════════════════════════════════╣
║  Engine   : Node.js                      ║
║  Port     : ${String(PORT).padEnd(29)}║
║  Status   : Ready                        ║
╚══════════════════════════════════════════╝
`);
  logger.info(`Scanner API running on http://localhost:${PORT}`);
});
