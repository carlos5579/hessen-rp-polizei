# Polizei Hessen — Deploy-Anleitung (Cloudflare Pages)

## Was ist neu gegenüber der reinen HTML-Version?

Statt Daten nur im Browser (`localStorage`) zu speichern, laufen jetzt echte                
Server-Funktionen im Ordner `functions/`. Dadurch:                 

- **Admin-Passwort** steht nicht mehr im Quelltext, sondern wird serverseitig
  als Umgebungsvariable geprüft.
- **Discord-Webhook-URL** wird nie an den Browser ausgeliefert — sie bleibt
  komplett serverseitig.
- **Alle Besucher sehen dieselben Daten** (Beamte, Notrufe, Fahndungen, …),
  gespeichert in Cloudflare KV statt getrennt pro Browser.      

## Voraussetzungen
                 
- Ein kostenloser Cloudflare-Account
- Node.js installiert (für die `wrangler`-Kommandozeile)

## 1. KV-Namespace anlegen

```bash
npx wrangler kv namespace create PH_KV
```

Das gibt dir eine `id` aus, z. B.:

```
[[kv_namespaces]]
binding = "PH_KV"
id = "abcd1234..."
```

Trage diese `id` in `wrangler.toml` anstelle von `HIER_DEINE_KV_NAMESPACE_ID_EINTRAGEN` ein.

## 2. Projekt deployen

Im Projektordner (dort, wo `index.html`, `functions/` und `wrangler.toml` liegen):

```bash
npx wrangler login
npx wrangler pages deploy .
```

Beim ersten Mal fragt Wrangler nach einem Projektnamen — z. B. `polizei-hessen`.
Das legt automatisch ein Cloudflare-Pages-Projekt an **inklusive** der Functions.

Alternativ: Repository auf GitHub pushen und in der Cloudflare-Pages-Oberfläche
("Workers & Pages" → "Create" → "Pages" → "Connect to Git") verbinden — dann
baut Cloudflare bei jedem Push automatisch neu.

## 3. Umgebungsvariablen setzen

Im Cloudflare-Dashboard: **Workers & Pages → euer Projekt → Settings →
Environment variables**. Für die Produktionsumgebung ("Production") anlegen:

| Name | Wert | Verschlüsselt? |
|---|---|---|
| `ADMIN_PASSWORD` | euer echtes Admin-Passwort (nicht `hessen2026` lassen!) | ✅ Encrypt anklicken |
| `DISCORD_WEBHOOK_URL` | Webhook-URL aus eurem Discord-Kanal (Kanal bearbeiten → Integrationen → Webhooks) | ✅ Encrypt anklicken |

Danach unter **Deployments** ein Redeploy anstoßen, damit die Functions die
neuen Variablen sehen.

## 4. KV-Bindung im Dashboard verknüpfen

Falls ihr über Git deployt (nicht per `wrangler pages deploy`), muss die
KV-Bindung zusätzlich im Dashboard eingetragen werden: **Settings → Functions
→ KV namespace bindings** → Variable name `PH_KV` → euren Namespace auswählen.

## 5. Lokal testen (optional)

```bash
npx wrangler pages dev .
```

Das startet die Seite inklusive Functions lokal unter `http://localhost:8788`.
Ohne KV-Setup laufen Admin-Login und das Speichern ins Leere — die Seite
zeigt dann automatisch Demo-Daten an, stürzt aber nicht ab.

## Sicherheitshinweise

- Ändert unbedingt `ADMIN_PASSWORD` auf etwas Eigenes — `hessen2026` ist nur
  ein Platzhalter.
- Die Session-Tokens laufen nach 8 Stunden automatisch ab (in `login.js`
  über `expirationTtl` einstellbar).
- `/api/apply` und `/api/notruf` sind absichtlich ohne Login nutzbar (jeder
  soll sich bewerben / einen Notruf absetzen können) — sie können aber nur
  anhängen, nicht lesen oder löschen.
- Für eine noch stärkere Absicherung könnte man zusätzlich Cloudflare Turnstile
  (Captcha) vor `/api/notruf` und `/api/apply` schalten, um Spam zu verhindern.
  Sag Bescheid, falls das ergänzt werden soll.

## Dateistruktur

```
index.html                  → die komplette Website (Frontend)
functions/_auth.js           → gemeinsame Hilfsfunktion für Admin-Auth
functions/api/login.js       → POST: Admin-Login, gibt Session-Token zurück
functions/api/data.js        → GET: liefert alle öffentlichen Daten
functions/api/save.js        → POST: schreibt eine Ressource (nur Admin)
functions/api/notruf.js      → POST: Notruf absetzen (öffentlich) + Discord-Weiterleitung
functions/api/apply.js       → POST: Bewerbung absetzen (öffentlich, nur anhängend)
wrangler.toml                → Konfiguration inkl. KV-Bindung
```
