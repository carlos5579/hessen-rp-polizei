// GET /api/data  ->  liefert den kompletten öffentlichen Datenbestand.
// Kein Login nötig — das ist bewusst so wie die "Dienstnummer nachschlagen"
// oder "Fahndungsliste" Bereiche, die für alle Besucher sichtbar sind.

import { json } from "../_auth.js";

const KEYS = [
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

export async function onRequestGet({ env }) {
  const result = {};
  for (const key of KEYS) {
    const raw = await env.PH_KV.get("data:" + key);
    result[key] = raw ? JSON.parse(raw) : null;
  }
  return json(result);
}
