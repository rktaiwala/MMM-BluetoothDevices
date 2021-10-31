'use strict';

const OralBToothbrush = require('./OralBToothbrush');
const SmartMatic = require('./SmartMatic');
const devices = {
  OralBToothbrush,
  SmartMatic,
};

/**
 * @param {object} options
 * @param {string} options.type
 * @param {import('../Logger')} logger
 */
module.exports.initialize = (options, logger) => {
  if (devices[options.type]) {
    return new devices[options.type](options, logger);
  }

  throw new Error(`unknown device: ${options.type}`);
};
