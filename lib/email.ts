// Email sending — dev mode only.
//
// This is a stub that prints emails to the server console. To enable real
// emails, sign up for Resend (https://resend.com) or another provider, then
// replace `sendEmail` with a call to their SDK. The rest of the codebase
// only depends on this module's interface.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(message: EmailMessage): Promise<void> {
  // In production, call your email provider here.
  // For now we log the contents so dev can copy/paste links from the console.
  const banner = "═".repeat(60);
  console.log(
    [
      "",
      banner,
      `📧 EMAIL (dev console — no real delivery configured)`,
      banner,
      `To:      ${message.to}`,
      `Subject: ${message.subject}`,
      "",
      message.text,
      banner,
      "",
    ].join("\n")
  );
}
