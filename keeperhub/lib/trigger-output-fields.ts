/**
 * Trigger Output Fields
 * Defines output fields for different trigger types to enable template autocomplete
 */

import type { OutputField } from "@/plugins/registry";

/**
 * Get output fields for Event trigger based on ABI and selected event
 */
export function getEventTriggerOutputFields(
  abi: string | undefined,
  eventName: string | undefined
): OutputField[] {
  if (!(abi && eventName)) {
    // Return default event output fields if ABI/event not configured
    return [
      {
        field: "eventName",
        description: "Name of the event that was emitted",
      },
      {
        field: "args",
        description: "Event arguments (decoded parameters)",
      },
      {
        field: "blockNumber",
        description: "Block number where the event was emitted",
      },
      {
        field: "transactionHash",
        description: "Transaction hash that emitted the event",
      },
      {
        field: "address",
        description: "Contract address that emitted the event",
      },
    ];
  }

  try {
    const abiArray = JSON.parse(abi);
    if (!Array.isArray(abiArray)) {
      return getEventTriggerOutputFields(undefined, undefined);
    }

    // Find the event in the ABI
    const event = abiArray.find(
      (item: { type: string; name?: string }) =>
        item.type === "event" && item.name === eventName
    );

    if (!(event && event.inputs)) {
      return getEventTriggerOutputFields(undefined, undefined);
    }

    // Build output fields based on event parameters
    const outputFields: OutputField[] = [
      {
        field: "eventName",
        description: "Name of the event that was emitted",
      },
    ];

    // Add each event parameter as an output field
    event.inputs.forEach(
      (input: { name: string; type: string; indexed?: boolean }) => {
        const paramName = input.name || "unnamed";
        const indexed = input.indexed ? " (indexed)" : "";
        outputFields.push({
          field: `args.${paramName}`,
          description: `Event parameter: ${input.type}${indexed}`,
        });
      }
    );

    // Add standard blockchain event fields
    outputFields.push(
      {
        field: "blockNumber",
        description: "Block number where the event was emitted",
      },
      {
        field: "transactionHash",
        description: "Transaction hash that emitted the event",
      },
      {
        field: "blockHash",
        description: "Hash of the block containing the event",
      },
      {
        field: "address",
        description: "Contract address that emitted the event",
      },
      {
        field: "logIndex",
        description: "Index of the log in the block",
      },
      {
        field: "transactionIndex",
        description: "Index of the transaction in the block",
      }
    );

    return outputFields;
  } catch {
    // If ABI parsing fails, return default fields
    return getEventTriggerOutputFields(undefined, undefined);
  }
}

/**
 * Get output fields for a trigger node based on its configuration
 */
export function getTriggerOutputFields(
  triggerType: string | undefined,
  config: Record<string, unknown>
): OutputField[] {
  if (triggerType === "Event") {
    const abi = config.contractABI as string | undefined;
    const eventName = config.eventName as string | undefined;
    return getEventTriggerOutputFields(abi, eventName);
  }

  if (triggerType === "Webhook") {
    // Webhook outputs are dynamic based on webhookSchema
    // For now, return common webhook fields
    return [
      {
        field: "body",
        description: "Webhook request body",
      },
      {
        field: "headers",
        description: "Webhook request headers",
      },
      {
        field: "method",
        description: "HTTP method (GET, POST, etc.)",
      },
      {
        field: "query",
        description: "Query parameters",
      },
    ];
  }

  if (triggerType === "Schedule") {
    return [
      {
        field: "triggeredAt",
        description: "Timestamp when the schedule was triggered",
      },
    ];
  }

  // Manual trigger - no output fields
  return [];
}
