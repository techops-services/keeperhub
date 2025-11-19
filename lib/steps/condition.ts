/**
 * Executable step function for Condition action
 */
export function conditionStep(input: { condition: boolean }): {
  condition: boolean;
} {
  return { condition: input.condition };
}
