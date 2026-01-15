"use strict";
const axios = require("axios");

const { logger } = require("./utils/logger");
const {
  KEEPERHUB_API_URL,
  JWT_TOKEN_USERNAME,
  JWT_TOKEN_PASSWORD,
  WORKER_URL,
} = require("./config/environment");

class AbstractChain {
  executionLogs = {
    logs: [],
  };

  /**
   * Initializes a new instance of the AbstractChain class.
   *
   * @param {import("./event/workflow-event").WorkflowEvent} event - The chain to be handled.
   * @param {import("./utils/logger").Logger} loggerInstance - The logger instance for logging messages.
   * @param {{networks: {[key: number]: import("./config/networks").Network}}} networks - The networks to use for the chain
   */
  constructor(event, loggerInstance, networks) {
    const { network: chainId } = event.workflow.node.data.config;
    // Handle both formats: { networks: {...} } and direct dictionary {...}
    const networksDict = networks.networks || networks;
    const network = networksDict[Number(chainId)];
    this.chain = event.workflow.node.data.config.network;
    this.logger = loggerInstance;
    this.event = event;
    this.network = network;
    this.contractTransaction = null;
    this.contractInformation = null;
  }

  getProvider() {
    throw new Error("Method not implemented");
  }

  /**
   * Listens for blockchain events emitted from a specified target address.
   *
   * @param {Object} params - Parameters for the event listener.
   * @param {string} params.target - The target contract address to listen for events.
   */
  listenEvent() {
    throw new Error("Method not implemented");
  }

  async executeWorkflow(workflowId, payload) {
    try {
      const url = `${WORKER_URL}/workflow/${workflowId}/execute`;
      const { data } = await axios.post(url, payload);

      return data;
    } catch (error) {
      logger.error(`Error executing workflow: ${error.message}`);
      return false;
    }
  }

  async getWorkflowByKeeper(keeperId) {
    try {
      const url = `${WORKER_URL}/workflow/${keeperId}`;

      const { data } = await axios.get(url);
      console.log(`Workflow: ${JSON.stringify(data)}`);

      return data;
    } catch (error) {
      logger.error(`Error notifying target ${keeperId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Requests an authorization token from the API server.
   *
   * @returns {Promise<string>} The authorization token.
   */
  async authorize() {
    const payload = new URLSearchParams();
    payload.append("username", JWT_TOKEN_USERNAME);
    payload.append("password", JWT_TOKEN_PASSWORD);

    const { data } = await axios.post(`${KEEPERHUB_API_URL}/auth/token`, payload, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return data.access_token;
  }

  /**
   * Parses a given value according to its type.
   *
   * @param {*} value - The value to be parsed
   * @param {string} type - The type of the value
   * @returns {*} The parsed value
   */
  parseDataType(value, type) {
    if (type === "address") {
      return `"${String(value)}"`;
    }

    if (type === "string") {
      return `"${String(value)}"`;
    }

    if (type === "bool") {
      return `"${Boolean(value)}"`;
    }

    if (type === "bytes") {
      return `"${String(value)}"`;
    }

    if (type === "bytes32") {
      return `"${String(value)}"`;
    }

    if (type.includes("uint")) {
      return `"${BigInt(value)}"`;
    }

    if (type.includes("int")) {
      return `"${BigInt(value)}"`;
    }

    return value;
  }

  /**
   * Clears the execution logs.
   */
  cleanLogs() {
    this.executionLogs.logs = [];
  }
}

module.exports = { AbstractChain };
