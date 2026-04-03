'use strict';

/**
 * VaultSentry — Report Generator
 * report.js
 *
 * Converts a ScanSummary into a self-contained, interactive HTML report.
 * No external runtime dependencies — all CSS/JS is inlined or CDN-referenced.
 */

const fs = require('fs');
const path = require('path');

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
  critical: { bg: '#ff3b3b', light: '#fff0f0', text: '#7a0000', dot: '🔴' },
  high:     { bg: '#ff8c00', light: '#fff5e6', text: '#7a3800', dot: '🟠' },
  medium:   { bg: '#f0c000', light: '#fffbe6', text: '#6b5000', dot: '🟡' },
  low:      { bg: '#22c55e', light: '#f0fdf4', text: '#14532d', dot: '🟢' },
};

const CATEGORY_ICON = {
  aws:         '☁️',
  google:      '🔵',
  azure:       '🔷',
  github:      '🐙',
  jwt:         '🔑',
  private_key: '🗝️',
  database:    '🗄️',
  password:    '🔒',
  api_key:     '🔐',
  oauth:       '🔗',
  generic:     '⚠️',
};

function severityBadge(severity) {
  const c = SEVERITY_COLOR[severity] || SEVERITY_COLOR.low;
  return `<span class="badge badge-${severity}">${c.dot} ${severity.toUpperCase()}</span>`;
}

function categoryBadge(category) {
  const icon = CATEGORY_ICON[category] || '⚠️';
  return `<span class="badge badge-category">${icon} ${category.replace('_', ' ')}</span>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Risk score (0-100) ───────────────────────────────────────────────────────

function computeRiskScore(summary) {
  const weights = { critical: 10, high: 5, medium: 2, low: 1 };
  const raw =
    (summary.bySeverity.critical * weights.critical) +
    (summary.bySeverity.high     * weights.high)     +
    (summary.bySeverity.medium   * weights.medium)   +
    (summary.bySeverity.low      * weights.low);
  // Normalise: cap at 100
  return Math.min(100, Math.round(raw));
}

// ─── Findings table rows ──────────────────────────────────────────────────────

function buildRows(findings) {
  if (!findings || findings.length === 0) {
    return `<tr><td colspan="6" class="empty-row">🎉 No findings — your code looks clean!</td></tr>`;
  }

  return findings.map((f, idx) => {
    const snippetId = `snippet-${idx}`;
    const snippet = f.snippet ? `
      <div class="snippet-toggle" onclick="toggleSnippet('${snippetId}')">📄 Show code snippet</div>
      <pre class="snippet" id="${snippetId}">${escHtml(f.snippet)}</pre>` : '';

    return `
    <tr class="finding-row" data-severity="${f.severity}" data-category="${f.category}">
      <td>${severityBadge(f.severity)}</td>
      <td>${categoryBadge(f.category)}<br/><small class="rule-id">${escHtml(f.ruleId)}</small></td>
      <td>
        <span class="type-label">${escHtml(f.type)}</span>
        ${f.isTestFile ? '<span class="test-badge">TEST FILE</span>' : ''}
      </td>
      <td class="file-cell">
        <span class="file-path" title="${escHtml(f.file)}">${escHtml(f.file)}</span>
        <span class="line-num">Line ${f.line}</span>
      </td>
      <td><code class="masked-value">${escHtml(f.value)}</code></td>
      <td class="confidence-cell">
        <div class="confidence-bar-wrap">
          <div class="confidence-bar" style="width:${Math.round((f.confidence || 0) * 100)}%"></div>
        </div>
        <small>${Math.round((f.confidence || 0) * 100)}%</small>
      </td>
    </tr>
    <tr class="snippet-row" data-severity="${f.severity}">
      <td colspan="6">${snippet}</td>
    </tr>`;
  }).join('');
}

// ─── Donut chart SVG ──────────────────────────────────────────────────────────

function donutChart(summary) {
  const total = summary.totalIssues || 1;
  const slices = [
    { label: 'Critical', count: summary.bySeverity.critical, color: '#ff3b3b' },
    { label: 'High',     count: summary.bySeverity.high,     color: '#ff8c00' },
    { label: 'Medium',   count: summary.bySeverity.medium,   color: '#f0c000' },
    { label: 'Low',      count: summary.bySeverity.low,      color: '#22c55e' },
  ].filter(s => s.count > 0);

  if (slices.length === 0) {
    return `<svg viewBox="0 0 100 100" class="donut-svg">
      <circle cx="50" cy="50" r="35" fill="none" stroke="#22c55e" stroke-width="12"/>
      <text x="50" y="55" text-anchor="middle" font-size="10" fill="#22c55e">Clean!</text>
    </svg>`;
  }

  const cx = 50, cy = 50, r = 35;
  const circumference = 2 * Math.PI * r;
  let paths = '';
  let offset = 0;

  for (const s of slices) {
    const pct = s.count / total;
    const dash = pct * circumference;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}"
      fill="none" stroke="${s.color}" stroke-width="12"
      stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
      stroke-dashoffset="${(-offset * circumference / (2 * Math.PI * r)).toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})" />`;
    offset += pct * circumference;
  }

  return `<svg viewBox="0 0 100 100" class="donut-svg">
    ${paths}
    <text x="50" y="47" text-anchor="middle" font-size="12" font-weight="bold" fill="#e2e8f0">${total}</text>
    <text x="50" y="60" text-anchor="middle" font-size="6" fill="#94a3b8">ISSUES</text>
  </svg>`;
}

