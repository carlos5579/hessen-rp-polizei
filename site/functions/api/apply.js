// POST /api/apply  { name, discord, avail, unit, motivation, ... }
// Öffentlich nutzbar, damit sich jeder bewerben kann — aber diese Function
// kann Bewerbungen ausschließlich ANHÄNGEN, nicht lesen, ändern oder löschen.
// Das Einsehen und Freigeben passiert über /api/data (GET) und /api/save
// (POST, nur mit Admin-Token) im Admin-Bereich der Website.

import { json } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const name = (body.name || "").toString().slice(0, 80);
  const discord = (body.discord || "").toString().slice(0, 60);
  const avail = (body.avail || "").toString().slice(0, 60);
  const unit = (body.unit || "Landespolizei").toString().slice(0, 40);
  const motivation = (body.motivation || "").toString().slice(0, 1000);

  if (!name || !discord || !motivation) {
    return json({ ok: false, error: "missing_fields" }, 400);
  }

  const raw = await env.PH_KV.get("data:applications");
  const list = raw ? JSON.parse(raw) : [];

  list.push({
    id: Date.now(),
    name,
    discord,
    avail,
    unit,
    motivation,
    status: "pending",
    date: new Date().toLocaleDateString("de-DE"),
  });

  await env.PH_KV.put("data:applications", JSON.stringify(list));
  return json({ ok: true });
}
