'use strict';

/**
 * VaultSentry — Repository Scanner
 * repoScanner.js
 *
 * Clones a remote Git repository (GitHub, GitLab, Bitbucket, etc.) into a
 * temporary directory, runs the secret scanner, then cleans up.
 *
 * Dependencies: none (uses Node.js child_process + fs)
 */

const { execFile }  = require('child_process');
const { promisify } = require('util');
const fs            = require('fs');
const path          = require('path');
const os            = require('os');
const { scanDirectory } = require('./directoryScanner');
const logger        = require('./logger');

const execFileAsync = promisify(execFile);

// ─── Temp directory helpers ───────────────────────────────────────────────────

/**
 * Create a unique temporary directory for the cloned repo.
 * @returns {Promise<string>} Absolute path to the temp dir.
 */
async function makeTempDir() {
  const base = path.join(os.tmpdir(), `vaultsentry-${Date.now()}`);
  await fs.promises.mkdir(base, { recursive: true });
  return base;
}

/**
 * Recursively remove a directory (temp cleanup).
 * @param {string} dir
 */
async function removeDir(dir) {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
    logger.debug(`Cleaned up temp dir: ${dir}`);
  } catch (err) {
    logger.warn(`Could not clean up temp dir ${dir}: ${err.message}`);
  }
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

/**
 * Verify that git is available on PATH.
 * @throws {Error} if git is not found.
 */
async function checkGitAvailable() {
  try {
    await execFileAsync('git', ['--version']);
  } catch {
    throw new Error(
      'git is not installed or not on PATH. ' +
      'Please install Git: https://git-scm.com/downloads'
    );
  }
}

/**
 * Clone a repository into a target directory.
 *
 * @param {string} repoUrl    e.g. "https://github.com/owner/repo"
 * @param {string} targetDir  Absolute path to clone into
 * @param {Object} [opts]
 * @param {string} [opts.branch]    Branch to clone (default: repo default)
 * @param {number} [opts.depth=1]   Shallow clone depth (1 = latest commit only)
 * @param {number} [opts.timeout]   Timeout in ms (default: 120_000)
 */
async function cloneRepo(repoUrl, targetDir, opts = {}) {
  const { branch, depth = 1, timeout = 120_000 } = opts;

  const args = ['clone', '--quiet'];

  if (depth && depth > 0) {
    args.push('--depth', String(depth));
  }
  if (branch) {
    args.push('--branch', branch);
  }

  args.push(repoUrl, targetDir);

  logger.info(`Cloning ${repoUrl} (depth=${depth})…`);

  try {
    await execFileAsync('git', args, { timeout });
  } catch (err) {
    // Git writes progress to stderr, which causes execFile to "throw" even on success.
    // Verify the clone actually failed by checking if target dir has contents.
    try {
      const entries = await fs.promises.readdir(targetDir);
      if (entries.length > 0) {
        // Clone actually succeeded — git just wrote to stderr
        logger.debug(`Clone produced stderr but directory has ${entries.length} entries — treating as success`);
        logger.info(`Clone complete → ${targetDir}`);
        return;
      }
    } catch { /* directory doesn't exist → real failure */ }
    
    // If branch was specified and failed, retry without branch (use repo default)
    const msg = err.stderr || err.message || '';
    if (branch && (msg.includes('not found') || msg.includes('Remote branch'))) {
      logger.warn(`Branch '${branch}' not found, retrying with default branch...`);
      try {
        const fallbackArgs = ['clone', '--quiet'];
        if (depth && depth > 0) fallbackArgs.push('--depth', String(depth));
        fallbackArgs.push(repoUrl, targetDir);
        
        // Clean up partial clone
        await fs.promises.rm(targetDir, { recursive: true, force: true }).catch(() => {});
        await fs.promises.mkdir(targetDir, { recursive: true });
        
        await execFileAsync('git', fallbackArgs, { timeout });
      } catch (retryErr) {
        // Check if fallback clone succeeded despite stderr
        try {
          const entries = await fs.promises.readdir(targetDir);
          if (entries.length > 0) {
            logger.info(`Clone complete (default branch) → ${targetDir}`);
            return;
          }
        } catch { /* still failed */ }
        
        const retryMsg = retryErr.stderr || retryErr.message || 'Unknown git error';
        throw new Error(`git clone failed: ${retryMsg.trim()}`);
      }
      logger.info(`Clone complete (default branch) → ${targetDir}`);
      return;
    }
    
    throw new Error(`git clone failed: ${msg.trim()}`);
  }

  logger.info(`Clone complete → ${targetDir}`);
}

