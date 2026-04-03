#!/usr/bin/env node
'use strict';

/**
 * VaultSentry Node.js Scanning Engine
 * main.js — CLI entry point
 *
 * Usage:
 *   node main.js [options] <directory>
 *   node main.js --repo <git-url> [options]
 *
 * Options:
 *   --repo <url>          Clone & scan a remote Git repository
 *   --branch <name>       Branch to checkout when using --repo
 *   --report [file]       Generate an HTML report (default: report.html)
 *   --output <file>       Write JSON results to a file (default: stdout)
 *   --no-mask             Expose full secret values (use with caution!)
 *   --no-gitignore        Ignore .gitignore files
 *   --concurrency <n>     Parallel file workers (default: 10)
 *   --min-severity <lvl>  Filter results: critical|high|medium|low (default: low)
 *   --summary-only        Only print the summary, not the full findings array
 *   --quiet               Suppress progress output (only errors on stderr)
 *   --help                Show this help message
 */

const path = require('path');
const fs   = require('fs');
const { scanDirectory }  = require('./directoryScanner');
const { scanRepository } = require('./repoScanner');
const { writeHtmlReport } = require('./report');
const logger = require('./logger');

// ─── CLI argument parser ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    repo:        null,   // --repo <url>
    branch:      null,   // --branch <name>
    report:      false,  // --report [file]
    reportFile:  null,   // resolved report path
    output:      null,
    maskValues:  true,
    useGitignore: true,
    concurrency: 10,
    minSeverity: 'low',
    summaryOnly: false,
    quiet:       false,
    help:        false,
    target:      null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--repo') {
      opts.repo = args[++i];
    } else if (arg === '--branch') {
      opts.branch = args[++i];
    } else if (arg === '--report') {
      opts.report = true;
      // Peek at next arg: if it doesn't start with '--' and isn't the positional target, treat as filename
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        opts.reportFile = args[++i];
      }
    } else if (arg === '--output' || arg === '-o') {
      opts.output = args[++i];
    } else if (arg === '--no-mask') {
      opts.maskValues = false;
    } else if (arg === '--no-gitignore') {
      opts.useGitignore = false;
    } else if (arg === '--concurrency') {
      const n = parseInt(args[++i], 10);
      if (!isNaN(n) && n > 0) opts.concurrency = n;
    } else if (arg === '--min-severity') {
      const lvl = (args[++i] || '').toLowerCase();
      if (['critical', 'high', 'medium', 'low'].includes(lvl)) {
        opts.minSeverity = lvl;
      }
    } else if (arg === '--summary-only') {
      opts.summaryOnly = true;
    } else if (arg === '--quiet' || arg === '-q') {
      opts.quiet = true;
    } else if (!arg.startsWith('--')) {
      opts.target = arg;
    }
  }

  return opts;
}

// ─── Help text ────────────────────────────────────────────────────────────────

function printHelp() {
  process.stdout.write(`
VaultSentry — Secret Scanner (Node.js Engine)
=============================================

Usage:
  node main.js [options] <directory>       Scan a local directory
  node main.js --repo <git-url> [options]  Clone & scan a remote repository

Arguments:
  <directory>              Path to the project directory to scan

Core Options:
  --repo <url>             Clone and scan a remote Git repository URL
  --branch <name>          Branch to checkout (used with --repo)
  --report [file]          Generate an HTML report  (default: report.html)
  --output <file>          Write JSON results to a file  (default: stdout)
  --no-mask                Expose full secret values  ⚠️  use with caution
  --no-gitignore           Ignore .gitignore rules during traversal
  --concurrency <n>        Parallel file workers  (default: 10)
  --min-severity <lvl>     Filter findings by severity  (default: low)
                           Values: critical | high | medium | low
  --summary-only           Print only summary, skip the findings array
  --quiet, -q              Suppress progress bar; only errors on stderr
  --help, -h               Show this help

Environment:
  LOG_LEVEL=debug|info|warn|error   Controls stderr log verbosity

Examples:
  # Scan a local directory
  node main.js ./src

  # Scan a local directory and generate an HTML report
  node main.js --report ./src
  node main.js --report my-report.html --min-severity high ./my-project

  # Clone & scan a GitHub repo
  node main.js --repo https://github.com/owner/repo

  # Clone a specific branch and generate a report
  node main.js --repo https://github.com/owner/repo --branch develop --report

  # Full example
  node main.js --repo https://github.com/owner/repo --min-severity high --report scan.html --output results.json
`);
}

// ─── Severity filter ──────────────────────────────────────────────────────────

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function filterBySeverity(findings, minSeverity) {
  const threshold = SEVERITY_ORDER[minSeverity] ?? 3;
  return findings.filter((f) => (SEVERITY_ORDER[f.severity] ?? 3) <= threshold);
}

// ─── Output formatter ─────────────────────────────────────────────────────────

function buildOutput(summary, opts) {
  const filtered = filterBySeverity(summary.findings, opts.minSeverity);

  const output = {
    scanId:      summary.scanId,
    target:      summary.target,
    repoUrl:     summary.repoUrl || null,
    repoName:    summary.repoName || null,
    startedAt:   summary.startedAt,
    completedAt: summary.completedAt,
    durationMs:  summary.durationMs,
    summary: {
      filesScanned: summary.filesScanned,
      filesSkipped: summary.filesSkipped,
      totalIssues:  filtered.length,
      bySeverity: {
        critical: filtered.filter((f) => f.severity === 'critical').length,
        high:     filtered.filter((f) => f.severity === 'high').length,
        medium:   filtered.filter((f) => f.severity === 'medium').length,
        low:      filtered.filter((f) => f.severity === 'low').length,
      },
    },
    errors: summary.errors,
  };

  if (!opts.summaryOnly) {
    output.findings = filtered.map((f) => ({
      type:        f.type,
      severity:    f.severity,
      file:        f.file,
      line:        f.line,
      value:       f.value,
      maskedValue: f.maskedValue,
      category:    f.category,
      ruleId:      f.ruleId,
      confidence:  f.confidence,
      isTestFile:  f.isTestFile,
      hash:        f.hash,
      snippet:     f.snippet,
    }));
  }

  return output;
}

