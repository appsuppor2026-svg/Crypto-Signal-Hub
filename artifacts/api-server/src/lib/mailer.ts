import nodemailer from 'nodemailer';

export const MAIL_FROM = '"Liquidity Radar Crypto" <appsupport2026@gmail.com>';
export const MAIL_ADMIN = 'appsupport2026@gmail.com';

export function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: MAIL_ADMIN,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: MAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
