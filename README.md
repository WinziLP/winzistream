# Winzi – Landingpage

Diese Seite ist für GitHub Pages optimiert und zeigt den Live‑Status sowie Embeds von Twitch und Kick.

## Struktur
- `index.html` – schlankes HTML, bindet externe Assets
- `assets/css/styles.css` – gesamtes Styling
- `assets/js/main.js` – Logik für Live‑Status, Tabs und Embeds
- `assets/js/canvas.js` – Hintergrund‑Canvas (respektiert Reduced Motion)
- `assets/icons.svg` – SVG‑Sprite (`ico-twitch`, `ico-kick`)
- `.nojekyll` – deaktiviert Jekyll auf GitHub Pages

## Deploy (GitHub Pages)
1. Repo anlegen und Dateien pushen.
2. In den Repo‑Settings unter Pages die Source auf `main`/`root` stellen.
3. Optional: eigene Domain verbinden (CNAME anlegen) und TLS aktivieren.

## Hinweise
- Twitch‑Embed funktioniert nur über HTTPS oder lokal (`localhost/127.0.0.1`).
- Live‑Status wird via SSE (`winzi.sse`) bevorzugt und fällt auf Polling (`winzi.json`) zurück.
- Externe Icons werden mit `<use href="assets/icons.svg#symbol">` referenziert.