// ─── URL validation ───────────────────────────────────────────────────────────

/**
 * Basic validation that the URL looks like a git repository URL.
 * @param {string} url
 * @returns {boolean}
 */
function isGitUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return ['http:', 'https:', 'git:', 'ssh:'].includes(u.protocol);
  } catch {
    // Could be an SSH shorthand like git@github.com:org/repo.git
    return /^git@[\w.-]+:[\w./-]+\.git$/.test(url);
  }
}

/**
 * Extract a display name for the repo from the URL.
 * e.g. "https://github.com/owner/my-repo.git" → "owner/my-repo"
 * @param {string} url
 * @returns {string}
 */
function repoDisplayName(url) {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, '').replace(/\.git$/, '');
  } catch {
    return url.replace(/\.git$/, '').split(':').pop() || url;
  }
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RepoScanOptions
 * @property {string}   [branch]           Branch to clone  (default: repo default)
 * @property {number}   [depth=1]          Shallow clone depth
 * @property {boolean}  [maskValues=true]  Mask secret values in output
 * @property {boolean}  [useGitignore=true]
 * @property {number}   [concurrency=10]
 * @property {boolean}  [keepClone=false]  Do not delete the temp clone after scan
 * @property {Function} [onProgress]       Progress callback (scanned, total, file)
 */

/**
 * Clone a remote repository and scan it for secrets.
 *
 * @param {string}          repoUrl  Remote repository URL
 * @param {RepoScanOptions} [opts]
 * @returns {Promise<import('./directoryScanner').ScanSummary & { repoUrl: string, cloneDir?: string }>}
 */
async function scanRepository(repoUrl, opts = {}) {
  const {
    branch,
    depth = 1,
    maskValues = true,
    useGitignore = true,
    concurrency = 10,
    keepClone = false,
    onProgress,
  } = opts;

  // ── Validate URL ──
  if (!isGitUrl(repoUrl)) {
    throw new Error(`Invalid repository URL: "${repoUrl}"`);
  }

  // ── Check git binary ──
  await checkGitAvailable();

  // ── Create temp dir ──
  const tmpDir = await makeTempDir();

  try {
    // ── Clone ──
    await cloneRepo(repoUrl, tmpDir, { branch, depth });

    // ── Scan ──
    logger.info(`Starting scan of cloned repository…`);
    const summary = await scanDirectory(tmpDir, {
      maskValues,
      useGitignore,
      concurrency,
      onProgress,
    });

    // ── Rewrite file paths to be relative to the repo root ──
    // (trim the temp dir prefix so report shows clean paths)
    for (const finding of summary.findings) {
      finding.file = finding.file
        .replace(/\\/g, '/')
        .replace(tmpDir.replace(/\\/g, '/') + '/', '');
    }

    // ── Enrich summary ──
    summary.repoUrl = repoUrl;
    summary.repoName = repoDisplayName(repoUrl);
    summary.target = `${summary.repoName} (${repoUrl})`;

    if (keepClone) {
      summary.cloneDir = tmpDir;
      logger.info(`Clone retained at: ${tmpDir}`);
    }

    return summary;
  } finally {
    if (!keepClone) {
      await removeDir(tmpDir);
    }
  }
}

module.exports = {
  scanRepository,
  isGitUrl,
  repoDisplayName,
};
