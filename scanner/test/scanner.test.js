#!/usr/bin/env node
'use strict';

/**
 * VaultSentry Scanner — Test Suite
 * Uses Node.js built-in assert (no extra test framework needed).
 */

const assert = require('assert');
const path = require('path');
const { scanFile } = require('../scanner');
const { scanDirectory } = require('../directoryScanner');
const { ALL_RULES } = require('../rules');

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

// ─── Test suites ──────────────────────────────────────────────────────────────

async function testRules() {
  console.log('\n── Rules module ──────────────────────────────────────────────');

  await test('ALL_RULES is a non-empty array', () => {
    assert.ok(Array.isArray(ALL_RULES), 'ALL_RULES should be an array');
    assert.ok(ALL_RULES.length > 0, 'ALL_RULES should not be empty');
  });

  await test('Each rule has required fields', () => {
    for (const rule of ALL_RULES) {
      assert.ok(rule.id, `Rule missing id: ${JSON.stringify(rule)}`);
      assert.ok(rule.type, `Rule "${rule.id}" missing type`);
      assert.ok(rule.category, `Rule "${rule.id}" missing category`);
      assert.ok(['critical', 'high', 'medium', 'low'].includes(rule.severity),
        `Rule "${rule.id}" has invalid severity: ${rule.severity}`);
      assert.ok(rule.pattern instanceof RegExp, `Rule "${rule.id}" pattern is not a RegExp`);
      assert.ok(rule.pattern.flags.includes('g'), `Rule "${rule.id}" pattern missing 'g' flag`);
      assert.ok(typeof rule.confidence === 'number', `Rule "${rule.id}" confidence must be a number`);
      assert.ok(rule.confidence >= 0 && rule.confidence <= 1,
        `Rule "${rule.id}" confidence must be 0–1`);
    }
  });

  await test('Rule IDs are unique', () => {
    const ids = ALL_RULES.map((r) => r.id);
    const unique = new Set(ids);
    assert.strictEqual(ids.length, unique.size, 'Duplicate rule IDs detected');
  });
}

async function testScanner() {
  console.log('\n── Scanner module ────────────────────────────────────────────');
  const fixturePath = path.join(__dirname, 'fixtures', 'fake_secrets.js');

  await test('scanFile returns an array', async () => {
    const results = await scanFile(fixturePath);
    assert.ok(Array.isArray(results), 'scanFile should return an array');
  });

  await test('Detects AWS Access Key', async () => {
    const results = await scanFile(fixturePath);
    const found = results.find((f) => f.ruleId === 'aws-access-key-id');
    assert.ok(found, 'Should detect AWS Access Key ID');
  });

  await test('Detects GitHub PAT', async () => {
    const results = await scanFile(fixturePath);
    const found = results.find((f) => f.ruleId === 'github-pat-classic');
    assert.ok(found, 'Should detect GitHub PAT');
  });

  await test('Detects JWT token', async () => {
    const results = await scanFile(fixturePath);
    const found = results.find((f) => f.ruleId === 'jwt-token');
    assert.ok(found, 'Should detect JWT token');
  });

  await test('Detects hardcoded password', async () => {
    const results = await scanFile(fixturePath);
    const found = results.find((f) => f.ruleId === 'hardcoded-password');
    assert.ok(found, 'Should detect hardcoded password');
  });

  await test('Detects Stripe key', async () => {
    const results = await scanFile(fixturePath);
    const found = results.find((f) => f.ruleId === 'stripe-key');
    assert.ok(found, 'Should detect Stripe API key');
  });

  await test('Detects PostgreSQL connection string', async () => {
    const results = await scanFile(fixturePath);
    const found = results.find((f) => f.ruleId === 'postgres-connection');
    assert.ok(found, 'Should detect PostgreSQL DSN');
  });

  await test('Values are masked by default', async () => {
    const results = await scanFile(fixturePath, { maskValues: true });
    for (const finding of results) {
      assert.ok(finding.value.includes('*') || finding.value.length <= 8,
        `Value "${finding.value}" should be masked`);
    }
  });

  await test('Each finding has required fields', async () => {
    const results = await scanFile(fixturePath);
    for (const f of results) {
      assert.ok(f.id, 'Finding must have id');
      assert.ok(f.type, 'Finding must have type');
      assert.ok(f.category, 'Finding must have category');
      assert.ok(f.severity, 'Finding must have severity');
      assert.ok(typeof f.line === 'number' && f.line > 0, 'Finding must have valid line number');
      assert.ok(f.file, 'Finding must have file path');
      assert.ok(f.hash, 'Finding must have hash');
    }
  });

  await test('Findings are deduplicated within a file', async () => {
    const results = await scanFile(fixturePath);
    const ids = results.map((f) => f.id);
    const unique = new Set(ids);
    assert.strictEqual(ids.length, unique.size, 'Duplicate findings detected in file scan');
  });
}

async function testDirectoryScanner() {
  console.log('\n── Directory scanner ─────────────────────────────────────────');
  const fixtureDir = path.join(__dirname, 'fixtures');

  await test('scanDirectory returns a summary object', async () => {
    const summary = await scanDirectory(fixtureDir);
    assert.ok(typeof summary === 'object', 'Should return an object');
    assert.ok(typeof summary.filesScanned === 'number', 'Should have filesScanned');
    assert.ok(typeof summary.totalIssues === 'number', 'Should have totalIssues');
    assert.ok(Array.isArray(summary.findings), 'Should have findings array');
    assert.ok(summary.scanId, 'Should have scanId');
    assert.ok(summary.startedAt, 'Should have startedAt');
    assert.ok(summary.completedAt, 'Should have completedAt');
    assert.ok(typeof summary.durationMs === 'number', 'Should have durationMs');
  });

  await test('Summary counts are consistent', async () => {
    const summary = await scanDirectory(fixtureDir);
    const total = summary.critical + summary.high + summary.medium + summary.low;
    assert.strictEqual(total, summary.totalIssues,
      `Severity counts (${total}) must equal totalIssues (${summary.totalIssues})`);
  });

  await test('Findings are globally deduplicated', async () => {
    const summary = await scanDirectory(fixtureDir);
    const ids = summary.findings.map((f) => f.id);
    const unique = new Set(ids);
    assert.strictEqual(ids.length, unique.size, 'Duplicate findings in directory scan');
  });

  await test('Findings are sorted by severity', async () => {
    const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
    const summary = await scanDirectory(fixtureDir);
    for (let i = 1; i < summary.findings.length; i++) {
      const prev = SEVERITY_ORDER[summary.findings[i - 1].severity] ?? 4;
      const curr = SEVERITY_ORDER[summary.findings[i].severity] ?? 4;
      assert.ok(curr >= prev, 'Findings should be sorted from critical to low');
    }
  });

  await test('Rejects invalid directory', async () => {
    try {
      await scanDirectory('/this/path/does/not/exist/at/all');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.includes('Invalid scan target') || err.message.includes('ENOENT'),
        `Unexpected error: ${err.message}`);
    }
  });
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  VaultSentry Scanner — Test Suite            ║');
  console.log('╚══════════════════════════════════════════════╝');

  await testRules();
  await testScanner();
  await testDirectoryScanner();

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('──────────────────────────────────────────────────────────────\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
