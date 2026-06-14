// Gmail via Replit OAuth connector — no App Password needed
import { ReplitConnectors } from '@replit/connectors-sdk';
import { logger } from './logger.js';

export const MAIL_FROM = 'appsuppor2026@gmail.com';
export const MAIL_ADMIN = 'appsuppor2026@gmail.com';

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

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
    `Subject: ${encodeSubject(opts.subject)}`,
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
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function getGmailProfile(): Promise<{ emailAddress?: string; error?: string }> {
  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy('google-mail', '/gmail/v1/users/me/profile', { method: 'GET' });
    const body = await response.json() as any;
    return body;
  } catch (err: any) {
    return { error: err.message };
  }
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

  const responseBody = await response.text().catch(() => '');

  logger.info({ status: response.status, to: opts.to, subject: opts.subject, body: responseBody }, 'Gmail API send result');

  if (!response.ok) {
    throw new Error(`Gmail API error ${response.status}: ${responseBody}`);
  }
}
