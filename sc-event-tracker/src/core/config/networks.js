"use strict";

class Network {
  /**
   * @typedef {Object} NetworkOptions
   * @property {string} id - The network ID.
   * @property {number} chainId - The chain ID.
   * @property {string} name - The network name.
   * @property {string} symbol - The network symbol.
   * @property {string} chainType - The chain type.
   * @property {string} defaultPrimaryRpc - The default primary RPC URL.
   * @property {string} defaultFallbackRpc - The default fallback RPC URL.
   * @property {string} defaultPrimaryWss - The default primary WebSocket URL.
   * @property {string} defaultFallbackWss - The default fallback WebSocket URL.
   * @property {boolean} isTestnet - Whether the network is a testnet.
   * @property {boolean} isEnabled - Whether the network is enabled.
   * @property {Date} createdAt - The date the network was created.
   * @property {Date} updatedAt - The date the network was updated.
   */
  constructor(options) {
    this.id = options.id;
    this.chainId = options.chainId;
    this.name = options.name;
    this.symbol = options.symbol;
    this.chainType = options.chainType;
    this.defaultPrimaryRpc = options.defaultPrimaryRpc;
    this.defaultFallbackRpc = options.defaultFallbackRpc;
    this.defaultPrimaryWss = options.defaultPrimaryWss;
    this.defaultFallbackWss = options.defaultFallbackWss;
    this.isTestnet = options.isTestnet;
    this.isEnabled = options.isEnabled;
    this.createdAt = options.createdAt;
    this.updatedAt = options.updatedAt;
  }
}

module.exports = { Network };
