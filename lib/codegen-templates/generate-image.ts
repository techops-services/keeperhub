/**
 * Code template for Generate Image action step
 * This is a string template used for code generation - keep as string export
 */
export default `import OpenAI from 'openai';

export async function generateImageStep(input: {
  model: string;
  prompt: string;
}) {
  "use step";
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await openai.images.generate({
    model: input.model,
    prompt: input.prompt,
    n: 1,
    response_format: 'b64_json',
  });
  
  return { base64: response.data[0].b64_json };
}`;