// ─── Main HTML template ───────────────────────────────────────────────────────

function buildHtml(scanOutput) {
  const s = scanOutput.summary;
  const findings = scanOutput.findings || [];
  const risk = computeRiskScore(s);
  const riskColor = risk >= 70 ? '#ff3b3b' : risk >= 40 ? '#ff8c00' : risk >= 15 ? '#f0c000' : '#22c55e';
  const riskLabel = risk >= 70 ? 'Critical Risk' : risk >= 40 ? 'High Risk' : risk >= 15 ? 'Medium Risk' : 'Low Risk';

  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'long', timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>VaultSentry Scan Report</title>
<style>
  /* ── Reset & tokens ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0f172a;
    --surface:  #1e293b;
    --surface2: #273448;
    --border:   #334155;
    --text:     #e2e8f0;
    --muted:    #94a3b8;
    --accent:   #6366f1;
    --accent2:  #818cf8;
    --radius:   12px;
    --shadow:   0 4px 24px rgba(0,0,0,.4);
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    line-height: 1.6;
    min-height: 100vh;
  }

  /* ── Header ── */
  .header {
    background: linear-gradient(135deg, #1e0a4b 0%, #0f172a 50%, #0a2040 100%);
    border-bottom: 1px solid var(--border);
    padding: 32px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .logo { display: flex; align-items: center; gap: 14px; }
  .logo-icon {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; box-shadow: 0 0 24px rgba(99,102,241,.5);
  }
  .logo h1 { font-size: 1.8rem; font-weight: 800; letter-spacing: -0.5px; }
  .logo h1 span { color: var(--accent2); }
  .header-meta { text-align: right; color: var(--muted); font-size: 0.85rem; }
  .header-meta strong { color: var(--text); }

  /* ── Main layout ── */
  main { max-width: 1400px; margin: 0 auto; padding: 32px 24px; }

  /* ── Risk banner ── */
  .risk-banner {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px 32px;
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .risk-info h2 { font-size: 1.1rem; color: var(--muted); margin-bottom: 4px; }
  .risk-score { font-size: 3.5rem; font-weight: 900; line-height: 1; }
  .risk-label { font-size: 0.95rem; font-weight: 600; margin-top: 4px; }
  .risk-bar-wrap {
    flex: 1; min-width: 200px; max-width: 400px;
    background: var(--surface2); border-radius: 99px; height: 12px; overflow: hidden;
  }
  .risk-bar {
    height: 100%; border-radius: 99px;
    transition: width .8s ease;
  }
  .scan-meta { color: var(--muted); font-size: 0.85rem; line-height: 1.8; }
  .scan-meta strong { color: var(--text); }

  /* ── Stat cards ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
    transition: transform .2s, box-shadow .2s;
    cursor: default;
  }
  .stat-card:hover { transform: translateY(-3px); box-shadow: var(--shadow); }
  .stat-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    border-radius: var(--radius) var(--radius) 0 0;
  }
  .stat-card.critical::before { background: #ff3b3b; }
  .stat-card.high::before     { background: #ff8c00; }
  .stat-card.medium::before   { background: #f0c000; }
  .stat-card.low::before      { background: #22c55e; }
  .stat-card.files::before    { background: var(--accent); }
  .stat-card.total::before    { background: var(--accent2); }

  .stat-number { font-size: 2.6rem; font-weight: 900; line-height: 1; }
  .stat-card.critical .stat-number { color: #ff3b3b; }
  .stat-card.high     .stat-number { color: #ff8c00; }
  .stat-card.medium   .stat-number { color: #f0c000; }
  .stat-card.low      .stat-number { color: #22c55e; }
  .stat-card.files    .stat-number { color: var(--accent2); }
  .stat-card.total    .stat-number { color: #e2e8f0; }
  .stat-label { color: var(--muted); font-size: 0.8rem; margin-top: 6px; text-transform: uppercase; letter-spacing: .5px; }
  .stat-icon { font-size: 1.5rem; margin-bottom: 8px; }

  /* ── Chart + top section ── */
  .top-section {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 20px;
    margin-bottom: 28px;
    align-items: start;
  }
  .donut-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    text-align: center;
  }
  .donut-card h3 { font-size: 0.85rem; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: .5px; }
  .donut-svg { width: 100%; max-width: 140px; }
  .donut-legend { margin-top: 12px; text-align: left; }
  .donut-legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--muted); margin-bottom: 4px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  .top-cat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
  }
  .top-cat-card h3 { font-size: 0.85rem; color: var(--muted); margin-bottom: 12px; text-transform: uppercase; letter-spacing: .5px; }
  .cat-bar-item { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .cat-bar-label { width: 130px; font-size: 0.85rem; color: var(--text); flex-shrink: 0; }
  .cat-bar-wrap { flex: 1; background: var(--surface2); border-radius: 99px; height: 8px; overflow: hidden; }
  .cat-bar { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 99px; }
  .cat-bar-count { font-size: 0.8rem; color: var(--muted); width: 30px; text-align: right; flex-shrink: 0; }

  /* ── Findings table ── */
  .findings-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .findings-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap; gap: 12px;
  }
  .findings-header h2 { font-size: 1.1rem; }

  /* ── Filter & search ── */
  .controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .search-box {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    padding: 7px 14px;
    font-size: 0.85rem;
    outline: none;
    width: 220px;
    transition: border-color .2s;
  }
  .search-box:focus { border-color: var(--accent); }
  .filter-btn {
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--surface2);
    color: var(--muted);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all .2s;
  }
  .filter-btn:hover { border-color: var(--accent); color: var(--text); }
  .filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .filter-btn.critical.active { background: #ff3b3b; border-color: #ff3b3b; color: #fff; }
  .filter-btn.high.active     { background: #ff8c00; border-color: #ff8c00; color: #fff; }
  .filter-btn.medium.active   { background: #d4a700; border-color: #d4a700; color: #fff; }
  .filter-btn.low.active      { background: #16a34a; border-color: #16a34a; color: #fff; }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: var(--surface2);
    padding: 12px 16px;
    text-align: left;
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .5px;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 10;
  }
  tbody tr.finding-row:hover td { background: rgba(99,102,241,.05); }
  tbody td {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(51,65,85,.5);
    vertical-align: top;
    font-size: 0.85rem;
  }
  tbody tr.snippet-row td {
    padding: 0 16px;
    border-bottom: 1px solid rgba(51,65,85,.5);
  }
  .empty-row { text-align: center; color: var(--muted); padding: 60px !important; font-size: 1.1rem; }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: .3px;
    white-space: nowrap;
  }
  .badge-critical { background: #3a0000; color: #ff6b6b; border: 1px solid #7a0000; }
  .badge-high     { background: #3a1800; color: #ffaa44; border: 1px solid #7a3800; }
  .badge-medium   { background: #3a2e00; color: #f0c000; border: 1px solid #6b5000; }
  .badge-low      { background: #052e16; color: #4ade80; border: 1px solid #14532d; }
  .badge-category { background: var(--surface2); color: var(--muted); border: 1px solid var(--border); font-weight: 600; }
  .test-badge { display: inline-block; background: rgba(99,102,241,.15); color: var(--accent2); border: 1px solid rgba(99,102,241,.3); border-radius: 4px; font-size: 0.65rem; padding: 1px 6px; margin-left: 6px; vertical-align: middle; }

  .rule-id     { color: var(--muted); font-size: 0.72rem; }
  .type-label  { font-weight: 600; }
  .file-cell   { max-width: 260px; }
  .file-path   { display: block; color: var(--accent2); font-size: 0.8rem; word-break: break-all; }
  .line-num    { color: var(--muted); font-size: 0.75rem; }
  .masked-value { background: var(--surface2); padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; color: #fbbf24; word-break: break-all; }

  /* ── Confidence bar ── */
  .confidence-cell { min-width: 100px; }
  .confidence-bar-wrap {
    background: var(--surface2); border-radius: 99px; height: 6px; width: 80px; margin-bottom: 4px;
  }
  .confidence-bar { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 99px; }

  /* ── Code snippet ── */
  .snippet-toggle {
    color: var(--accent2); font-size: 0.78rem; cursor: pointer; padding: 6px 0;
    user-select: none;
  }
  .snippet-toggle:hover { text-decoration: underline; }
  .snippet {
    display: none;
    background: #0d1117; color: #c9d1d9;
    border-radius: 8px; padding: 12px; margin-bottom: 10px;
    font-size: 0.78rem; white-space: pre-wrap; word-break: break-all;
    border: 1px solid #30363d; line-height: 1.6;
  }
  .snippet.open { display: block; }

  /* ── Footer ── */
  footer {
    text-align: center; padding: 24px; color: var(--muted); font-size: 0.8rem;
    border-top: 1px solid var(--border); margin-top: 32px;
  }

  /* ── Misc ── */
  @media (max-width: 768px) {
    .top-section { grid-template-columns: 1fr; }
    .header { flex-direction: column; text-align: center; }
    .header-meta { text-align: center; }
    .risk-banner { flex-direction: column; }
    .search-box { width: 100%; }
  }
  .hidden { display: none !important; }
</style>
</head>
<body>

<!-- ── Header ── -->
<header class="header">
  <div class="logo">
    <div class="logo-icon">🔍</div>
    <div>
      <h1>Vault<span>Sentry</span></h1>
      <div style="color:var(--muted);font-size:.85rem">Secret Scan Report</div>
    </div>
  </div>
  <div class="header-meta">
    <div><strong>Target:</strong> ${escHtml(scanOutput.target)}</div>
    <div><strong>Scan ID:</strong> ${escHtml(scanOutput.scanId)}</div>
    <div><strong>Generated:</strong> ${escHtml(generatedAt)}</div>
  </div>
</header>

<main>

  <!-- ── Risk Banner ── -->
  <div class="risk-banner">
    <div class="risk-info">
      <h2>Overall Risk Score</h2>
      <div class="risk-score" style="color:${riskColor}">${risk}</div>
      <div class="risk-label" style="color:${riskColor}">${riskLabel}</div>
    </div>
    <div style="flex:1;min-width:200px;max-width:400px">
      <div style="margin-bottom:8px;font-size:.8rem;color:var(--muted)">Risk Level</div>
      <div class="risk-bar-wrap">
        <div class="risk-bar" style="width:${risk}%;background:${riskColor}"></div>
      </div>
    </div>
    <div class="scan-meta">
      <div>⏱ Duration: <strong>${scanOutput.durationMs}ms</strong></div>
      <div>📅 Started: <strong>${new Date(scanOutput.startedAt).toLocaleTimeString()}</strong></div>
      <div>✅ Completed: <strong>${new Date(scanOutput.completedAt).toLocaleTimeString()}</strong></div>
      ${scanOutput.errors && scanOutput.errors.length > 0
        ? `<div>⚠️ Errors: <strong style="color:#ff6b6b">${scanOutput.errors.length}</strong></div>`
        : ''}
    </div>
  </div>

  <!-- ── Stats Grid ── -->
  <div class="stats-grid">
    <div class="stat-card total">
      <div class="stat-icon">🎯</div>
      <div class="stat-number">${s.totalIssues}</div>
      <div class="stat-label">Total Issues</div>
    </div>
    <div class="stat-card critical">
      <div class="stat-icon">🔴</div>
      <div class="stat-number">${s.bySeverity.critical}</div>
      <div class="stat-label">Critical</div>
    </div>
    <div class="stat-card high">
      <div class="stat-icon">🟠</div>
      <div class="stat-number">${s.bySeverity.high}</div>
      <div class="stat-label">High</div>
    </div>
    <div class="stat-card medium">
      <div class="stat-icon">🟡</div>
      <div class="stat-number">${s.bySeverity.medium}</div>
      <div class="stat-label">Medium</div>
    </div>
    <div class="stat-card low">
      <div class="stat-icon">🟢</div>
      <div class="stat-number">${s.bySeverity.low}</div>
      <div class="stat-label">Low</div>
    </div>
    <div class="stat-card files">
      <div class="stat-icon">📁</div>
      <div class="stat-number">${s.filesScanned}</div>
      <div class="stat-label">Files Scanned</div>
    </div>
    <div class="stat-card files">
      <div class="stat-icon">⏭️</div>
      <div class="stat-number">${s.filesSkipped}</div>
      <div class="stat-label">Files Skipped</div>
    </div>
  </div>

  <!-- ── Donut chart + category breakdown ── -->
  ${buildTopSection(findings)}

  <!-- ── Findings Table ── -->
  <div class="findings-section">
    <div class="findings-header">
      <h2>🔎 Findings (${findings.length})</h2>
      <div class="controls">
        <input class="search-box" type="text" id="searchBox" placeholder="Search file, type, value…" oninput="filterTable()"/>
        <button class="filter-btn active" id="btn-all"      onclick="setFilter('all')">All</button>
        <button class="filter-btn critical" id="btn-critical" onclick="setFilter('critical')">Critical</button>
        <button class="filter-btn high"     id="btn-high"     onclick="setFilter('high')">High</button>
        <button class="filter-btn medium"   id="btn-medium"   onclick="setFilter('medium')">Medium</button>
        <button class="filter-btn low"      id="btn-low"      onclick="setFilter('low')">Low</button>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table id="findingsTable">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Category</th>
            <th>Type</th>
            <th>File / Line</th>
            <th>Value (masked)</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          ${buildRows(findings)}
        </tbody>
      </table>
    </div>
  </div>

  ${scanOutput.errors && scanOutput.errors.length > 0 ? buildErrorsSection(scanOutput.errors) : ''}

</main>

<footer>
  Generated by <strong>VaultSentry</strong> Node.js Scanning Engine &nbsp;•&nbsp;
  Scan ID: ${escHtml(scanOutput.scanId)} &nbsp;•&nbsp;
  ${escHtml(generatedAt)}
</footer>

<script>
  let currentFilter = 'all';

  function toggleSnippet(id) {
    const el = document.getElementById(id);
    el.classList.toggle('open');
    el.previousElementSibling.textContent = el.classList.contains('open')
      ? '📄 Hide code snippet' : '📄 Show code snippet';
  }

  function setFilter(severity) {
    currentFilter = severity;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + severity).classList.add('active');
    filterTable();
  }

  function filterTable() {
    const query = document.getElementById('searchBox').value.toLowerCase();
    const rows = document.querySelectorAll('#tableBody tr.finding-row');
    const snippetRows = document.querySelectorAll('#tableBody tr.snippet-row');

    rows.forEach((row, idx) => {
      const matchSev = currentFilter === 'all' || row.dataset.severity === currentFilter;
      const matchSearch = !query || row.textContent.toLowerCase().includes(query);
      const visible = matchSev && matchSearch;
      row.classList.toggle('hidden', !visible);
      if (snippetRows[idx]) snippetRows[idx].classList.toggle('hidden', !visible);
    });
  }
</script>
</body>
</html>`;
}

// ─── Top section: donut + category breakdown ──────────────────────────────────

function buildTopSection(findings) {
  if (!findings || findings.length === 0) return '';

  // Category breakdown
  const catCount = {};
  for (const f of findings) {
    catCount[f.category] = (catCount[f.category] || 0) + 1;
  }
  const sortedCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedCats[0]?.[1] || 1;

  const catBars = sortedCats.map(([cat, count]) => `
    <div class="cat-bar-item">
      <span class="cat-bar-label">${CATEGORY_ICON[cat] || '⚠️'} ${cat.replace('_', ' ')}</span>
      <div class="cat-bar-wrap">
        <div class="cat-bar" style="width:${Math.round((count / maxCount) * 100)}%"></div>
      </div>
      <span class="cat-bar-count">${count}</span>
    </div>`).join('');

  // Build the summary mock for donut
  const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (bySev[f.severity] !== undefined) bySev[f.severity]++;
  }

  return `
  <div class="top-section">
    <div class="donut-card">
      <h3>By Severity</h3>
      ${donutChart({ totalIssues: findings.length, bySeverity: bySev })}
      <div class="donut-legend">
        <div class="donut-legend-item"><span class="dot" style="background:#ff3b3b"></span>Critical (${bySev.critical})</div>
        <div class="donut-legend-item"><span class="dot" style="background:#ff8c00"></span>High (${bySev.high})</div>
        <div class="donut-legend-item"><span class="dot" style="background:#f0c000"></span>Medium (${bySev.medium})</div>
        <div class="donut-legend-item"><span class="dot" style="background:#22c55e"></span>Low (${bySev.low})</div>
      </div>
    </div>
    <div class="top-cat-card">
      <h3>Findings by Category</h3>
      ${catBars}
    </div>
  </div>`;
}

// ─── Errors section ───────────────────────────────────────────────────────────

function buildErrorsSection(errors) {
  const items = errors.map(e => `<li style="color:#ff6b6b;font-size:.85rem;padding:4px 0">${escHtml(e)}</li>`).join('');
  return `
  <div style="background:var(--surface);border:1px solid #7a0000;border-radius:var(--radius);padding:20px;margin-top:24px">
    <h3 style="color:#ff6b6b;margin-bottom:12px">⚠️ Scan Errors (${errors.length})</h3>
    <ul style="padding-left:20px">${items}</ul>
  </div>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a self-contained HTML report from a scan output object.
 * @param {Object} scanOutput  The JSON object returned by main.js / directoryScanner.js
 * @returns {string}           Full HTML string
 */
function generateHtmlReport(scanOutput) {
  return buildHtml(scanOutput);
}

/**
 * Write an HTML report to a file.
 * @param {Object} scanOutput
 * @param {string} outputPath   Absolute or relative path for the .html file
 */
async function writeHtmlReport(scanOutput, outputPath) {
  const html = generateHtmlReport(scanOutput);
  await fs.promises.writeFile(outputPath, html, 'utf8');
}

module.exports = { generateHtmlReport, writeHtmlReport };
