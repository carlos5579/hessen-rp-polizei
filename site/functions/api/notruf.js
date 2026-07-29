// POST /api/notruf  { ort, art, prio, melder, beschreibung }
// Bewusst OHNE Login nutzbar — jeder soll einen Notruf absetzen können,
// genau wie im echten Rollenspiel. Die Discord-Webhook-URL bleibt dabei
// ausschließlich serverseitig (Umgebungsvariable DISCORD_WEBHOOK_URL) und
// wird niemals an den Browser ausgeliefert.

import { json } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid_body" }, 400);
  }

  const ort = (body.ort || "").toString().slice(0, 200);
  const art = (body.art || "Sonstiges").toString().slice(0, 60);
  const prio = ["1", "2", "3"].includes(body.prio) ? body.prio : "2";
  const melder = (body.melder || "Anonym").toString().slice(0, 80);
  const beschreibung = (body.beschreibung || "").toString().slice(0, 400);

  if (!ort) return json({ ok: false, error: "ort_required" }, 400);

  const raw = await env.PH_KV.get("data:alerts");
  const list = raw ? JSON.parse(raw) : [];

  const entry = {
    id: Date.now(),
    ort,
    art,
    prio,
    melder,
    beschreibung,
    status: "open",
    time: new Date().toLocaleString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    }),
  };
  list.unshift(entry);
  await env.PH_KV.put("data:alerts", JSON.stringify(list));

  if (env.DISCORD_WEBHOOK_URL) {
    const color = prio === "1" ? 15158332 : prio === "2" ? 15844367 : 5793266;
    try {
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "Notruf — " + art,
              description: beschreibung || "Keine weitere Beschreibung.",
              color,
              fields: [
                { name: "Ort", value: ort, inline: true },
                { name: "Priorität", value: "Stufe " + prio, inline: true },
                { name: "Gemeldet von", value: melder, inline: true },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch (e) {
      // Discord nicht erreichbar -> Alarm bleibt trotzdem im Protokoll erhalten
    }
  }

  return json({ ok: true, alert: entry });
}
