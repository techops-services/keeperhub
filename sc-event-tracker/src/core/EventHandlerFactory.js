"use strict";
const { AbstractChain } = require("./AbstractChain.js");
const {
  EthereumSepoliaBlockchain,
} = require("./chains/EthSepoliaBlockchain.js");
const { AVAILABLE_CHAINS } = require("./utils/chains.js");
const { WorkflowEvent } = require("./event/WorkflowEvent.js");
const { Network } = require("./config/networks.js");

class EventHandlerFactory {
  /**
   * Creates a new instance of the EventHandlerFactory class.
   *
   * @param {WorkflowEvent} options - The event to be handled
   * @param {Logger} logger - The logger instance for logging messages
   * @param {{networks: {[key: number]: Network}}} networks - The networks to use for the chain
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
   * @returns {AbstractChain} A concrete chain handler
   */
  buildChainHandler() {
    return new EthereumSepoliaBlockchain(
      this.options,
      this.logger,
      this.networks
    );

    // Update this if you want to add more chains
    // Or support multiple blockchains

    // switch (this.options.chain.configuration.type) {
    //     case AVAILABLE_CHAINS.ETH_SEPOLIA:
    //         return new EthereumSepoliaBlockchain(this.options, this.logger);

    //     case AVAILABLE_CHAINS.EVM_ETHEREUM:
    //         return new EthereumSepoliaBlockchain(this.options, this.logger);

    //     default:
    //         throw new Error(`Unsupported chain: ${this.options.chain.code}`);
    // }
  }
}

module.exports = { EventHandlerFactory };
