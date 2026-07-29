// Gemeinsame Hilfsfunktion: prüft das Bearer-Token gegen die in KV
// gespeicherten Sessions (siehe login.js). Wird von allen Functions
// importiert, die nur für eingeloggte Admins schreibbar sein sollen.

export async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const valid = await env.PH_KV.get("session:" + token);
  return !!valid;
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
