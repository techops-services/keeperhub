"use strict";
const axios = require("axios");

const { WORKER_URL } = require("../config/environment.js");
const { logger } = require("./logger.js");

/**
 * Fetches active workflows from the worker service.
 *
 * @returns {Promise<{workflows: Array<import("../event/workflow-event").WorkflowEvent>, networks: {[key: number]: import("../config/networks").Network}}}> List of active workflows.
 */
async function fetchActiveWorkflows() {
  try {
    const { data } = await axios.get(`${WORKER_URL}/data`);

    return data;
  } catch (error) {
    logger.error(`Error fetching active workflows: ${error.message}`);
    return [];
  }
}

module.exports = { fetchActiveWorkflows };
