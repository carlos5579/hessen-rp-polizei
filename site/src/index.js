// Ein einziger Cloudflare Worker, der:
//  1. die Website (public/index.html + weitere statische Dateien) ausliefert
//  2. die API-Routen /api/login, /api/data, /api/save, /api/notruf, /api/apply übernimmt
//
// Das ersetzt die vorherigen einzelnen Pages-Functions-Dateien — für "Workers"
// (statt klassische "Pages"-Projekte) gilt eine andere Konvention: ein
// zentrales fetch()-Skript statt eines functions/-Ordners.

const DATA_KEYS = [
  "officers", "alerts", "wanted", "catalog", "citizens",
  "applications", "press", "plan", "badgeCounter", "ranks",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === "/api/login" && method === "POST") return await handleLogin(request, env);
      if (path === "/api/data" && method === "GET") return await handleData(env);
      if (path === "/api/save" && method === "POST") return await handleSave(request, env);
      if (path === "/api/notruf" && method === "POST") return await handleNotruf(request, env);
      if (path === "/api/apply" && method === "POST") return await handleApply(request, env);
    } catch (e) {
      return json({ ok: false, error: "server_error" }, 500);
    }

    // Alles andere: statische Datei ausliefern (index.html, etc.)
    return env.ASSETS.fetch(request);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const valid = await env.PH_KV.get("session:" + token);
  return !!valid;
}

// ---------- /api/login ----------
async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid_body" }, 400);
  }
  const password = body && body.password;
  if (!env.ADMIN_PASSWORD) return json({ ok: false, error: "server_not_configured" }, 500);
  if (password !== env.ADMIN_PASSWORD) {
    await new Promise((r) => setTimeout(r, 400));
    return json({ ok: false }, 401);
  }
  const token = crypto.randomUUID();
  await env.PH_KV.put("session:" + token, "1", { expirationTtl: 60 * 60 * 8 });
  return json({ ok: true, token });
}

// ---------- /api/data ----------
async function handleData(env) {
  const result = {};
  for (const key of DATA_KEYS) {
    const raw = await env.PH_KV.get("data:" + key);
    result[key] = raw ? JSON.parse(raw) : null;
  }
  return json(result);
}

// ---------- /api/save (nur Admin) ----------
async function handleSave(request, env) {
  const ok = await requireAuth(request, env);
  if (!ok) return json({ ok: false, error: "unauthorized" }, 401);
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: "invalid_body" }, 400);
  }
  const { resource, value } = body || {};
  if (!DATA_KEYS.includes(resource)) return json({ ok: false, error: "invalid_resource" }, 400);
  await env.PH_KV.put("data:" + resource, JSON.stringify(value));
  return json({ ok: true });
}

// ---------- /api/notruf (öffentlich) ----------
async function handleNotruf(request, env) {
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
    ort, art, prio, melder, beschreibung,
    status: "open",
    time: new Date().toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
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
          embeds: [{
            title: "Notruf — " + art,
            description: beschreibung || "Keine weitere Beschreibung.",
            color,
            fields: [
              { name: "Ort", value: ort, inline: true },
              { name: "Priorität", value: "Stufe " + prio, inline: true },
              { name: "Gemeldet von", value: melder, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    } catch (e) {
      // Discord nicht erreichbar -> Alarm bleibt trotzdem im Protokoll erhalten
    }
  }
  return json({ ok: true, alert: entry });
}

// ---------- /api/apply (öffentlich, nur anhängend) ----------
async function handleApply(request, env) {
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
  if (!name || !discord || !motivation) return json({ ok: false, error: "missing_fields" }, 400);

  const raw = await env.PH_KV.get("data:applications");
  const list = raw ? JSON.parse(raw) : [];
  list.push({
    id: Date.now(), name, discord, avail, unit, motivation,
    status: "pending", date: new Date().toLocaleDateString("de-DE"),
  });
  await env.PH_KV.put("data:applications", JSON.stringify(list));
  return json({ ok: true });
}
