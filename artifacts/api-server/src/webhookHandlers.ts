import { getStripeSync } from './stripeClient.js';
import { sendMail, MAIL_ADMIN } from './lib/mailer.js';
import { logger } from './lib/logger.js';

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

    // Send emails after successful webhook processing
    if (event?.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const customerEmail = session?.customer_details?.email || session?.customer_email;
      const interval = session?.metadata?.interval ?? 'month';
      const plan = interval === 'year' ? 'Anual (€49.99/año)' : 'Mensual (€4.99/mes)';

      if (customerEmail) {
        // Welcome email to user
        sendMail({
          to: customerEmail,
          subject: '⚡ Bienvenido a Liquidity Radar Crypto — Prueba activa',
          text: `¡Bienvenido a LRC Pro!\n\nTu prueba gratuita de 2 días está activa. Accede a la app y empieza a analizar liquidez en tiempo real.\n\nPlan: ${plan}\nCuenta: ${customerEmail}\n\nSi tienes dudas, responde a este correo.\n\n— Equipo LRC`,
          html: welcomeHtml(customerEmail, plan),
        }).catch(err => logger.warn({ err }, 'Failed to send welcome email'));

        // Admin notification
        sendMail({
          to: MAIL_ADMIN,
          subject: `[LRC] Nueva suscripción — ${customerEmail}`,
          text: `Nueva suscripción completada.\n\nEmail: ${customerEmail}\nPlan: ${plan}\nFecha: ${new Date().toLocaleString('es-ES')}\nSession ID: ${session?.id ?? '-'}`,
        }).catch(err => logger.warn({ err }, 'Failed to send admin notification'));
      }
    }

    if (event?.type === 'customer.subscription.deleted') {
      const sub = event.data?.object;
      logger.info({ customerId: sub?.customer }, 'Subscription cancelled');
    }
  }
}
