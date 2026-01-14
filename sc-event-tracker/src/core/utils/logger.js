"use strict";
class Logger {
  /**
   * @param {console} logger - The logger object to use.
   */
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Logs a message at the 'log' level
   * @param {*} message The message to log
   * @example
   * const logger = new Logger(console);
   * logger.log('Something happened');
   * @example
   * const { logger } = require('./logger');
   * logger.log('Something happened');
   */
  log(message) {
    this.logger.log(
      `log :: ${new Date().toISOString()} - ${this.stringyfy(message)}`
    );
  }

  /**
   * Logs a message at the 'error' level
   * @param {*} message The message to log
   * @example
   * const logger = new Logger(console);
   * logger.error('Something went wrong');
   * @example
   * const { logger } = require('./logger');
   * logger.error('Something went wrong');
   */
  error(message) {
    this.logger.error(
      `error :: ${new Date().toISOString()} - ${this.stringyfy(message)}`
    );
  }

  /**
   * Logs a message at the 'warn' level
   * @param {*} message The message to log
   * @example
   * const logger = new Logger(console);
   * logger.warn('Something might go wrong');
   * @example
   * const { logger } = require('./logger');
   * logger.warn('Something might go wrong');
   */
  warn(message) {
    this.logger.warn(
      `warn :: ${new Date().toISOString()} - ${this.stringyfy(message)}`
    );
  }

  stringyfy(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Formats a contract address in the format 12et3...h4v2i
   * @param {string} address The full contract address
   * @returns {string} The formatted address
   */
  formatAddress(address) {
    if (!address || address.length < 10) {
      return address;
    }
    // Remove '0x' prefix if present
    const cleanAddress = address.startsWith("0x") ? address.slice(2) : address;
    // Take first 5 characters and last 5 characters
    return `${cleanAddress.slice(0, 5)}...${cleanAddress.slice(-5)}`;
  }
}

const logger = new Logger(console);

module.exports = { logger, Logger };
