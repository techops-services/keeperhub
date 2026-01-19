"use strict";
const { EvmChain } = require("./chains/evm-chain.js");

class EventHandlerFactory {
  /**
   * Creates a new instance of the EventHandlerFactory class.
   *
   * @param {import("./event/workflow-event.js").WorkflowEvent} options - The event to be handled
   * @param {import("./utils/logger.js").Logger} logger - The logger instance for logging messages
   * @param {{networks: {[key: number]: import("./config/networks.js").Network}}} networks - The networks to use for the chain
   */
  constructor(options, logger, networks) {
    this.options = options;
    this.logger = logger;
    this.networks = networks;
  }

  /**
   * Builds a concrete chain handler based on the provided chain type.
   *
   * @throws {Error} Unsupported chain type
   * @returns {import("./abstract-chain").AbstractChain} A concrete chain handler
   */
  buildChainHandler() {
    return new EvmChain(this.options, this.logger, this.networks);
  }
}

module.exports = { EventHandlerFactory };
