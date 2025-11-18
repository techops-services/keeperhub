/**
 * Code template for HTTP Request action step
 * This is a string template used for code generation - keep as string export
 */
export default `export async function httpRequestStep(input: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}) {
  "use step";
  
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: JSON.stringify(input.body),
  });
  
  const data = await response.json();
  console.log('HTTP request completed:', data);
  return data;
}`;
