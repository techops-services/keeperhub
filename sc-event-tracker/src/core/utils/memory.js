"use strict";
import { logger } from "./logger";

function logMemoryUsage() {
  const memoryUsage = process.memoryUsage();

  logger.log(
    `Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
  );
}

module.exports = { logMemoryUsage };
