// RemadeByAI click counter (Cloudflare Worker, one file, no dependencies).
// The site's site.js sends POST /click with {"app":"bitchat","kind":"download","page":"/apps/bitchat/"}
// (via navigator.sendBeacon, so it never slows the visitor down) when someone presses Download,
// Visit site, Source code or a featured button. Nothing about the visitor is stored: no IP, no cookie.
//
// Counts live in the CLICKS KV namespace under two kinds of key:
//   total|<app>|<kind>          all-time count
//   day|<YYYY-MM-DD>|<app>|<kind>  count for that day (UTC), kept 400 days
// GET /stats?key=<STATS_KEY> shows a table of totals and the last 30 days; add &format=json for JSON.
// KV counters are read-then-write, so two clicks in the same instant can count once. Fine at this size.

const KINDS = ['download', 'site', 'source', 'featured'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/click') return click(request, env);
    if (url.pathname === '/stats' && request.method === 'GET') return stats(url, env);
    return new Response('Not found', { status: 404 });
  },
};

async function click(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const cors = allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Max-Age': '86400' } });
  if (request.method !== 'POST') return new Response('Use POST', { status: 405, headers: cors });
  if (!cors['Access-Control-Allow-Origin']) return new Response('Forbidden', { status: 403 });
  if (Number(request.headers.get('Content-Length') || 0) > 1000) return new Response('Too large', { status: 413, headers: cors });

  let data;
  try { data = JSON.parse(await request.text()); } catch { return new Response('Bad request', { status: 400, headers: cors }); }
  const app = String(data.app || '');
  const kind = String(data.kind || '');
  if (!/^[a-z0-9-]{1,60}$/.test(app) || !KINDS.includes(kind)) return new Response('Bad request', { status: 400, headers: cors });

  const day = new Date().toISOString().slice(0, 10);
  await Promise.all([
    bump(env, `total|${app}|${kind}`),
    bump(env, `day|${day}|${app}|${kind}`, 400 * 86400),
  ]);
  return new Response(null, { status: 204, headers: cors });
}

async function bump(env, key, ttl) {
  const now = Number(await env.CLICKS.get(key)) || 0;
  await env.CLICKS.put(key, String(now + 1), ttl ? { expirationTtl: ttl } : undefined);
}

async function listAll(env, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await env.CLICKS.list({ prefix, cursor });
    for (const k of page.keys) out.push(k.name);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

async function stats(url, env) {
  if (!env.STATS_KEY || url.searchParams.get('key') !== env.STATS_KEY) return new Response('Not found', { status: 404 });
  const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const rows = {};
  const row = app => rows[app] || (rows[app] = { app, total: {}, last30: {} });
  for (const key of await listAll(env, 'total|')) {
    const [, app, kind] = key.split('|');
    row(app).total[kind] = Number(await env.CLICKS.get(key)) || 0;
  }
  for (const key of await listAll(env, 'day|')) {
    const [, day, app, kind] = key.split('|');
    if (day < since) continue;
    const r = row(app);
    r.last30[kind] = (r.last30[kind] || 0) + (Number(await env.CLICKS.get(key)) || 0);
  }
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  const list = Object.values(rows).sort((a, b) => sum(b.last30) - sum(a.last30) || sum(b.total) - sum(a.total));
  if (url.searchParams.get('format') === 'json') return Response.json({ since, apps: list });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cells = o => KINDS.map(k => `<td>${o[k] || ''}</td>`).join('') + `<td><b>${sum(o)}</b></td>`;
  const head = KINDS.map(k => `<th>${k}</th>`).join('') + '<th>all</th>';
  // Light/dark mode (2026-11-22): dark by default, the button top right switches, the choice is kept in
  // this page's localStorage "theme" (the same key and look as remadebyai.com's header button).
  const html = `<!doctype html><html lang="en" data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="dark"><meta name="darkreader-lock"><title>RemadeByAI clicks</title>
<script>(function(){var t='dark';try{if(localStorage.getItem('theme')==='light')t='light'}catch(e){}document.documentElement.setAttribute('data-theme',t);if(t==='light')document.querySelector('meta[name="color-scheme"]').content='light'})()</script>
<style>:root{--bg:#090d0b;--ink:#eff8ef;--muted:#acbcb0;--line:#28392d;--green:#c2ff94;--btn:#3b5141}[data-theme=light]{--bg:#f5f8f3;--ink:#142019;--muted:#4d5f52;--line:#d3dfd4;--green:#2f7a1c;--btn:#b9cbbd}
html{background:var(--bg)}body{font:15px system-ui;margin:24px;background:var(--bg);color:var(--ink)}table{border-collapse:collapse}th,td{padding:5px 10px;border-bottom:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}th{color:var(--green);font-weight:600}.g{color:var(--muted)}a{color:var(--green)}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.theme-toggle{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border:1px solid var(--btn);border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:14px}.theme-toggle:hover{border-color:var(--green);color:var(--green)}[data-theme=dark] .to-dark,[data-theme=light] .to-light{display:none}</style>
<div class="top"><h1>Outbound clicks</h1><button class="theme-toggle" type="button" aria-label="Switch to light or dark mode"><span class="to-light">\u2600\uFE0E Light mode</span><span class="to-dark">\u263E Dark mode</span></button></div>
<p class="g">Button clicks that leave remadebyai.com. Last 30 days from ${since} (UTC), and all time.</p>
<table><tr><th rowspan="2">App</th><th colspan="${KINDS.length + 1}">Last 30 days</th><th colspan="${KINDS.length + 1}">All time</th></tr><tr>${head}${head}</tr>
${list.map(r => `<tr><td><a href="https://remadebyai.com/apps/${esc(r.app)}/">${esc(r.app)}</a></td>${cells(r.last30)}${cells(r.total)}</tr>`).join('\n') || '<tr><td colspan="11" class="g">No clicks yet.</td></tr>'}
</table>
<script>document.querySelector('.theme-toggle').addEventListener('click',function(){var d=document.documentElement,t=d.getAttribute('data-theme')==='light'?'dark':'light';d.setAttribute('data-theme',t);document.querySelector('meta[name="color-scheme"]').content=t;try{localStorage.setItem('theme',t)}catch(e){}})</script>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
