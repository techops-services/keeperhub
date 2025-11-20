/**
 * Executable step function for Condition action
 */
// biome-ignore lint/suspicious/useAwait: workflow "use step" requires async
export async function conditionStep(input: { condition: boolean }): Promise<{
  condition: boolean;
}> {
  "use step";

  return { condition: input.condition };
}
