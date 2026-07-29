// POST /api/save  { resource, value }
// Nur mit gültigem "Authorization: Bearer <token>" Header nutzbar
// (Token kommt aus /api/login). Schreibt eine komplette Ressource
// nach Cloudflare KV.

import { requireAuth, json } from "../_auth.js";

const ALLOWED = [
  "officers",
  "alerts",
  "wanted",
  "catalog",
  "citizens",
  "applications",
  "press",
  "plan",
  "badgeCounter",
];

export async function onRequestPost({ request, env }) {
  const ok = await requireAuth(request, env);
  if (!ok) return json({ ok: false, error: "unauthorized" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const { resource, value } = body || {};
  if (!ALLOWED.includes(resource)) {
    return json({ ok: false, error: "invalid_resource" }, 400);
  }

  await env.PH_KV.put("data:" + resource, JSON.stringify(value));
  return json({ ok: true });
}
