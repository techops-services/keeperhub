"use strict";
const { ethers } = require("ethers");
const { AbstractChain } = require("../AbstractChain.js");
const { WorkflowEvent, Condition } = require("../event/WorkflowEvent.js");
const { Logger, logger } = require("../utils/logger.js");
const { ETHERSCAN_API_KEY } = require("../config/environment.js");
const Redis = require("ioredis");
const { WORKER_URL } = require("../config/environment.js");
const axios = require("axios");
const { Network } = require("../config/networks.js");

class EthereumSepoliaBlockchain extends AbstractChain {
  /**
   * Creates a new EthereumSepoliaBlockchain
   *
   * @param {WorkflowEvent} options
   * @param {Logger} logger - The logger instance for logging messages
   * @param {{networks: {[key: number]: Network}}} networks - The networks to use for the chain
   * @throws {Error} If the chain is not supported
   */
  constructor(options, logger, networks) {
    const { network: chainId } = options.workflow.node.data.config;

    // Handle both formats: { networks: {...} } and direct dictionary {...}
    const networksDict = networks.networks || networks;
    const network = networksDict[Number(chainId)];

    super(options, logger, networks);

    const contractABI = options.getParsedABI();
    const contractAddress = options.contractAddress;

    this.target = contractAddress;
    this.wssUrl = network.defaultPrimaryWss;
    this.abi = contractABI;
    this.options = options;
    this.provider = new ethers.WebSocketProvider(this.wssUrl);

    this.eventListener = null;
    this.processedTransactions = new Set();
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
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

  getSepoliaEtherScan(contractAddress) {
    return `https://api-sepolia.etherscan.io/v2/api?chainid=11155111&module=contract&action=getabi&address=${contractAddress}&apikey=${ETHERSCAN_API_KEY}`;
  }

  // Helper to create Redis key for a transaction
  getTransactionKey(transactionHash) {
    const key = `keeper_id:${this.options.id}:processed_tx:${transactionHash}`;
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

  async fetchFreshConditions(keeperId) {
    try {
      const response = await axios.get(
        `${WORKER_URL}/keeper/${keeperId}/conditions`
      );
      return response.data.conditions;
    } catch (error) {
      console.error("Error fetching fresh conditions:", error.message);
      return null;
    }
  }

  /**
   * Listens for events emitted by the target Ethereum contract.
   *
   * Sets up an event filter for the target contract address and listens for logs
   * that match the specified event types from the ABI. When a log is received,
   * it parses the log using the ABI interface and validates conditions.
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

    // Clean up any existing listener first
    if (this.eventListener) {
      console.log(`[${formatDate(new Date())}] Cleaning up existing listener`);
      this.cleanup();
    }

    console.log(
      `[${formatDate(new Date())}] Creating new event listener for event: ${
        this.options.eventName
      } - address: ${logger.formatAddress(this.target)} - workflow: ${
        this.options.workflow.name
      }`
    );

    const filter = { address: this.target };
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

      const transactionHash = log.transactionHash;

      const timeoutInMs = Math.random() * 10 * 1000;
      await new Promise((resolve) => setTimeout(resolve, timeoutInMs));

      try {
        const parsedLog = abiInterface.parseLog(log);
        const { eventName } = this.options.workflow.node.data.config;

        if (parsedLog.args && parsedLog.name === eventName) {
          logger.log(`Event name ~ [ ${eventName} ]`);
          console.log("Parsed log name", parsedLog.name);

          if (await this.isTransactionProcessed(transactionHash)) {
            console.log("Transaction already processed: ", transactionHash);
            return;
          }
          await this.markTransactionProcessed(transactionHash);

          await this.decodeContractData(transactionHash, provider);

          console.log(
            "[THIS OPTIONS ID]",
            JSON.stringify(this.options.id, null, 2)
          );
          // Fetch fresh conditions
          const freshConditions = await this.fetchFreshConditions(
            this.options.id
          );
          console.log(
            "[FRESH CONDITIONS]",
            JSON.stringify(freshConditions, null, 2)
          );

          logger.log(
            `Event matched ~ [ KeeperID: ${this.options.id} - ${this.options.name} ]`
          );
          this.logExecution(
            `Event matched ~ [ KeeperID: ${this.options.id} - ${this.options.name} ], validating conditions...`
          );
          // Pass fresh conditions to validateConditions
          await this.validateConditions(
            parsedLog,
            rawEventsAbi,
            freshConditions
          );
        } else {
          console.log("Event name mismatch / No args present");
          console.log("parsedLog.name", parsedLog.name);
          console.log("this.options.function.name", this.options.function.name);
          // console.log("parsedLog.args", parsedLog.args);
        }
      } catch (error) {
        logger.error(error);
      }
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
        ({ name, type, indexed }) =>
          `${type} ${indexed ? "indexed " : ""}${name}`
      )
      .join(", ");

    return `event ${name}(${parsedInputs})`;
  }

  /**
   * Validates if an event log matches all the conditions.
   *
   * @param {ethers.LogDescription} parsedLog - Parsed event log data.
   * @param {{name: string; inputs: {name: string; type: string; indexed: boolean}[]}[]} rawEventsAbi - ABI for all events.
   */
  async validateConditions(parsedLog, rawEventsAbi, conditions) {
    const validatioInitialTime = Date.now();
    const { name, args } = parsedLog;
    const eventAbi = rawEventsAbi.find((event) => event.name === name);

    const inputsWithValues = eventAbi.inputs.map((input, index) => ({
      ...input,
      rawValue: args[index],
    }));
    const workflows = await this.getWorkflowByKeeper(this.options.id);
    if (workflows.length > 0) {
      for (const workflow of workflows) {
        if (!conditions?.length) {
          const noConditionsMessage = `NO CONDITIONS ~ [ KeeperID: ${this.options.id} - ${this.options.name} ]`;

          this.logExecution(noConditionsMessage);
          logger.log(noConditionsMessage);

          const data = await this.notify(this.options.id, [], "success");
          const notificationsSent = data.notify;
          const transferSent = data.transfer;
          const webhookSent = data.webhook;
          logger.log(
            `Notify ${data}, ${notificationsSent}, ${transferSent.transfer_amount}`
          );

          const notificationsExecutionTime = Date.now();
          this.addNotificationsSentToLogs(
            notificationsSent,
            notificationsExecutionTime
          );

          const executionId = await this.saveLogs(
            notificationsSent,
            transferSent,
            webhookSent
          );
          logger.log(`execution Id: ${executionId}`);
          await this.executeWorkflow(
            workflow.start_node_id,
            workflow.workflow.id,
            executionId,
            "success"
          );

          return;
        }

        const validatedConditions = conditions.map((condition) =>
          this.evaluateCondition(condition, inputsWithValues)
        );

        const resultBasedOnConditions =
          this.evaluateConditionsWithRelationshipOperators(validatedConditions);

        const triggerType = resultBasedOnConditions ? "success" : "failure";

        const validationTime = Date.now() - validatioInitialTime;
        this.logExecution(
          `Event validated ~ [ KeeperID: ${this.options.id} - ${this.options.name} ] ~ Notifying`,
          validationTime
        );

        const notificationsExecutionTime = Date.now();
        logger.log(
          `Notifying ~ [ KeeperID: ${this.options.id} - ${this.options.name} ]`
        );
        const data = await this.notify(
          this.options.id,
          validatedConditions,
          triggerType
        );
        const notificationsSent = data.notify;
        const transferSent = data.transfer;
        const webhookSent = data.webhook;

        this.addNotificationsSentToLogs(
          notificationsSent,
          notificationsExecutionTime
        );

        const executionId = await this.saveLogs(
          notificationsSent,
          transferSent,
          webhookSent,
          conditions,
          triggerType
        );
        await this.executeWorkflow(
          workflow.start_node_id,
          workflow.workflow.id,
          executionId,
          triggerType
        );
        logger.log(`Execution Id : ${executionId}`);
      }
    }
  }

  /**
   * Decodes the contract data from a transaction.
   *
   * @param {string} transactionHash - The transaction hash for which to decode the contract data.
   * @param {ethers.providers.Provider} provider - The provider to use for transaction lookup.
   *
   * @returns {Promise<void>} Resolves when all contract data has been decoded.
   */
  async decodeContractData(transactionHash, provider) {
    const transaction = await provider.getTransaction(transactionHash);

    this.contractTransaction = transaction.toJSON();

    const contract = new ethers.Contract(
      transaction.to,
      this.abi,
      this.getProvider()
    );

    for (const item of this.abi) {
      try {
        const functionSignature = contract.interface.getFunction(item);

        const decodedInput = contract.interface.decodeFunctionData(
          functionSignature,
          transaction.data
        );

        this.contractInformation = {
          name: functionSignature.name,
          inputs: functionSignature.inputs,
          outputs: functionSignature.outputs,
          decodedInput,
          ...functionSignature,
        };

        break;
      } catch (error) {}
    }
  }
}

module.exports = { EthereumSepoliaBlockchain };
