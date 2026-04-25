'use strict';

/**
 * engine/index.js — Public surface for the new scan engine.
 */

const { scanPath, scanFile } = require('./scanEngine');
const { validate }           = require('./validator');
const { assessEntropy, shannonEntropy } = require('./entropy');

module.exports = {
  scanPath,
  scanFile,
  validate,
  assessEntropy,
  shannonEntropy,
};
