"use strict";
const os = require("node:os");
const { logger } = require("./src/core/utils/logger.js");

const { syncModule } = require("./src/core/synchronization/redis.js");

const { synchronizeData } = require("./src/main.js");

logger.log(`Initializing container: ${os.hostname()}`);

/**
 * Initializes the container and sets up synchronization intervals.
 */
const initialize = async () => {
  try {
    await syncModule.removeAllContainers();
    await syncModule.registerContainer();
    await synchronizeData();

    logger.log("Initialization complete.");
  } catch (error) {
    logger.error(`Error during initialization: ${error.message}`);
  }
};

setInterval(synchronizeData, 30_000);

initialize();
