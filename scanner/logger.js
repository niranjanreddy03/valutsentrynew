'use strict';

/**
 * VaultSentry Node.js Scanning Engine
 * logger.js — Lightweight structured logger
 *
 * Provides log levels: debug | info | warn | error
 * Controlled by the LOG_LEVEL environment variable (default: info).
 * Output goes to stderr so that stdout stays clean for JSON results.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const CURRENT_LEVEL = LEVELS[LOG_LEVEL] !== undefined ? LEVELS[LOG_LEVEL] : LEVELS.info;

const COLORS = {
  debug: '\x1b[36m',   // cyan
  info:  '\x1b[32m',   // green
  warn:  '\x1b[33m',   // yellow
  error: '\x1b[31m',   // red
  reset: '\x1b[0m',
};

/**
 * Emit a log message to stderr.
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 */
function log(level, message) {
  if (LEVELS[level] < CURRENT_LEVEL) return;

  const ts = new Date().toISOString();
  const color = COLORS[level] || '';
  const reset = COLORS.reset;
  const label = level.toUpperCase().padEnd(5);

  process.stderr.write(`${color}[${ts}] [${label}] ${message}${reset}\n`);
}

const logger = {
  debug: (msg) => log('debug', msg),
  info:  (msg) => log('info',  msg),
  warn:  (msg) => log('warn',  msg),
  error: (msg) => log('error', msg),
};

module.exports = logger;
