/**
 * Code template for Generate Text action step
 * This is a string template used for code generation - keep as string export
 */
export default `import { generateText } from 'ai';

export async function generateTextStep(input: {
  model: string;
  prompt: string;
}) {
  "use step";
  
  const { text } = await generateText({
    model: input.model,
    prompt: input.prompt,
  });
  
  return { text };
}`;
