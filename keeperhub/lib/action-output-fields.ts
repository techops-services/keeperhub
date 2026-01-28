/**
 * Action Output Fields
 * Defines dynamic output fields for plugin actions based on their configuration
 */

import type { OutputField } from "@/plugins/registry";

/**
 * Get output fields for Read Contract action based on ABI and selected function
 */
export function getReadContractOutputFields(
  abi: string | undefined,
  functionName: string | undefined
): OutputField[] {
  // Default Read Contract output fields when ABI/function not configured
  const defaultFields: OutputField[] = [
    { field: "success", description: "Whether the contract call succeeded" },
    { field: "result", description: "The contract function return value" },
    { field: "addressLink", description: "Explorer link to the contract" },
    { field: "error", description: "Error message if the call failed" },
  ];

  if (!(abi && functionName)) {
    return defaultFields;
  }

  try {
    const abiArray = JSON.parse(abi);
    if (!Array.isArray(abiArray)) {
      return defaultFields;
    }

    // Find the function in the ABI
    const functionAbi = abiArray.find(
      (item: { type: string; name?: string }) =>
        item.type === "function" && item.name === functionName
    );

    if (!functionAbi?.outputs) {
      return defaultFields;
    }

    const outputs = functionAbi.outputs as Array<{
      name?: string;
      type: string;
    }>;

    // Build output fields based on function outputs
    const outputFields: OutputField[] = [
      { field: "success", description: "Whether the contract call succeeded" },
      { field: "result", description: "The contract function return value" },
    ];

    if (outputs.length === 1) {
      // Single output
      const output = outputs[0];
      const outputName = output.name?.trim();
      if (outputName) {
        // Named single output: result is an object with this field
        outputFields.push({
          field: `result.${outputName}`,
          description: `Return value: ${output.type} (${getDeserializedType(output.type)})`,
        });
      }
      // Unnamed single output: just use result directly (already added)
    } else if (outputs.length > 1) {
      // Multiple outputs: result is an object with named fields
      outputs.forEach((output, index) => {
        const fieldName = output.name?.trim() || `unnamedOutput${index}`;
        outputFields.push({
          field: `result.${fieldName}`,
          description: `Return value: ${output.type} (${getDeserializedType(output.type)})`,
        });
      });
    }

    // Add standard fields
    outputFields.push(
      { field: "addressLink", description: "Explorer link to the contract" },
      { field: "error", description: "Error message if the call failed" }
    );

    return outputFields;
  } catch {
    // If ABI parsing fails, return default fields
    return defaultFields;
  }
}

/**
 * Get the deserialized JavaScript type for a Solidity type
 */
function getDeserializedType(solidityType: string): string {
  if (solidityType.includes("uint") || solidityType.includes("int")) {
    return "BigInt";
  }
  if (solidityType === "bool") {
    return "boolean";
  }
  return "string";
}
