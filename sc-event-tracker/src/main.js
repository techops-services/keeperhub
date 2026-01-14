"use strict";
const {
  handleActiveWorkflows,
  removeExcessProcesses,
} = require("./core/process-handlers/process.js");
const { fetchActiveWorkflows } = require("./core/utils/fetchUtils.js");
const { logger } = require("./core/utils/logger.js");

/**
 * @type {Object.<string, { process: import('child_process').ChildProcess, event: KeeperEvent}>}
 */
const childProcesses = {};

/**
 * Synchronizes data and manages child processes.
 */
async function synchronizeData() {
  logger.log("Synchronizing data");
  try {
    const { workflows, networks } = await fetchActiveWorkflows();

    logger.log(`Found ${workflows.length} workflows`);
    logger.log(`Found ${networks.length} networks`);
    if (!Array.isArray(workflows)) {
      throw new Error(
        "Invalid data received from database. Expected an array."
      );
    }

    removeExcessProcesses(workflows, childProcesses);

    await handleActiveWorkflows(workflows, childProcesses, networks);
  } catch (error) {
    logger.error(`Error during synchronization: ${error.message}`);
  }
}

module.exports = { synchronizeData };
