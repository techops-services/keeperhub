"use strict";
const axios = require("axios");

const { WORKER_URL } = require("../config/environment.js");

const { WorkflowEvent } = require("../event/WorkflowEvent.js");
const { Network } = require("../config/networks.js");

/**
 * Fetches active workflows from the worker service.
 *
 * @returns {Promise<{workflows: Array<WorkflowEvent>, networks: {[key: number]: Network}}}> List of active workflows.
 */
async function fetchActiveWorkflows() {
  try {
    const { data } = await axios.get(`${WORKER_URL}/data`);

    return data;
  } catch (error) {
    console.error("Error fetching parseEvents:", error.message);
    return [];
  }
}

module.exports = { fetchActiveWorkflows };
