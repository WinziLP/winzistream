# Winzi Landing – GitHub Pages + Cloudflare

## Struktur
- `index.html` – deine Landingpage
- `CNAME` – enthält `winzi.stream` (sorgt dafür, dass GitHub Pages die Domain setzt)
- `status-worker/` – optionaler Cloudflare Worker für Live-Status (JSON + SSE)

## Deployment auf GitHub Pages (mit Cloudflare-DNS)

### 1) Repository erstellen & pushen
```bash
mkdir winzi-site && cd winzi-site
# Dateien aus diesem ZIP hinein kopieren
git init
git add .
git commit -m "Initial"
git branch -M main
git remote add origin https://github.com/<DEIN_USER>/<DEIN_REPO>.git
git push -u origin main
```

### 2) GitHub Pages aktivieren
- GitHub → **Settings** → **Pages**
- **Source**: *Deploy from a branch*
- **Branch**: `main` / `/root` (Save)
- Optional: Wenn du Actions bevorzugst, wähle **GitHub Actions** und nutze das Standard-Workflow-Template „Deploy static site“.

### 3) Custom Domain setzen
- In **Settings → Pages** bei **Custom domain**: `winzi.stream` eintragen und speichern
- GitHub zeigt dir ggf. einen Verifikations‑TXT an – diesen in Cloudflare als **TXT** bei `@` anlegen
- Warte bis **Certificate** und **HTTPS** aktiv sind (Haken „Enforce HTTPS“ setzen)

### 4) Cloudflare DNS konfigurieren
In Cloudflare (Zone: `winzi.stream`):
- **CNAME** `@` → `USERNAME.github.io`  (DNS only / graue Wolke für die erste Ausstellung des GitHub‑Zertifikats)
- **CNAME** `www` → `USERNAME.github.io` (DNS only)
> Hinweis: Nach aktiver HTTPS‑Ausstellung kannst du die Einträge auf **Proxied** (orange) setzen, wenn du über Cloudflare ausliefern möchtest.

### 5) Live‑Status Endpoint (optional, empfohlen)
Den Worker in `status-worker/` deployen:
```bash
npm i -g wrangler
cd status-worker
wrangler secret put TWITCH_CLIENT_ID
wrangler secret put TWITCH_CLIENT_SECRET
# optional: wrangler secret put KICK_APP_TOKEN
wrangler deploy
```
In Cloudflare → **Workers**:
- **Routes**: `status.winzi.stream/*` dem Worker zuordnen
- DNS: Falls nötig, `status` als proxied Eintrag (z. B. A 192.0.2.1, orange Wolke) anlegen

**Fertig!** Deine Seite lädt den Status von:
- JSON `https://status.winzi.stream/winzi.json`
- SSE  `https://status.winzi.stream/winzi.sse`

> Wenn du die Endpoints anders benennst, passe sie in `index.html` in den `<meta name="status-endpoint">`/`status-sse` Tags an.
