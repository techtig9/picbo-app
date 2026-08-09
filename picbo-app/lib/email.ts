import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log(`[email:mock] to=${to} subject="${subject}"\n${html}`);
    return;
  }
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Picbo.ai <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}

export function verificationEmailHtml(name: string, verifyUrl: string): string {
  return `<p>Hi ${name},</p><p>Confirm your Picbo.ai account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
}

export function passwordResetEmailHtml(name: string, resetUrl: string): string {
  return `<p>Hi ${name},</p><p>Reset your Picbo.ai password (expires in 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`;
}
