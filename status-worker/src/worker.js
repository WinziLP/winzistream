// Cloudflare Worker – JSON Status + optional SSE stream
let TWITCH_TOKEN = "";
let TWITCH_TOKEN_EXP = 0;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);
    const isAllowed = allowed.includes(origin) || origin === "";

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(isAllowed ? origin : "*") });
    if (url.pathname.endsWith(".sse")) return streamSSE(isAllowed ? origin : "*", env);
    if (!["GET","HEAD"].includes(request.method)) return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(isAllowed ? origin : "*") });

    const cache = caches.default;
    const cacheKey = new Request(new URL(request.url), request);
    const cached = await cache.match(cacheKey);
    if (cached) return addCors(cached, isAllowed ? origin : "*");

    const [twitch, kick] = await Promise.all([checkTwitch(env), checkKick(env)]);
    const payload = { twitch, kick, checked_at: new Date().toISOString() };
    const etag = await sha256(JSON.stringify(payload));
    if (request.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers: { ...corsHeaders(isAllowed ? origin : "*") } });

    const res = new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=15, s-maxage=15",
        "etag": etag,
        ...corsHeaders(isAllowed ? origin : "*")
      }
    });
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  }
};

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "Content-Type, If-None-Match",
    "cache-control": "no-transform",
    "vary": "Origin"
  };
}
function addCors(res, origin) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", origin);
  h.set("vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}

async function streamSSE(origin, env) {
  const { readable, writable } = new TransformStream();
  const encoder = new TextEncoder();
  const writer = writable.getWriter();
  const headers = { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "connection": "keep-alive", ...corsHeaders(origin) };

  let prev = { twitch: null, kick: null };

  const send = async (type, data) => { await writer.write(encoder.encode(`event: ${type}\n` + `data: ${JSON.stringify(data)}\n\n`)); };
  const tick = async () => {
    try {
      const [twitch, kick] = await Promise.all([checkTwitch(env), checkKick(env)]);
      const cur = { twitch, kick, checked_at: new Date().toISOString() };
      if (prev.twitch !== cur.twitch || prev.kick !== cur.kick) { await send("message", cur); prev = cur; }
    } catch {}
  };
  tick();
  const interval = setInterval(tick, 10000);
  const ping = setInterval(async () => { await send("ping", { t: Date.now() }); }, 25000);
  setTimeout(async () => { clearInterval(interval); clearInterval(ping); try { await writer.close(); } catch {} }, 115000);
  return new Response(readable, { headers });
}

async function checkTwitch(env) {
  try {
    const token = await getTwitchToken(env);
    const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${env.TWITCH_LOGIN}`, { headers: { "Client-ID": env.TWITCH_CLIENT_ID, "Authorization": `Bearer ${token}` } });
    if (!r.ok) return false;
    const j = await r.json();
    return Array.isArray(j.data) && j.data.length > 0 && j.data[0].type === "live";
  } catch { return false; }
}
async function getTwitchToken(env) {
  const now = Date.now();
  if (TWITCH_TOKEN && now < TWITCH_TOKEN_EXP - 60_000) return TWITCH_TOKEN;
  const body = new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: "client_credentials" });
  const r = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error("twitch token failed");
  const j = await r.json();
  TWITCH_TOKEN = j.access_token;
  TWITCH_TOKEN_EXP = Date.now() + (j.expires_in || 3600) * 1000;
  return TWITCH_TOKEN;
}

async function checkKick(env) {
  if (env.KICK_APP_TOKEN) {
    try {
      const r = await fetch(`https://api.kick.com/public/v1/channels?slug=${env.KICK_SLUG}`, { headers: { "Authorization": `Bearer ${env.KICK_APP_TOKEN}` } });
      if (r.ok) { const j = await r.json(); const ch = j?.data?.[0]; return !!(ch && ch.stream && ch.stream.is_live); }
    } catch {}
  }
  try {
    const r = await fetch(`https://kick.com/api/v2/channels/${env.KICK_SLUG}`, { headers: { "Accept": "application/json" } });
    if (!r.ok) return false;
    const j = await r.json();
    return Boolean(j && j.livestream);
  } catch { return false; }
}

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return `"` + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("") + `"`;
}
