/**
 * Code template for Database Query action step
 * This is a string template used for code generation - keep as string export
 */
export default `export async function databaseQueryStep(input: {
  query: string;
}) {
  "use step";
  
  // Database Query - You need to set up your database connection
  // Install: pnpm add postgres (or your preferred database library)
  // Set DATABASE_URL in your environment variables
  
  // Example using postgres library:
  // import postgres from 'postgres';
  // const sql = postgres(process.env.DATABASE_URL!);
  // const result = await sql.unsafe(input.query);
  // await sql.end();
  
  throw new Error('Database Query not implemented - see comments in generated code');
}`;
