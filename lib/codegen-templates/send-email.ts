/**
 * Code template for Send Email action step
 * This is a string template used for code generation - keep as string export
 */
export default `import { Resend } from 'resend';

export async function sendEmailStep(input: {
  fromEmail: string;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
}) {
  "use step";
  
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  const result = await resend.emails.send({
    from: input.fromEmail,
    to: input.emailTo,
    subject: input.emailSubject,
    text: input.emailBody,
  });
  
  console.log('Email sent:', result);
  return result;
}`;
