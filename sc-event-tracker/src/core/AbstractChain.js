"use strict";
const axios = require("axios");

const { WorkflowEvent } = require("./event/WorkflowEvent");
const { Network } = require("./config/networks");
const { Logger, logger } = require("./utils/logger");
const {
  API_URL,
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
   * @param {WorkflowEvent} event - The chain to be handled.
   * @param {Logger} logger - The logger instance for logging messages.
   * @param {{networks: {[key: number]: Network}}} networks - The networks to use for the chain
   */
  constructor(event, logger, networks) {
    const { network: chainId } = event.workflow.node.data.config;
    // Handle both formats: { networks: {...} } and direct dictionary {...}
    const networksDict = networks.networks || networks;
    const network = networksDict[Number(chainId)];
    this.chain = event.workflow.node.data.config.network;
    this.logger = logger;
    this.event = event;
    this.network = network;
    this.contractTransaction = null;
    this.contractInformation = null;
  }

  async getProvider() {
    throw new Error("Method not implemented");
  }

  /**
   * Listens for blockchain events emitted from a specified target address.
   *
   * @param {Object} params - Parameters for the event listener.
   * @param {string} params.target - The target contract address to listen for events.
   */
  async listenEvent() {
    throw new Error("Method not implemented");
  }

  /**
   * Notifies a target with a given payload.
   *
   * @param {string} targetId - The ID of the target to notify.
   * @param {{id: string, operator: {name: string, type: string}, option: {name: string, type: string}, value: string, validatedValue: string, validation: boolean}[] } payload - The payload to be sent to the target.
   * @returns {Promise<boolean>} True if the notification was successful, false otherwise.
   */
  async notify(targetId, payload, type) {
    try {
      payload.forEach((condition) => {
        logger.log(
          `Condition: ${condition?.id?.toString()} - ${condition?.value?.toString()} ${condition?.operator?.type?.toString()} ${condition?.validatedValue?.toString()}`
        );
      });

      const url = `${WORKER_URL}/notify/${targetId}`;

      const { data } = await axios.post(url, {
        type,
        logs: this.executionLogs.logs,
        keeperSnapshot: payload
          ? {
              conditions: JSON.stringify(payload)
                .replace(/["'\\]/g, (match) => {
                  if (match === '"') return "__TMP__";
                  if (match === "'") return '"';
                  if (match === "\\") return "";
                  return match;
                })
                .replace(/__TMP__/g, "'"),
            }
          : {
              conditions: "",
            },
      });

      return data;
    } catch (error) {
      logger.error(`Error notifying target ${targetId}: ${error.message}`);
      return false;
    }
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

    const { data } = await axios.post(`${API_URL}/auth/token`, payload, {
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
   * Saves execution logs and keeper snapshot data to the worker service.
   *
   * @param {Array} notificationsSent - An array of notifications sent based on conditions.
   *
   * This function posts the current execution logs and a snapshot of the keeper's
   * conditions and notifications to a specified worker URL. The logs are cleared
   * after successful posting. If an error occurs during the process, it logs the error.
   */

  async saveLogs(
    notificationsSent,
    transferSent,
    webhookSent,
    conditions,
    triggerType
  ) {
    try {
      const url = `${WORKER_URL}/logs/${this.event.id}`;
      logger.log(`Saving logs to ${transferSent.transfer_amount}`);

      const response = await axios.post(url, {
        logs: this.executionLogs.logs[1],
        keeperSnapshot: conditions
          ? {
              conditions,
              selected_notifications: this.event.selectedNotifications,
              notifications_sent_based_on_conditions: notificationsSent,
              transfer_sent: transferSent,
              webhook: webhookSent,
            }
          : {
              conditions: [],
              selected_notifications: this.event.selectedNotifications,
              notifications_sent_based_on_conditions: notificationsSent,
              transfer_sent: transferSent,
              webhook: webhookSent,
            },
        matchesCondition: triggerType
          ? triggerType === "success"
            ? true
            : false
          : true,
      });
      const executionId = response.data;

      this.executionLogs.logs = [];
      return executionId;
    } catch (error) {
      logger.error(
        `Error saving logs for keeper ${keeperId}: ${error.message}`
      );
    }
  }

  /**
   * Logs an execution message with the correct format.
   *
   * @param {string} responseData - The raw log message (e.g., "Evaluating condition...", "Event validated...", etc.).
   * @param {number} timeTaken - The time taken to execute (in milliseconds or relevant unit).
   */
  logExecution(responseData, timeTaken = 0, success = true) {
    // Escape double quotes in the message to prevent issues with JSON parsing
    let escapedMessage = responseData.replace(/"/g, '\\"');

    // Replace double backslashes with a single one
    escapedMessage = escapedMessage.replace(/\\\\/g, "\\");

    const responseJson = {
      success,
      isReadFunction: false,
      data: {
        chainId: this.event.chain.code,
        addressAlias: this.event.contract.alias,
        eventName: this.event.function.name,
        functionName: this.event.function.name,
        from: this.contractTransaction?.from || null,
        to: this.contractTransaction?.to || null,
        gasLimit: this.contractTransaction?.gasLimit || null,
        maxFeePerGas: this.contractTransaction?.maxFeePerGas || null,
        maxPriorityFeePerGas:
          this.contractTransaction?.maxPriorityFeePerGas || null,
        nonce: this.contractTransaction?.nonce || null,
        hash: this.contractTransaction?.hash || null,
        data: this.contractTransaction?.data || null,
        output: this.contractTransaction?.output || null,
        value: this.contractTransaction?.value || null,
      },
      message: escapedMessage,
    };

    // Construct the log entry to match the frontend regex format
    const logObj = { response: responseJson };

    // Ensure logs are appended as a single string (not an array)
    this.executionLogs.logs.push(logObj);
  }

  /**
   * Clears the execution logs.
   */
  cleanLogs() {
    this.executionLogs.logs = [];
  }
}

module.exports = { AbstractChain };
