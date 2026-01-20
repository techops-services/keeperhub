"use strict";
const { fork } = require("node:child_process");
const { join } = require("node:path");

/**
 * @typedef {Object} ProcessDetails
 * @property {import('child_process').ChildProcess|null} process - The process object or null.
 * @property {WorkflowHandler|null} handler - The handler instance or null.
 */

class WorkflowHandler {
  /**
   * Initializes a new instance of the WorkflowHandler class.
   *
   * @param {Object} params - Parameters for the WorkflowHandler.
   * @param {import("../event/workflow-event").WorkflowEvent} params.event - The event to be handled.
   * @param {import("../utils/logger").Logger} params.logger - The logger instance for logging messages.
   * @param {import("../synchronization/redis").SyncModule} params.syncService - The synchronization service instance.
   * @param {string} params.index - The id of the workflow.
   * @param {{networks: {[key: number]: import("../config/networks").Network}}} params.networks - The networks to use for the chain.
   */
  constructor({ event, logger, syncService, index, networks, rawEventData }) {
    this.event = event;
    this.rawEventData = rawEventData; // Store original data for serialization
    this.index = index;
    this.logger = logger;
    this.syncService = syncService;
    this.networks = networks;

    /**
     * @type {ProcessDetails}
     */
    this.currentProcess = { process: null, handler: null };
  }

  /**
   * Starts a new child process for the given event and index.
   *
   * @returns {Promise<void>} A promise that resolves when the child process is started.
   */
  async startProcess() {
    const _process = fork(join(__dirname, "../../child-handler.js"), [
      this.index.toString(),
    ]);

    this.setActiveProcess(_process);

    _process.on("message", (msg) => {
      if (!Object.keys(msg).includes("watch:require")) {
        this.logger.log(
          `Process [ ${this.logger.stringyfy(
            this.currentProcess.process.pid
          )} ] received message: ${this.logger.stringyfy(msg)}`
        );
      }
    });

    _process.on("exit", async (code, signal) => {
      this.logger.warn(
        `Process [${this.index}] exited with code ${code}, signal ${signal}`
      );

      if (!this.shouldRestart) {
        this.logger.log(
          `Process [${this.index}] terminated intentionally. Not restarting.`
        );
        await this.syncService.removeProcess(this.index);
        return;
      }

      this.logger.log(`Restarting child process [${this.index}]`);
      await this.syncService.removeProcess(this.index);
      this.startProcess();
    });

    _process.on("error", async (err) => {
      this.logger.error(err);
      this.logger.error(`Error in child [${this.index}]: ${err.message}`);
      this.logger.log(`Restarting child process [${this.index}]`);

      await this.syncService.removeProcess(this.index);

      this.startProcess();
    });

    await this.syncService.registerProcess(
      this.index,
      _process.pid,
      this.event
    );

    // Wrap networks in the expected format: { networks: { [chainId]: Network } }
    const networksToSend = this.networks.networks
      ? this.networks
      : { networks: this.networks };

    _process.send({
      event: this.rawEventData,
      networks: networksToSend,
    });

    this.logger.log(
      `Child process running: [ WorkflowId: ${this.index} ] - Chain: ${this.event.chain}`
    );
  }

  /**
   * Kills the child process associated with this WorkflowHandler instance.
   * If {shouldRestart} is true, the process will be restarted after being killed.
   * @param {{shouldRestart: boolean}} options - Options for killing the process.
   * @returns {Promise<void>} A promise that resolves when the process is killed and optionally restarted.
   */
  async killWorkflow({ shouldRestart = false }) {
    this.shouldRestart = shouldRestart;

    this.logger.log(
      `Killing workflow [ ${this.event.id} ] - shouldRestart: ${shouldRestart}`
    );

    // Kill the child process - this will automatically clean up all listeners
    // and resources in that process
    if (this.currentProcess?.process) {
      if (this.currentProcess.process.killed) {
        this.logger.log(
          `Process [ ${this.currentProcess.process.pid} ] already killed`
        );
      } else {
        this.logger.log(
          `Killing child process [ ${this.currentProcess.process.pid} ] for workflow [ ${this.event.id} ]`
        );
        process.kill(this.currentProcess.process.pid);
        this.logger.log(
          `Kill signal sent to process [ ${this.currentProcess.process.pid} ]`
        );
      }
    } else {
      this.logger.warn(
        `No process found for workflow [ ${this.event.id} ], cannot kill process`
      );
    }

    // Remove Redis keys to prevent duplicate processing
    this.logger.log(
      `Removing workflow [ ${this.event.id} ] from Redis to prevent duplicate processing`
    );
    await this.syncService.removeProcess(this.event.id);
    this.logger.log(
      `Workflow [ ${this.event.id} ] removed from Redis successfully`
    );
  }

  /**
   * Restarts the child process associated with this WorkflowHandler instance
   * using the new event provided.
   *
   * @param {import("../event/workflow-event").WorkflowEvent} event - The new event to be used for restarting
   * the child process.
   * @param {Object} rawEventData - The raw event data for serialization.
   *
   * @returns {Promise<this>} A promise that resolves when the process is
   * restarted with the new event.
   */
  async restartWorkflowWithAnotherEvent(event, rawEventData) {
    this.event = event;
    this.rawEventData = rawEventData;
    await this.killWorkflow({ shouldRestart: false });

    await this.startProcess();

    return this;
  }

  /**
   * Sets the current process and handler for this instance.
   * @param {ChildProcess} currentProcess - The current child process.
   * @returns {void}
   */
  setActiveProcess(currentProcess) {
    this.currentProcess = {
      process: currentProcess,
      handler: this,
    };
  }
}

module.exports = { WorkflowHandler };
