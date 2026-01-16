"use strict";
const { ethers } = require("ethers");
const { AbstractChain } = require("../abstract-chain.js");
const { logger } = require("../utils/logger.js");
const {
  NODE_ENV,
  REDIS_HOST,
  REDIS_PORT,
} = require("../config/environment.js");
const Redis = require("ioredis");

class EvmChain extends AbstractChain {
  /**
   * Creates a new EvmChain
   *
   * @param {import("../event/workflow-event.js").WorkflowEvent} options
   * @param {import("../utils/logger.js").Logger} loggerInstance - The logger instance for logging messages
   * @param {{networks: {[key: number]: import("../config/networks.js").Network}}} networks - The networks to use for the chain
   * @throws {Error} If the chain is not supported
   */
  constructor(options, loggerInstance, networks) {
    const { network: chainId } = options.workflow.node.data.config;

    // Handle both formats: { networks: {...} } and direct dictionary {...}
    const networksDict = networks.networks || networks;
    const network = networksDict[Number(chainId)];

    super(options, loggerInstance, networks);

    const contractABI = options.getParsedABI();
    const contractAddress = options.contractAddress;

    this.target = contractAddress;
    this.wssUrl = network.defaultPrimaryWss;
    this.abi = contractABI;
    this.options = options;
    this.provider = new ethers.WebSocketProvider(this.wssUrl);

    this.eventListener = null;
    this.eventFilter = null;
    this.processedTransactions = new Set();
    this.redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
    });
  }

  /**
   * Returns an ethers.WebSocketProvider
   *
   * @returns {ethers.WebSocketProvider} An ethers.WebSocketProvider
   */
  getProvider() {
    return this.provider;
  }

  // Helper to create Redis key for a transaction
  getTransactionKey(transactionHash) {
    const key = `${NODE_ENV}:keeper_id:${this.options.id}:processed_tx:${transactionHash}`;
    logger.log(`[Redis] Generated key: ${key}`);
    return key;
  }

  // Check if transaction exists in Redis for this specific keeper
  async isTransactionProcessed(transactionHash) {
    const key = this.getTransactionKey(transactionHash);
    const exists = await this.redis.exists(key);
    logger.log(`[Redis] Checked key ${key} - exists: ${exists === 1}`);
    return exists === 1;
  }

  // Store transaction in Redis for this specific keeper
  async markTransactionProcessed(transactionHash) {
    const key = this.getTransactionKey(transactionHash);
    // Store for 24 hours
    await this.redis.set(key, "1", "EX", 24 * 60 * 60);
    logger.log(`[Redis] Stored key ${key} with 24h TTL`);
  }

  /**
   * Converts BigInt values to strings recursively for JSON serialization.
   *
   * @param {*} value - The value to convert (can be any type)
   * @returns {*} The value with BigInt converted to strings
   */
  convertBigIntToString(value) {
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.convertBigIntToString(item));
    }
    if (value && typeof value === "object") {
      const converted = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.convertBigIntToString(val);
      }
      return converted;
    }
    return value;
  }

  /**
   * Extracts event arguments from a parsed log into an object.
   *
   * @param {*} parsedLog - The parsed log from ethers
   * @param {Array} rawEventsAbi - The raw events ABI array
   * @returns {Object} An object containing the event arguments
   */
  extractEventArgs(parsedLog, rawEventsAbi) {
    const args = {};
    if (!parsedLog.args || parsedLog.args.length === 0) {
      return args;
    }

    const eventAbi = rawEventsAbi.find(
      (event) => event.name === parsedLog.name
    );
    if (eventAbi?.inputs) {
      eventAbi.inputs.forEach((input, index) => {
        args[input.name || `arg${index}`] = parsedLog.args[index];
      });
    } else {
      parsedLog.args.forEach((arg, index) => {
        args[`arg${index}`] = arg;
      });
    }
    return args;
  }

  /**
   * Builds a payload object from a log and parsed log.
   *
   * @param {*} log - The raw log from the blockchain
   * @param {*} parsedLog - The parsed log from ethers
   * @param {Object} args - The extracted event arguments
   * @returns {Object} The payload object
   */
  buildEventPayload(log, parsedLog, args) {
    return {
      eventName: parsedLog.name,
      args,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      blockHash: log.blockHash,
      address: log.address,
      logIndex: log.index,
      transactionIndex: log.transactionIndex,
    };
  }

  /**
   * Handles a matched event by processing it and executing the workflow.
   *
   * @param {*} log - The raw log from the blockchain
   * @param {*} parsedLog - The parsed log from ethers
   * @param {Array} rawEventsAbi - The raw events ABI array
   * @returns {Promise<void>}
   */
  async handleMatchedEvent(log, parsedLog, rawEventsAbi) {
    const transactionHash = log.transactionHash;

    if (await this.isTransactionProcessed(transactionHash)) {
      console.log("Transaction already processed: ", transactionHash);
      return;
    }
    await this.markTransactionProcessed(transactionHash);

    const args = this.extractEventArgs(parsedLog, rawEventsAbi);
    const payload = this.buildEventPayload(log, parsedLog, args);
    const serializablePayload = this.convertBigIntToString(payload);

    logger.log(
      `Event matched ~ [ KeeperID: ${this.options.id} - ${this.options.name} ]`
    );
    logger.log(
      `Executing workflow with payload: ${JSON.stringify(serializablePayload, null, 2)}`
    );
    await this.executeWorkflow(this.options.id, serializablePayload);
  }

  /**
   * Processes a single event log.
   *
   * @param {*} log - The raw log from the blockchain
   * @param {*} abiInterface - The ethers Interface instance
   * @param {Array} rawEventsAbi - The raw events ABI array
   * @returns {Promise<void>}
   */
  async processEventLog(log, abiInterface, rawEventsAbi) {
    const timeoutInMs = Math.random() * 10 * 1000;
    await new Promise((resolve) => setTimeout(resolve, timeoutInMs));

    try {
      const parsedLog = abiInterface.parseLog(log);
      const { eventName } = this.options.workflow.node.data.config;

      if (parsedLog.args && parsedLog.name === eventName) {
        logger.log(`Event name ~ [ ${eventName} ]`);
        console.log("Parsed log name", parsedLog.name);
        await this.handleMatchedEvent(log, parsedLog, rawEventsAbi);
      } else {
        console.log("Event name mismatch / No args present");
        console.log("parsedLog.name", parsedLog.name);
        console.log("Expected eventName", eventName);
      }
    } catch (error) {
      console.log(error);
      logger.error(error);
    }
  }

  /**
   * Listens for events emitted by the target Ethereum contract.
   *
   * Sets up an event filter for the target contract address and listens for logs
   * that match the specified event types from the ABI. When a log is received,
   * it parses the log using the ABI interface and triggers workflow execution.
   */
  listenEvent() {
    const formatDate = (date) =>
      date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

    // Clean up any existing listener first if one exists
    if (this.eventListener && this.eventFilter) {
      console.log(`[${formatDate(new Date())}] Cleaning up existing listener`);
      try {
        this.provider.off(this.eventFilter);
        this.eventListener = null;
        this.eventFilter = null;
      } catch (error) {
        logger.error(`Error removing existing listener: ${error.message}`);
      }
    }

    console.log(
      `[${formatDate(new Date())}] Creating new event listener for event: ${
        this.options.eventName
      } - address: ${logger.formatAddress(this.target)} - workflow: ${
        this.options.workflow.name
      }`
    );

    const filter = { address: this.target };
    this.eventFilter = filter;
    const rawEventsAbi = this.abi.filter(({ type }) => type === "event");
    const eventsAbi = rawEventsAbi.map(this.buildEventAbi.bind(this));
    const abiInterface = new ethers.Interface(eventsAbi);

    const provider = this.getProvider();

    this.eventListener = provider.on(filter, async (log) => {
      console.log(`[${formatDate(new Date())}] Event detected:`, {
        contractAddress: log.address,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        // logIndex: log.index,
        // eventSignature: log.topics[0],
        // eventData: log.data,
        // topics: log.topics.slice(1), // Additional indexed parameters
      });

      await this.processEventLog(log, abiInterface, rawEventsAbi);
    });
  }

  /**
   * Builds a string representation of an Ethereum event ABI.
   *
   * @param {{name: string, inputs: {name: string, type: string, indexed: boolean}[]}} eventType - The event type with its name and inputs.
   * @returns {string} A string representing the event ABI, formatted as "event EventName(type indexed? name, ...)".
   */

  buildEventAbi(eventType) {
    const { name, inputs } = eventType;

    const parsedInputs = inputs
      .map(
        ({ name: inputName, type, indexed }) =>
          `${type} ${indexed ? "indexed " : ""}${inputName}`
      )
      .join(", ");

    return `event ${name}(${parsedInputs})`;
  }
}

module.exports = { EvmChain };
