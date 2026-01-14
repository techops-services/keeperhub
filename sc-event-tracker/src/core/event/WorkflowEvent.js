"use strict";
const { diff } = require("deep-diff");

const EXAMPLE_WORKFLOW_EVENT = {
  id: "wtp1xd0zb8d3pp32gwd6k",
  name: "Untitled 1",
  userId: "Nv6zTJGAuQOWpKmIsF7SjgeYhnlKiV9N",
  organizationId: "52d32744-0624-4344-b6a7-1196013af668",
  enabled: true,
  nodes: [
    {
      id: "HEC5h45qzsPKct1dVoxBU",
      data: {
        type: "trigger",
        label: "",
        config: {
          network: "11155111",
          eventName: "FavoriteNumberUpdated",
          contractABI:
            '[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"_oldFavoriteNumber","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newFavoriteNumber","type":"uint256"}],"name":"FavoriteNumberUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"_favoriteNumber","type":"uint256"},{"indexed":false,"internalType":"string","name":"name","type":"string"}],"name":"NewPersonAdded","type":"event"},{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"uint256","name":"_favoriteNumber","type":"uint256"}],"name":"addPerson","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"","type":"string"}],"name":"nameToFavoriteNumber","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"people","outputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"uint256","name":"favoriteNumber","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"removeLastPerson","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"retrieve","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_favoriteNumber","type":"uint256"}],"name":"store","outputs":[],"stateMutability":"nonpayable","type":"function"}]',
          triggerType: "Event",
          contractAddress: "0x069d34E130ccA7D435351FB30c0e97F2Ce6B42Ad",
        },
        status: "idle",
        description: "",
      },
      type: "trigger",
      measured: {
        width: 192,
        height: 192,
      },
      position: {
        x: 0,
        y: 0,
      },
      selected: true,
    },
  ],
};

class WorkflowEvent {
  /**
   * @typedef {Object} WorkflowEventOptions
   * @property {string} id - The ID of the workflow.
   * @property {string} name - The name of the workflow.
   * @property {string} userId - The user ID.
   * @property {string} organizationId - The organization ID.
   * @property {boolean} enabled - Whether the workflow is enabled.
   * @property {Array<Node>} nodes - Array of node objects.
   *
   * Creates a new instance of the WorkflowEvent class.
   * @constructor
   * @param {WorkflowEventOptions} options - The options for the event (single workflow object).
   */
  constructor(options) {
    if (
      !(options && options.nodes && Array.isArray(options.nodes)) ||
      options.nodes.length === 0
    ) {
      throw new Error(
        "WorkflowEvent requires options with a non-empty nodes array"
      );
    }
    this._workflow = new Workflow({ ...options, node: options.nodes[0] });
  }

  /**
   * Gets the first workflow (for backward compatibility when treating WorkflowEvent as a single workflow).
   * @returns {Workflow|undefined} The first workflow or undefined if no workflows exist.
   */
  get workflow() {
    return this._workflow;
  }

  /**
   * Gets the workflow ID.
   * @returns {string|undefined} The workflow ID or undefined if no workflows exist.
   */
  get id() {
    return this._workflow?.id;
  }

  /**
   * Gets the workflow name.
   * @returns {string|undefined} The workflow name or undefined if no workflows exist.
   */
  get name() {
    return this._workflow?.name;
  }

  /**
   * Gets the contract address.
   * @returns {string|undefined} The contract address or undefined if not found.
   */
  get contractAddress() {
    return this._workflow?.node?.data?.config?.contractAddress;
  }

  /**
   * Gets the contract ABI.
   * @returns {string|undefined} The contract ABI string or undefined if not found.
   */
  get contractABI() {
    return this._workflow?.node?.data?.config?.contractABI;
  }

  /**
   * Gets the parsed contract ABI from the first trigger node's config (for easy access).
   * @returns {Array} The parsed ABI array or empty array if not found.
   */
  getParsedABI() {
    return this._workflow?.node?.data?.config?.getParsedABI() || [];
  }

  /**
   * Gets the chain/network ID from the workflow node config.
   * @returns {string|undefined} The chain ID or undefined if not found.
   */
  get chain() {
    return this._workflow?.node?.data?.config?.network;
  }

  /**
   * Gets the event name from the workflow node config.
   * @returns {string|undefined} The event name or undefined if not found.
   */
  get eventName() {
    return this._workflow?.node?.data?.config?.eventName;
  }

