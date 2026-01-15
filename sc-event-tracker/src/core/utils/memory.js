"use strict";
const { logger } = require("./logger.js");

function logMemoryUsage() {
  const memoryUsage = process.memoryUsage();

  logger.log(
    `Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
  );
}

module.exports = { logMemoryUsage };