// ─── Progress printer ─────────────────────────────────────────────────────────

function makeProgressCallback(quiet) {
  if (quiet) return null;
  let lastPct = -1;
  return (scanned, total) => {
    const pct = Math.floor((scanned / total) * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      const filled = Math.floor(pct / 5);
      const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
      process.stderr.write(`\r  [${bar}] ${pct}%  (${scanned}/${total} files)`);
    }
  };
}

// ─── Summary box ─────────────────────────────────────────────────────────────

function printSummaryBox(output, reportPath) {
  const s = output.summary;
  const repoLine = output.repoUrl
    ? `║  Repository     : ${String(output.repoName || output.repoUrl).padEnd(22)}║\n`
    : '';
  const reportLine = reportPath
    ? `║  Report         : ${String(path.basename(reportPath)).padEnd(22)}║\n`
    : '';

  process.stderr.write(`
╔══════════════════════════════════════════╗
║         VaultSentry Scan Summary         ║
╠══════════════════════════════════════════╣
${repoLine}║  Files scanned  : ${String(s.filesScanned).padEnd(22)}║
║  Files skipped  : ${String(s.filesSkipped).padEnd(22)}║
║  Total issues   : ${String(s.totalIssues).padEnd(22)}║
╠══════════════════════════════════════════╣
║  🔴 Critical    : ${String(s.bySeverity.critical).padEnd(22)}║
║  🟠 High        : ${String(s.bySeverity.high).padEnd(22)}║
║  🟡 Medium      : ${String(s.bySeverity.medium).padEnd(22)}║
║  🟢 Low         : ${String(s.bySeverity.low).padEnd(22)}║
╠══════════════════════════════════════════╣
║  Duration       : ${String(output.durationMs + 'ms').padEnd(22)}║
${reportLine}╚══════════════════════════════════════════╝
`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  // ── Validate: must have --repo OR a local target ──
  if (!opts.repo && !opts.target) {
    process.stderr.write('Error: Specify a directory to scan or use --repo <url>.\n\n');
    printHelp();
    process.exit(1);
  }

  const onProgress = makeProgressCallback(opts.quiet);

  // ── Run the appropriate scanner ──
  let summary;
  try {
    if (opts.repo) {
      // ── Remote repository ──
      logger.info(`Repo scan mode: ${opts.repo}`);
      summary = await scanRepository(opts.repo, {
        branch:      opts.branch,
        maskValues:  opts.maskValues,
        useGitignore: opts.useGitignore,
        concurrency: opts.concurrency,
        onProgress,
      });
    } else {
      // ── Local directory ──
      const targetPath = path.resolve(opts.target);
      try {
        await fs.promises.access(targetPath);
      } catch {
        process.stderr.write(`Error: Directory not found: ${targetPath}\n`);
        process.exit(1);
      }
      summary = await scanDirectory(targetPath, {
        maskValues:    opts.maskValues,
        includeRawValue: !opts.maskValues,
        useGitignore:  opts.useGitignore,
        concurrency:   opts.concurrency,
        onProgress,
      });
    }
  } catch (err) {
    if (!opts.quiet) process.stderr.write('\n');
    process.stderr.write(`Fatal error: ${err.message}\n`);
    process.exit(1);
  }

  // Clear progress line
  if (!opts.quiet) process.stderr.write('\r' + ' '.repeat(70) + '\r');

  const output = buildOutput(summary, opts);

  // ── Write JSON output ──
  const json = JSON.stringify(output, null, 2);
  if (opts.output) {
    const outPath = path.resolve(opts.output);
    try {
      await fs.promises.writeFile(outPath, json, 'utf8');
      logger.info(`JSON results written to ${outPath}`);
    } catch (err) {
      process.stderr.write(`Error writing output file: ${err.message}\n`);
      process.exit(1);
    }
  } else if (!opts.report) {
    // Only dump JSON to stdout when not generating a report (avoid mixing with report path msg)
    process.stdout.write(json + '\n');
  }

  // ── Generate HTML report ──
  let reportPath = null;
  if (opts.report) {
    // Determine report filename
    let reportFile = opts.reportFile;
    if (!reportFile) {
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const slug = (output.repoName || opts.target || 'scan')
        .replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      reportFile = `report_${slug}_${ts}.html`;
    }
    reportPath = path.resolve(reportFile);

    try {
      await writeHtmlReport(output, reportPath);
      process.stderr.write(`\n📊 HTML Report → ${reportPath}\n`);
    } catch (err) {
      process.stderr.write(`Error writing report: ${err.message}\n`);
      process.exit(1);
    }
  }

  // ── Summary box ──
  if (!opts.quiet) printSummaryBox(output, reportPath);

  // Exit 1 if critical/high found (CI-friendly)
  const criticalOrHigh = output.summary.bySeverity.critical + output.summary.bySeverity.high;
  process.exit(criticalOrHigh > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err.stack || err.message}\n`);
  process.exit(1);
});
