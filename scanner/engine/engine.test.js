'use strict';

/**
 * engine.test.js — Black-box tests for the new scan engine.
 *
 * Run: node scanner/engine/engine.test.js
 *
 * No external test runner required — plain asserts with pretty output.
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const assert = require('assert');

const { scanPath } = require('./scanEngine');
const { assessEntropy } = require('./entropy');
const { validate, isPlaceholder } = require('./validator');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function withTempDir(fn) {
  // NOTE: prefix must NOT contain 'test' / 'mock' / etc. — the validator
  // downgrades severity for paths that match test-file indicators.
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vs-scan-'));
  try { return await fn(dir); }
  finally { await fs.promises.rm(dir, { recursive: true, force: true }); }
}

function write(dir, name, content) {
  const p = path.join(dir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ ${name}\n      ${err.message}`); failed++; }
}

// ── Unit: entropy + validator ────────────────────────────────────────────────

async function unitTests() {
  console.log('\nUnit: entropy + validator');

  await test('entropy: low-entropy text is not suspicious', () => {
    const a = assessEntropy('password12345');
    assert.strictEqual(a.isSuspicious, false);
  });

  await test('entropy: 40-char base64 IS suspicious', () => {
    const a = assessEntropy('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    assert.strictEqual(a.isSuspicious, true);
    assert.ok(a.entropy > 4.0);
  });

  await test('validator: placeholder rejected', () => {
    assert.strictEqual(isPlaceholder('your-api-key-here'), true);
    assert.strictEqual(isPlaceholder('<YOUR_TOKEN>'), true);
    assert.strictEqual(isPlaceholder('xxxxxxxx'), true);
  });

  await test('validator: real-looking token accepted', () => {
    const v = validate({
      raw: 'AKIAIOSFODNN7EXAMPLE',
      ruleSeverity: 'critical',
      ruleConfidence: 0.95,
      filePath: 'src/app.js',
      category: 'aws',
    });
    assert.strictEqual(v.accepted, true);
    assert.strictEqual(v.severity, 'high');
    assert.strictEqual(v.confidence, 'high');
  });

  await test('validator: test-file downgrades severity', () => {
    const v = validate({
      raw: 'AKIAIOSFODNN7EXAMPLE',
      ruleSeverity: 'critical',
      ruleConfidence: 0.95,
      filePath: 'src/__tests__/app.test.js',
      category: 'aws',
    });
    assert.strictEqual(v.severity, 'medium');
  });

  await test('validator: low-diversity value rejected', () => {
    const v = validate({
      raw: 'aaaaaaaaaaaaaaaa',
      ruleSeverity: 'high',
      ruleConfidence: 0.9,
      filePath: 'x.js',
      category: 'api_key',
    });
    assert.strictEqual(v.accepted, false);
  });
}

// ── Integration: scanPath ────────────────────────────────────────────────────

async function integrationTests() {
  console.log('\nIntegration: scanPath always returns a result');

  await test('no secrets → status=completed, message=No secrets detected', async () => {
    await withTempDir(async (dir) => {
      write(dir, 'app.js', `
        function greet(name) { return "hello " + name; }
        module.exports = { greet };
      `);
      const r = await scanPath(dir);
      assert.strictEqual(r.status, 'completed');
      assert.strictEqual(r.total_found, 0);
      assert.strictEqual(r.message, 'No secrets detected');
      assert.strictEqual(r.confidence, 'high');
    });
  });

  await test('AWS key in source → high-severity finding with masked value', async () => {
    await withTempDir(async (dir) => {
      write(dir, 'app.js', `const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";\n`);
      const r = await scanPath(dir);
      assert.strictEqual(r.status, 'completed');
      assert.strictEqual(r.total_found, 1);
      const s = r.secrets[0];
      assert.match(s.type, /AWS/i);
      assert.strictEqual(s.severity, 'high');
      assert.match(s.value, /^AKIA\*+/);           // masked
      assert.strictEqual(path.basename(s.file), 'app.js');
      assert.strictEqual(s.line, 1);
    });
  });

  await test('.env file is scanned (not skipped)', async () => {
    await withTempDir(async (dir) => {
      write(dir, '.env', `GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789\n`);
      const r = await scanPath(dir);
      assert.strictEqual(r.total_found, 1);
      assert.match(r.secrets[0].type, /GitHub/i);
    });
  });

  await test('JWT in JSON config is detected', async () => {
    await withTempDir(async (dir) => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.sig_portion_xxxxxxxxxxxxxxx';
      write(dir, 'config.json', JSON.stringify({ auth: jwt }));
      const r = await scanPath(dir);
      assert.ok(r.total_found >= 1);
      assert.ok(r.secrets.some((s) => /JWT/i.test(s.type)));
    });
  });

  await test('RSA private key in YAML is detected', async () => {
    await withTempDir(async (dir) => {
      write(dir, 'secrets.yaml', [
        'key: |',
        '  -----BEGIN RSA PRIVATE KEY-----',
        '  MIIEpAIBAAKCAQEA1234567890abcdefghij',
        '  -----END RSA PRIVATE KEY-----',
      ].join('\n'));
      const r = await scanPath(dir);
      assert.ok(r.secrets.some((s) => /RSA/i.test(s.type)));
    });
  });

  await test('placeholder values are NOT reported', async () => {
    await withTempDir(async (dir) => {
      write(dir, 'config.js', `
        const API_KEY = "your-api-key-here";
        const TOKEN = "<INSERT_TOKEN>";
        const PASSWORD = "changeme";
      `);
      const r = await scanPath(dir);
      assert.strictEqual(r.total_found, 0, `expected 0 findings, got ${r.total_found}`);
    });
  });

  await test('entropy detects unknown high-entropy token', async () => {
    await withTempDir(async (dir) => {
      write(dir, 'app.py', `INTERNAL_TOKEN = "Zx9qP7Lk2Vn8Mh4Rt6Yw3Uc1Fa5Sd0Je"\n`);
      const r = await scanPath(dir);
      assert.ok(r.total_found >= 1);
      assert.ok(r.secrets.some((s) => s.source === 'entropy'));
    });
  });

  await test('binary file is skipped with reason', async () => {
    await withTempDir(async (dir) => {
      const bin = path.join(dir, 'logo.png');
      fs.writeFileSync(bin, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x00, 0x00]));
      write(dir, 'app.js', `// empty`);
      const r = await scanPath(dir);
      assert.strictEqual(r.status, 'completed');
      assert.ok(r.summary.filesSkipped >= 1);
    });
  });

  await test('missing target → status=error, visible message', async () => {
    const r = await scanPath('/path/definitely/does/not/exist/xyz123');
    assert.strictEqual(r.status, 'error');
    assert.match(r.message, /not found/i);
    assert.strictEqual(r.total_found, 0);
  });

  await test('progress callback is invoked', async () => {
    await withTempDir(async (dir) => {
      for (let i = 0; i < 5; i++) write(dir, `f${i}.js`, `// file ${i}`);
      let calls = 0;
      await scanPath(dir, { onProgress: () => { calls++; }, progressThrottleMs: 0 });
      assert.ok(calls >= 1, 'expected at least one progress tick');
    });
  });
}

// ── Runner ───────────────────────────────────────────────────────────────────

(async () => {
  console.log('VaultSentry engine test suite');
  console.log('─────────────────────────────');
  await unitTests();
  await integrationTests();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
