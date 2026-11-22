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
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>RemadeByAI clicks</title>
<style>body{font:15px system-ui;margin:24px;background:#090d0b;color:#eff8ef}table{border-collapse:collapse}th,td{padding:5px 10px;border-bottom:1px solid #28392d;text-align:right}th:first-child,td:first-child{text-align:left}th{color:#c2ff94;font-weight:600}.g{color:#acbcb0}a{color:#c2ff94}</style>
<h1>Outbound clicks</h1><p class="g">Button clicks that leave remadebyai.com. Last 30 days from ${since} (UTC), and all time.</p>
<table><tr><th rowspan="2">App</th><th colspan="${KINDS.length + 1}">Last 30 days</th><th colspan="${KINDS.length + 1}">All time</th></tr><tr>${head}${head}</tr>
${list.map(r => `<tr><td><a href="https://remadebyai.com/apps/${esc(r.app)}/">${esc(r.app)}</a></td>${cells(r.last30)}${cells(r.total)}</tr>`).join('\n') || '<tr><td colspan="11" class="g">No clicks yet.</td></tr>'}
</table>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
