// POST /api/login  { password }  ->  { ok: true, token } | { ok: false }
//
// Das Passwort steht NIE im Frontend-Code. Es wird als Umgebungsvariable
// ADMIN_PASSWORD in den Cloudflare-Pages-Projekteinstellungen hinterlegt
// (Settings -> Environment variables -> "Encrypt" ankreuzen).
//
// Bei Erfolg wird ein zufälliges Session-Token erzeugt und in KV mit
// Ablaufzeit (8 Stunden) gespeichert. Das Frontend schickt dieses Token
// danach als "Authorization: Bearer <token>" Header bei schreibenden
// Aktionen mit.

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const password = body && body.password;
  if (!env.ADMIN_PASSWORD) {
    return json({ ok: false, error: "server_not_configured" }, 500);
  }
  if (password !== env.ADMIN_PASSWORD) {
    // kleine künstliche Verzögerung gegen simples Durchprobieren
    await new Promise((r) => setTimeout(r, 400));
    return json({ ok: false }, 401);
  }

  const token = crypto.randomUUID();
  await env.PH_KV.put("session:" + token, "1", { expirationTtl: 60 * 60 * 8 });
  return json({ ok: true, token });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
