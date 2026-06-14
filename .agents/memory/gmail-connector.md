---
name: Gmail OAuth connector
description: Cómo está configurado el envío de emails en LRC y por qué se usa OAuth en vez de App Password.
---

# Gmail OAuth connector en LRC

**Why:** Los App Passwords de Gmail son rechazados consistentemente en producción (error 535 BadCredentials), incluso con contraseñas válidas. El conector OAuth de Replit (`google-mail`) es más fiable y no requiere contraseña.

**How to apply:** Usar `@replit/connectors-sdk` en `artifacts/api-server`. El mailer está en `artifacts/api-server/src/lib/mailer.ts`. Llama a `connectors.proxy('google-mail', '/gmail/v1/users/me/messages/send', ...)` con el mensaje en formato RFC 2822 codificado en base64url.

**Cuenta OAuth conectada:** `appsuppor2026@gmail.com` — OJO: falta la 't' en "support". MAIL_FROM y MAIL_ADMIN deben usar `appsuppor2026`, no `appsupport2026`.

**Diagnóstico:** El endpoint `GET /api/ai/mail-diag` devuelve el perfil Gmail del OAuth para verificar qué cuenta está conectada.
