"use strict";
const {
  EthereumSepoliaBlockchain,
} = require("./chains/eth-sepolia-blockchain.js");

class EventHandlerFactory {
  /**
   * Creates a new instance of the EventHandlerFactory class.
   *
   * @param {import("./event/workflow-event").WorkflowEvent} options - The event to be handled
   * @param {import("./utils/logger").Logger} logger - The logger instance for logging messages
   * @param {{networks: {[key: number]: import("./config/networks").Network}}} networks - The networks to use for the chain
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
