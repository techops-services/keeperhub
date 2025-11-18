/**
 * Code template for Create Ticket action step
 * This is a string template used for code generation - keep as string export
 */
export default `import { LinearClient } from '@linear/sdk';

export async function createTicketStep(input: {
  ticketTitle: string;
  ticketDescription: string;
}) {
  "use step";
  
  const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
  
  const issue = await linear.issueCreate({
    title: input.ticketTitle,
    description: input.ticketDescription,
    teamId: process.env.LINEAR_TEAM_ID!,
  });
  
  console.log('Linear issue created:', issue);
  return issue;
}`;
