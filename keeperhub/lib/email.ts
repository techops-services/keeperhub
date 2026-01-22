/**
 * Email utilities for KeeperHub
 * Uses SendGrid API for transactional emails
 */

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Send an email using SendGrid
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromAddress = process.env.FROM_ADDRESS || "noreply@keeperhub.com";

  if (!apiKey) {
    console.error("[Email] SENDGRID_API_KEY not configured");
    return false;
  }

  const emailData = {
    personalizations: [
      {
        to: [{ email: options.to }],
        subject: options.subject,
      },
    ],
    from: { email: fromAddress, name: "KeeperHub" },
    content: [
      {
        type: "text/plain",
        value: options.text,
      },
      ...(options.html
        ? [
            {
              type: "text/html",
              value: options.html,
            },
          ]
        : []),
    ],
  };

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Email] SendGrid error:", response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return false;
  }
}

type InvitationEmailData = {
  inviteeEmail: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteLink: string;
};

/**
 * Send organization invitation email
 */
export async function sendInvitationEmail(
  data: InvitationEmailData
): Promise<boolean> {
  const { inviteeEmail, inviterName, organizationName, role, inviteLink } =
    data;

  const baseUrl = inviteLink.split("/accept-invite")[0];
  const logoUrl = `${baseUrl}/keeperhub_logo.png`;

  const subject = `You've been invited to join ${organizationName} on KeeperHub`;

  const text = `
Hi there,

${inviterName} has invited you to join ${organizationName} organization as a ${role} on KeeperHub.

Click the link below to accept the invitation and create your account:

${inviteLink}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
KeeperHub - Blockchain Workflow Automation
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <img src="${logoUrl}" alt="KeeperHub" style="max-width: 200px; height: auto;" />
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #1a1a2e; margin-top: 0;">You're Invited!</h2>

    <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> organization as a <strong>${role}</strong> on KeeperHub.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteLink}" style="display: inline-block; background: #3b82f6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
    </div>

    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">${inviteLink}</p>

    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; margin-bottom: 0;">
      This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">KeeperHub - Blockchain Workflow Automation</p>
  </div>
</body>
</html>
`.trim();

  const success = await sendEmail({
    to: inviteeEmail,
    subject,
    text,
    html,
  });

  if (success) {
    console.log(`[Email] Invitation sent to ${inviteeEmail}`);
  } else {
    console.error(`[Email] Failed to send invitation to ${inviteeEmail}`);
  }

  return success;
}