  /**
   * Checks if the workflow configuration has changed compared to a new event.
   *
   * @param {Object} newEvent - The new event data to compare against the current instance.
   * @returns {Array|undefined} An array of differences if any are found, otherwise undefined.
   */
  hasConfigurationChanged(newEvent) {
    return diff(this, new WorkflowEvent(newEvent));
  }
}

class Workflow {
  /**
   * @typedef {Object} WorkflowOptions
   * @property {string} id - The ID of the workflow.
   * @property {string} name - The name of the workflow.
   * @property {string} userId - The ID of the user who owns the workflow.
   * @property {string} organizationId - The ID of the organization.
   * @property {boolean} enabled - Whether the workflow is enabled or not.
   * @property {Node} node - Array of node objects.
   *
   * Creates a new instance of the Workflow class.
   * @constructor
   * @param {WorkflowOptions} options - The options for the workflow.
   */
  constructor({ id, name, userId, organizationId, enabled, node }) {
    this.id = id;
    this.name = name;
    this.userId = userId;
    this.organizationId = organizationId;
    this.enabled = enabled;
    this.node = new Node(node);
  }
}

class Node {
  /**
   * @typedef {Object} NodeOptions
   * @property {string} id - The ID of the node.
   * @property {NodeData} data - The data object for the node.
   * @property {string} type - The type of the node.
   * @property {boolean} selected - Whether the node is selected.
   *
   * Creates a new instance of the Node class.
   * @constructor
   * @param {NodeOptions} options - The options for the node.
   */
  constructor({ id, data, type, selected }) {
    this.id = id;
    this.data = new NodeData(data);
    this.type = type;
    this.selected = selected;
  }
}

class NodeData {
  /**
   * @typedef {Object} NodeDataOptions
   * @property {string} type - The type of the node data.
   * @property {string} label - The label for the node.
   * @property {NodeConfig} config - The configuration object.
   * @property {string} status - The status of the node.
   * @property {string} description - The description of the node.
   *
   * Creates a new instance of the NodeData class.
   * @constructor
   * @param {NodeDataOptions} options - The options for the node data.
   */
  constructor({ type, label, config, status, description }) {
    this.type = type;
    this.label = label;
    this.config = new NodeConfig(config);
    this.status = status;
    this.description = description;
  }
}

class NodeConfig {
  /**
   * @typedef {Object} NodeConfigOptions
   * @property {string} network - The network chain ID (e.g., "11155111" for Sepolia).
   * @property {string} eventName - The name of the event to listen for.
   * @property {string} contractABI - The contract ABI as a JSON stringified array.
   * @property {string} triggerType - The type of trigger (e.g., "Event").
   * @property {string} contractAddress - The contract address.
   *
   * Creates a new instance of the NodeConfig class.
   * @constructor
   * @param {NodeConfigOptions} options - The options for the node config.
   */
  constructor({
    network,
    eventName,
    contractABI,
    triggerType,
    contractAddress,
  }) {
    this.network = network;
    this.eventName = eventName;
    this.contractABI = contractABI;
    this.triggerType = triggerType;
    this.contractAddress = contractAddress;
  }

  /**
   * Gets the parsed ABI from the contractABI string.
   * @returns {Array} The parsed ABI array.
   */
  getParsedABI() {
    try {
      return JSON.parse(this.contractABI);
    } catch (error) {
      return [];
    }
  }
}

class Contract {
  constructor({ name, address, abi }) {
    this.name = name;
    this.address = address;
    this.abi = abi;
  }
}

class ChainConfiguration {
  constructor({ primary_wss_url, fallback_wss_url }) {
    this.primaryWssUrl = primary_wss_url;
    this.fallbackWssUrl = fallback_wss_url;
  }
}

class FunctionDetails {
  constructor({
    name,
    function: functionString,
    user_id,
    contract_id,
    id,
    datetime,
  }) {
    this.name = name;
    this.function = JSON.parse(functionString);
    this.userId = user_id;
    this.contractId = contract_id;
    this.id = id;
    this.datetime = datetime;
  }
}

module.exports = {
  WorkflowEvent,
  Workflow,
  Node,
  NodeData,
  NodeConfig,
  Contract,
  ChainConfiguration,
  FunctionDetails,
};
