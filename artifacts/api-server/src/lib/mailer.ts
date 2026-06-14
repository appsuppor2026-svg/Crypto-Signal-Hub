// Gmail via Replit OAuth connector — no App Password needed
import { ReplitConnectors } from '@replit/connectors-sdk';

export const MAIL_FROM = 'appsupport2026@gmail.com';
export const MAIL_ADMIN = 'appsupport2026@gmail.com';

function buildRawMessage(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): string {
  const boundary = `lrc_${Date.now()}`;
  const lines: string[] = [
    `From: "Liquidity Radar Crypto" <${MAIL_FROM}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
  ];

  if (opts.html) {
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`, '');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8', '');
    lines.push(opts.text, '');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=UTF-8', '');
    lines.push(opts.html, '');
    lines.push(`--${boundary}--`);
  } else {
    lines.push('Content-Type: text/plain; charset=UTF-8', '');
    lines.push(opts.text);
  }

  const raw = lines.join('\r\n');
  // base64url encode (no padding, URL-safe)
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const connectors = new ReplitConnectors();
  const raw = buildRawMessage(opts);

  const response = await connectors.proxy('google-mail', '/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gmail API error ${response.status}: ${body}`);
  }
}
