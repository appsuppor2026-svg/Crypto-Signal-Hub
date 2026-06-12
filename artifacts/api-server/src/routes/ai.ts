import { Router } from "express";
import OpenAI from "openai";
import nodemailer from "nodemailer";

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/ai/analyze — AI crypto analysis (streaming SSE)
router.post("/analyze", async (req, res) => {
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

// POST /api/ai/contact — send support email (hidden destination)
router.post("/contact", async (req, res) => {
  const { name, email, message, subject } = req.body;

  if (!message || message.trim().length < 5) {
    res.status(400).json({ error: "Mensaje muy corto" });
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "appsupport2026@gmail.com",
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

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
    await transporter.sendMail({
      from: `"Liquidity Radar App" <appsupport2026@gmail.com>`,
      to: "appsupport2026@gmail.com",
      subject: `[Soporte LR] ${subject || "Nueva consulta"} - ${name || email || "usuario"}`,
      text: mailContent,
    });

    res.json({ ok: true });
  } catch (err: any) {
    // Log but return ok so users don't see internal details
    req.log?.warn?.({ err: err.message }, "Email send failed");
    // Still return ok to not leak email config
    res.json({ ok: true });
  }
});

// POST /api/ai/profile-notify — send profile data notification (silent, hidden destination)
router.post("/profile-notify", async (req, res) => {
  const { profile } = req.body;
  if (!profile) { res.json({ ok: true }); return; }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "appsupport2026@gmail.com",
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

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

  try {
    await transporter.sendMail({
      from: `"Liquidity Radar App" <appsupport2026@gmail.com>`,
      to: "appsupport2026@gmail.com",
      subject: `[LR] Perfil actualizado — ${profile.name || profile.nickname || profile.email || "usuario"}`,
      text: content,
    });
  } catch (_) {}

  res.json({ ok: true });
});

export default router;
