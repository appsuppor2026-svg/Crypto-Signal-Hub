import { Router } from "express";
import OpenAI from "openai";
import { sendMail, getGmailProfile, MAIL_ADMIN } from "../lib/mailer.js";

const router: any = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/ai/analyze — AI crypto analysis (streaming SSE)
router.post("/analyze", async (req: any, res: any) => {
  const { symbol, price, change24h, radarScore, upperZones, lowerZones, bias } = req.body;

  if (!symbol || !price) {
    res.status(400).json({ error: "symbol and price required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const upperStr = upperZones?.length
    ? upperZones.map((z: any) => `$${z.price?.toFixed(2)} (${z.label || "resistencia"})`).join(", ")
    : "N/A";
  const lowerStr = lowerZones?.length
    ? lowerZones.map((z: any) => `$${z.price?.toFixed(2)} (${z.label || "soporte"})`).join(", ")
    : "N/A";

  const prompt = `Eres un analista experto en criptomonedas y trading. Analiza el siguiente activo y proporciona un análisis técnico conciso, perspicaz y accionable en español.

DATOS ACTUALES DE ${symbol}:
- Precio actual: $${price}
- Cambio 24h: ${change24h > 0 ? "+" : ""}${change24h?.toFixed(2)}%
- Radar Score (liquidez): ${radarScore ?? "N/A"}/100
- Sesgo del mercado: ${bias ?? "NEUTRAL"}
- Zonas de liquidez superiores (resistencias): ${upperStr}
- Zonas de liquidez inferiores (soportes): ${lowerStr}

Proporciona un análisis estructurado con estas secciones exactas (usa emojis para cada título):
1. 📊 Situación Actual (2-3 frases sobre el estado del precio y momentum)
2. 🔴 Resistencias Clave (menciona las zonas superiores más importantes)
3. 🟢 Soportes Clave (menciona las zonas inferiores más importantes)
4. 📈 Escenario Alcista (qué debe pasar para subir, objetivos)
5. 📉 Escenario Bajista (qué debe pasar para bajar, objetivos)
6. ⚡ Señal de Trading (recomendación concreta: COMPRA / VENTA / ESPERAR, con nivel de entrada y stop loss sugerido)
7. ⚠️ Gestión de Riesgo (advertencia breve sobre el riesgo)

Sé directo, usa datos concretos del activo, y mantén cada sección en 2-3 líneas máximo. No olvides que esto es análisis informativo, no asesoramiento financiero.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message || "Error generando análisis" })}\n\n`);
    res.end();
  }
});

// GET /api/ai/mail-diag — diagnose Gmail connector (which account, can we send?)
router.get("/mail-diag", async (req: any, res: any) => {
  const profile = await getGmailProfile();
  res.json({ profile });
});

// POST /api/ai/contact — send support email (hidden destination)
router.post("/contact", async (req: any, res: any) => {
  const { name, email, message, subject } = req.body;

  if (!message || message.trim().length < 5) {
    res.status(400).json({ error: "Mensaje muy corto" });
    return;
  }

  const mailContent = `
Nueva consulta de soporte — Liquidity Radar Crypto
===================================================
Nombre: ${name || "No proporcionado"}
Email del usuario: ${email || "No proporcionado"}
Asunto: ${subject || "Consulta general"}
Fecha: ${new Date().toLocaleString("es-ES")}

Mensaje:
${message}
  `.trim();

  try {
    await sendMail({
      to: MAIL_ADMIN,
      subject: `[Soporte LR] ${subject || "Nueva consulta"} - ${name || email || "usuario"}`,
      text: mailContent,
    });
    res.json({ ok: true });
  } catch (err: any) {
    req.log?.warn?.({ err: err.message }, "Email send failed");
    res.json({ ok: true });
  }
});

// POST /api/ai/profile-notify — send profile data notification (silent, hidden destination)
router.post("/profile-notify", async (req: any, res: any) => {
  const { profile } = req.body;
  if (!profile) { res.json({ ok: true }); return; }

  const content = `
Nuevo perfil guardado — Liquidity Radar Crypto
===============================================
Nombre: ${profile.name || "-"}
Nickname: ${profile.nickname || "-"}
Email: ${profile.email || "-"}
Teléfono: ${profile.phone || "-"}
País: ${profile.country || "-"}
Idioma: ${profile.language || "-"}
Fecha: ${new Date().toLocaleString("es-ES")}
  `.trim();

  sendMail({
    to: MAIL_ADMIN,
    subject: `[LR] Perfil actualizado — ${profile.name || profile.nickname || profile.email || "usuario"}`,
    text: content,
  }).catch(() => {});

  res.json({ ok: true });
});

// POST /api/ai/alert-email — envía email cuando salta una alerta de precio
router.post("/alert-email", async (req: any, res: any) => {
  const { email, symbol, condition, targetPrice, currentPrice } = req.body as {
    email: string;
    symbol: string;
    condition: 'above' | 'below';
    targetPrice: number;
    currentPrice: number;
  };

  if (!email || !symbol || !targetPrice) {
    res.json({ ok: true }); return;
  }

  const conditionText = condition === 'above' ? 'superó' : 'cayó por debajo de';
  const fmt = (n: number) => n >= 1
    ? `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toFixed(4)}`;

  const subject = `🚨 Alerta disparada: ${symbol} ${conditionText} ${fmt(targetPrice)}`;
  const text = `Tu alerta de precio se ha disparado.\n\n${symbol} ${conditionText} ${fmt(targetPrice)}\nPrecio actual: ${fmt(currentPrice)}\nFecha: ${new Date().toLocaleString('es-ES')}\n\nGestiona tus alertas en la app de Liquidity Radar Crypto.`;
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:0;padding:32px">
  <div style="max-width:420px;margin:0 auto">
    <h1 style="color:#f7931a;font-family:monospace;font-size:22px;text-align:center;margin-bottom:24px">⚡ Liquidity Radar Crypto</h1>
    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px">
      <div style="font-size:32px;text-align:center;margin-bottom:12px">🚨</div>
      <h2 style="margin:0 0 12px;font-size:18px;text-align:center">Alerta Disparada</h2>
      <div style="background:#0d1117;border-radius:8px;padding:16px;text-align:center">
        <p style="font-size:24px;font-family:monospace;color:#f7931a;margin:0 0 4px;font-weight:700">${symbol}</p>
        <p style="margin:0;color:#8b949e;font-size:14px">${conditionText} <strong style="color:#e6edf3">${fmt(targetPrice)}</strong></p>
        <p style="margin:8px 0 0;color:#8b949e;font-size:13px">Precio actual: <strong style="color:#e6edf3">${fmt(currentPrice)}</strong></p>
      </div>
      <p style="text-align:center;color:#8b949e;font-size:12px;margin-top:16px">${new Date().toLocaleString('es-ES')}</p>
    </div>
    <p style="text-align:center;color:#484f58;font-size:11px;margin-top:16px">Gestiona tus alertas en la app · Liquidity Radar Crypto</p>
  </div>
</body></html>`.trim();

  sendMail({ to: email, subject, text, html }).catch(() => {});
  res.json({ ok: true });
});

// POST /api/ai/onboarding — bienvenida al nuevo usuario tras completar el onboarding
router.post("/onboarding", async (req: any, res: any) => {
  const { name, email, nickname, phone } = req.body as {
    name: string; email: string; nickname?: string; phone?: string;
  };

  if (!email) { res.json({ ok: true }); return; }

  const firstName = (name || email).split(' ')[0];

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;margin:0;padding:32px">
  <div style="max-width:480px;margin:0 auto">
    <div style="text-align:center;margin-bottom:28px">
      <div style="font-size:44px">⚡</div>
      <h1 style="color:#f7931a;font-size:24px;margin:8px 0;font-family:monospace">Liquidity Radar Crypto</h1>
    </div>
    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;margin-bottom:20px">
      <h2 style="margin:0 0 12px;font-size:18px">Hola, ${firstName}! 👋</h2>
      <p style="color:#8b949e;margin:0 0 16px;font-size:14px">
        Tu cuenta ha sido creada correctamente. Bienvenido a <strong style="color:#e6edf3">LRC</strong>.
      </p>
      <div style="background:#0d1117;border-radius:8px;padding:16px">
        <p style="margin:0 0 10px;font-size:13px;color:#f7931a;font-weight:600">¿Qué puedes hacer ahora?</p>
        <ul style="margin:0;padding:0 0 0 18px;color:#8b949e;font-size:13px;line-height:2.2">
          <li>📡 Ver el <strong style="color:#e6edf3">Radar Score</strong> de liquidez en tiempo real</li>
          <li>📊 Analizar gráficos de velas con indicadores técnicos</li>
          <li>🔔 Crear <strong style="color:#e6edf3">alertas de precio</strong> y recibirlas por email</li>
          <li>🏟️ Simular operaciones en el <strong style="color:#e6edf3">Arena Simulator</strong></li>
          <li>🤖 Obtener análisis AI por activo</li>
        </ul>
      </div>
    </div>
    <p style="text-align:center;color:#484f58;font-size:11px">
      Si tienes dudas, responde a este correo · Liquidity Radar Crypto
    </p>
  </div>
</body></html>`.trim();

  const text = `Hola ${firstName}!\n\nTu cuenta en Liquidity Radar Crypto ha sido creada.\n\nYa puedes usar todas las herramientas de análisis: radar de liquidez, gráficos, alertas, Arena Simulator y análisis AI.\n\nSi tienes dudas, responde a este correo.\n\n— Equipo LRC`;

  // Welcome email to user
  sendMail({
    to: email,
    subject: `⚡ Bienvenido a Liquidity Radar Crypto, ${firstName}!`,
    text,
    html,
  }).catch(() => {});

  // Admin notification
  sendMail({
    to: MAIL_ADMIN,
    subject: `[LRC] Nuevo usuario — ${name || email}`,
    text: `Nuevo registro en LRC.\n\nNombre: ${name || '-'}\nEmail: ${email}\nNickname: ${nickname || '-'}\nTeléfono: ${phone || '-'}\nFecha: ${new Date().toLocaleString('es-ES')}`,
  }).catch(() => {});

  res.json({ ok: true });
});

export default router;
