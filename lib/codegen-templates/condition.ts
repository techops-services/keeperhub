/**
 * Code template for Condition action step
 * This is a string template used for code generation - keep as string export
 */
export default `export async function conditionStep(input: {
  condition: boolean;
}) {
  "use step";
  
  // Evaluate condition
  console.log('Condition evaluated:', input.condition);
  return { condition: input.condition };
}`;
