import { getStripeSync, getUncachableStripeClient } from './stripeClient.js';
import { sendMail, MAIL_ADMIN } from './lib/mailer.js';
import { logger } from './lib/logger.js';

const APP_URL = 'https://crypto-signal-hub-appsuppor2026.replit.app';

function welcomeHtml(email: string, plan: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:0;padding:32px">
  <div style="max-width:480px;margin:0 auto">
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:48px">⚡</div>
      <h1 style="color:#f7931a;font-size:28px;margin:8px 0;font-family:monospace">Liquidity Radar Crypto</h1>
      <p style="color:#8b949e;margin:0">Tu prueba gratuita está activa</p>
    </div>
    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;margin-bottom:24px">
      <h2 style="margin:0 0 16px;font-size:18px">¡Bienvenido a LRC Pro! 🎉</h2>
      <p style="color:#8b949e;margin:0 0 16px">
        Tu cuenta <strong style="color:#e6edf3">${email}</strong> tiene acceso completo durante 2 días de prueba gratuita.
      </p>
      <div style="background:#0d1117;border-radius:8px;padding:16px">
        <p style="margin:0 0 8px;font-size:14px;color:#f7931a;font-weight:600">Plan: ${plan}</p>
        <ul style="margin:0;padding:0 0 0 20px;color:#8b949e;font-size:14px;line-height:2">
          <li>📡 Radar Score de liquidez en tiempo real</li>
          <li>📊 Gráficos de velas con EMA / Bandas Bollinger / SQZ</li>
          <li>🏟️ Arena Simulator para simular operaciones</li>
          <li>🧮 SAE — Sistema de Análisis Estructurado</li>
          <li>🔔 Alertas inteligentes de precio y liquidez</li>
          <li>🤖 Análisis AI por activo</li>
        </ul>
      </div>
    </div>
    <div style="text-align:center;color:#8b949e;font-size:12px">
      <p>Si tienes alguna pregunta, responde a este correo.</p>
      <p style="margin-top:8px;color:#484f58">Liquidity Radar Crypto · No olvides gestionar tu suscripción desde la app.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function paymentFailedHtml(email: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:0;padding:32px">
  <div style="max-width:480px;margin:0 auto">
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:48px">⚠️</div>
      <h1 style="color:#f7931a;font-size:28px;margin:8px 0;font-family:monospace">Liquidity Radar Crypto</h1>
      <p style="color:#8b949e;margin:0">Problema con tu pago</p>
    </div>
    <div style="background:#161b22;border:1px solid #e3b341;border-radius:12px;padding:24px;margin-bottom:24px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#e3b341">No se pudo cobrar tu suscripción</h2>
      <p style="color:#8b949e;margin:0 0 16px">
        Hola <strong style="color:#e6edf3">${email}</strong>, ha habido un problema al procesar el pago de tu suscripción LRC Pro.
      </p>
      <p style="color:#8b949e;margin:0 0 20px">
        Por favor actualiza tu método de pago para mantener el acceso sin interrupciones. Lo intentaremos de nuevo automáticamente en los próximos días.
      </p>
      <div style="text-align:center">
        <a href="${APP_URL}" style="display:inline-block;background:#f7931a;color:#000;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px">
          Actualizar método de pago
        </a>
      </div>
    </div>
    <div style="text-align:center;color:#8b949e;font-size:12px">
      <p>Si tienes alguna pregunta, responde a este correo.</p>
      <p style="margin-top:8px;color:#484f58">Liquidity Radar Crypto</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function cancelledHtml(email: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:0;padding:32px">
  <div style="max-width:480px;margin:0 auto">
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:48px">😔</div>
      <h1 style="color:#f7931a;font-size:28px;margin:8px 0;font-family:monospace">Liquidity Radar Crypto</h1>
      <p style="color:#8b949e;margin:0">Tu suscripción ha finalizado</p>
    </div>
    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;margin-bottom:24px">
      <h2 style="margin:0 0 12px;font-size:18px">Acceso LRC Pro desactivado</h2>
      <p style="color:#8b949e;margin:0 0 16px">
        Hola <strong style="color:#e6edf3">${email}</strong>, tu suscripción a Liquidity Radar Crypto Pro ha sido cancelada y ya no tienes acceso a las funciones premium.
      </p>
      <p style="color:#8b949e;margin:0 0 20px">
        Si quieres volver a activar tu cuenta, puedes suscribirte en cualquier momento desde la app.
      </p>
      <div style="text-align:center">
        <a href="${APP_URL}" style="display:inline-block;background:#f7931a;color:#000;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px">
          Volver a suscribirme
        </a>
      </div>
    </div>
    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:16px;margin-bottom:24px">
      <p style="margin:0 0 8px;font-size:13px;color:#8b949e">Lo que perderás sin Pro:</p>
      <ul style="margin:0;padding:0 0 0 20px;color:#484f58;font-size:13px;line-height:2">
        <li>Radar Score en tiempo real</li>
        <li>Gráficos avanzados y señales</li>
        <li>Alertas de precio</li>
        <li>Análisis AI</li>
      </ul>
    </div>
    <div style="text-align:center;color:#8b949e;font-size:12px">
      <p>Si crees que es un error, responde a este correo.</p>
      <p style="margin-top:8px;color:#484f58">Liquidity Radar Crypto</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

async function getEmailFromCustomerId(customerId: string): Promise<string | null> {
  try {
    const stripe = await getUncachableStripeClient();
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return (customer as any).email ?? null;
  } catch {
    return null;
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // Parse event for email sending (signature already verified by sync below)
    let event: any;
    try {
      event = JSON.parse(payload.toString());
    } catch {
      // ignore parse errors, let sync handle them
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // ── checkout.session.completed → bienvenida ──────────────────────────────
    if (event?.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const customerEmail = session?.customer_details?.email || session?.customer_email;
      const interval = session?.metadata?.interval ?? 'month';
      const plan = interval === 'year' ? 'Anual (€49.99/año)' : 'Mensual (€4.99/mes)';

      if (customerEmail) {
        sendMail({
          to: customerEmail,
          subject: '⚡ Bienvenido a Liquidity Radar Crypto — Prueba activa',
          text: `¡Bienvenido a LRC Pro!\n\nTu prueba gratuita de 2 días está activa. Accede a la app y empieza a analizar liquidez en tiempo real.\n\nPlan: ${plan}\nCuenta: ${customerEmail}\n\nSi tienes dudas, responde a este correo.\n\n— Equipo LRC`,
          html: welcomeHtml(customerEmail, plan),
        }).catch(err => logger.warn({ err }, 'Failed to send welcome email'));

        sendMail({
          to: MAIL_ADMIN,
          subject: `[LRC] Nueva suscripción — ${customerEmail}`,
          text: `Nueva suscripción completada.\n\nEmail: ${customerEmail}\nPlan: ${plan}\nFecha: ${new Date().toLocaleString('es-ES')}\nSession ID: ${session?.id ?? '-'}`,
        }).catch(err => logger.warn({ err }, 'Failed to send admin notification'));
      }
    }

    // ── invoice.payment_failed → aviso de pago fallido ───────────────────────
    if (event?.type === 'invoice.payment_failed') {
      const invoice = event.data?.object;
      const customerId = invoice?.customer;
      if (customerId) {
        const email = await getEmailFromCustomerId(customerId);
        if (email) {
          sendMail({
            to: email,
            subject: '⚠️ Problema con tu pago en Liquidity Radar Crypto',
            text: `Hola ${email},\n\nNo hemos podido procesar el pago de tu suscripción LRC Pro. Por favor actualiza tu método de pago en la app para mantener el acceso.\n\nSi el problema persiste, responde a este correo.\n\n— Equipo LRC\n${APP_URL}`,
            html: paymentFailedHtml(email),
          }).catch(err => logger.warn({ err }, 'Failed to send payment failed email'));

          sendMail({
            to: MAIL_ADMIN,
            subject: `[LRC] Pago fallido — ${email}`,
            text: `Pago fallido.\n\nEmail: ${email}\nFecha: ${new Date().toLocaleString('es-ES')}\nInvoice: ${invoice?.id ?? '-'}`,
          }).catch(err => logger.warn({ err }, 'Failed to send admin payment failed notification'));
        }
      }
    }

    // ── customer.subscription.deleted → acceso cancelado ────────────────────
    if (event?.type === 'customer.subscription.deleted') {
      const sub = event.data?.object;
      const customerId = sub?.customer;
      logger.info({ customerId }, 'Subscription cancelled');

      if (customerId) {
        const email = await getEmailFromCustomerId(customerId);
        if (email) {
          sendMail({
            to: email,
            subject: '😔 Tu suscripción a Liquidity Radar Crypto ha finalizado',
            text: `Hola ${email},\n\nTu suscripción a LRC Pro ha sido cancelada y ya no tienes acceso a las funciones premium.\n\nSi quieres volver, puedes suscribirte en cualquier momento desde la app:\n${APP_URL}\n\nSi crees que es un error, responde a este correo.\n\n— Equipo LRC`,
            html: cancelledHtml(email),
          }).catch(err => logger.warn({ err }, 'Failed to send cancellation email'));

          sendMail({
            to: MAIL_ADMIN,
            subject: `[LRC] Suscripción cancelada — ${email}`,
            text: `Suscripción cancelada.\n\nEmail: ${email}\nFecha: ${new Date().toLocaleString('es-ES')}\nSubscription: ${sub?.id ?? '-'}`,
          }).catch(err => logger.warn({ err }, 'Failed to send admin cancellation notification'));
        }
      }
    }
  }
}
