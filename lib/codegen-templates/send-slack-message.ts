/**
 * Code template for Send Slack Message action step
 * This is a string template used for code generation - keep as string export
 */
export default `import { WebClient } from '@slack/web-api';

export async function sendSlackMessageStep(input: {
  slackChannel: string;
  slackMessage: string;
}) {
  "use step";
  
  const slack = new WebClient(process.env.SLACK_API_KEY);
  
  const result = await slack.chat.postMessage({
    channel: input.slackChannel,
    text: input.slackMessage,
  });
  
  console.log('Slack message sent:', result);
  return result;
}`;
