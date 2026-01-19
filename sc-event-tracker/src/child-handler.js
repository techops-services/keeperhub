"use strict";
const { EventHandlerFactory } = require("./core/event-handler-factory.js");
const { WorkflowEvent } = require("./core/event/workflow-event.js");
const { logger } = require("./core/utils/logger.js");

/**
 * Handles an event message.
 *
 * @param {Object} message - The message containing event and networks.
 * @param {WorkflowEvent|Object} message.event - The event to handle.
 * @param {{networks: {[key: number]: Network}}} message.networks - The networks to use for the chain.
 */
async function handleEventMessage(message) {
  let workflowEvent;
  try {
    // Handle both old format (just event) and new format (object with event and networks)
    if (message.event) {
      // New format: { event: {...}, networks: {...} }
      workflowEvent = new WorkflowEvent(message.event);
    } else if (message instanceof WorkflowEvent) {
      // Direct WorkflowEvent instance (shouldn't happen after serialization, but handle it)
      workflowEvent = message;
    } else {
      // Old format or plain object
      workflowEvent = new WorkflowEvent(message);
    }

    const networksData = message.networks || {};
    const networks = networksData.networks
      ? networksData
      : { networks: networksData };

    const blockchainEventHandler = new EventHandlerFactory(
      workflowEvent,
      logger,
      networks
    ).buildChainHandler();

    if (process.pid) {
      logger.log(
        `Starting event listener ~ process: ${
          process.pid
        } - address: ${logger.formatAddress(
          workflowEvent.contractAddress
        )} - chain: ${workflowEvent.chain} - event: ${
          workflowEvent.eventName
        } - workflow: ${workflowEvent.name} - id: ${workflowEvent.id}`
      );
    }

    await blockchainEventHandler.listenEvent();
    process?.send({
      status: "listening",
      chain: workflowEvent.chain,
      pid: process.pid,
    });

    const memoryUsage = process.memoryUsage();

    logger.log(
      `Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );
  } catch (error) {
    logger.error(error);
    const eventInfo = workflowEvent
      ? `chain ${workflowEvent.chain} and WorkflowEvent: ${JSON.stringify(workflowEvent.name)}:${workflowEvent.id}`
      : "unknown event";
    logger.error(
      `Error in child process for ${eventInfo}\nError: ${error.message}`
    );
  }
}

process.on("message", handleEventMessage);
