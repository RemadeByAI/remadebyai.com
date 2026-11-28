// RemadeByAI click counter (Cloudflare Worker, one file, no dependencies).
// The site's site.js sends POST /click with {"app":"bitchat","kind":"download","page":"/apps/bitchat/"}
// (via navigator.sendBeacon, so it never slows the visitor down) when someone presses Download,
// Visit site, Source code or a featured button, plus where the visit came from (ref, landing, utm_*).
// Nothing that identifies the visitor is stored: no IP, no cookie.
//
// Counts live in the CLICKS KV namespace under two kinds of key:
//   total|<app>|<kind>          all-time count
//   day|<YYYY-MM-DD>|<app>|<kind>  count for that day (UTC), kept 400 days
//   log|<ISO time>|<id>          one per click since 2026-11-28, kept 90 days; empty value, the details in
//                                metadata: app, kind, page, ref (outside page the visit came from, no query),
//                                landing (first page of the visit), utm_source/medium/campaign
// Each click is 3 KV writes, so the free plan's 1,000 writes a day allow about 330 clicks a day.
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

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  // One log entry per click (2026-11-28) with where the visit came from, kept 90 days. The details sit in
  // the key's metadata, so the stats page reads them with list() alone (no extra reads).
  const text = (v, n) => String(v || '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
  const meta = { app, kind, page: text(data.page, 120), ref: text(data.ref, 200), landing: text(data.landing, 120) };
  if (meta.ref && !/^https?:\/\//.test(meta.ref)) meta.ref = '';
  for (const k of ['page', 'landing']) if (meta[k] && !meta[k].startsWith('/')) meta[k] = '';
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign']) if (data[k]) meta[k] = text(data[k], 60);
  const id = Math.random().toString(36).slice(2, 8);
  await Promise.all([
    bump(env, `total|${app}|${kind}`),
    bump(env, `day|${day}|${app}|${kind}`, 400 * 86400),
    env.CLICKS.put(`log|${now.toISOString()}|${id}`, '', { expirationTtl: 90 * 86400, metadata: meta }),
  ]);
  return new Response(null, { status: 204, headers: cors });
}

async function bump(env, key, ttl) {
  const now = Number(await env.CLICKS.get(key)) || 0;
  await env.CLICKS.put(key, String(now + 1), ttl ? { expirationTtl: ttl } : undefined);
}

async function listAll(env, prefix, withMeta) {
  const out = [];
  let cursor;
  do {
    const page = await env.CLICKS.list({ prefix, cursor });
    for (const k of page.keys) out.push(withMeta ? k : k.name);
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

  // Where clicks came from (log entries, from 2026-11-28 on), last 30 days.
  const log = (await listAll(env, 'log|', true))
    .map(k => ({ time: k.name.split('|')[1], ...(k.metadata || {}) }))
    .filter(e => e.time.slice(0, 10) >= since)
    .sort((a, b) => b.time.localeCompare(a.time));
  const host = ref => { try { return new URL(ref).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const group = (keyOf) => {
    const m = {};
    for (const e of log) {
      const k = keyOf(e);
      if (!k) continue;
      const g = m[k] || (m[k] = { name: k, clicks: 0, apps: {}, pages: {} });
      g.clicks++;
      g.apps[e.app] = (g.apps[e.app] || 0) + 1;
      if (e.ref) g.pages[e.ref] = (g.pages[e.ref] || 0) + 1;
    }
    return Object.values(m).sort((a, b) => b.clicks - a.clicks);
  };
  const referrers = group(e => host(e.ref) || '(direct or hidden)');
  const campaigns = group(e => [e.utm_source, e.utm_medium, e.utm_campaign].filter(Boolean).join(' / '));
  const landings = group(e => e.landing || '');
  if (url.searchParams.get('format') === 'json') return Response.json({ since, apps: list, referrers, campaigns, landings, recent: log.slice(0, 200) });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const top = (o, n, fmt) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${fmt(k)} <span class="g">${v}</span>`).join(', ');
  const appLink = a => `<a href="https://remadebyai.com/apps/${esc(a)}/">${esc(a)}</a>`;
  const extLink = (u, label) => u ? `<a href="${esc(u)}" rel="noreferrer noopener" target="_blank">${esc(label || u.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : '<span class="g">direct or hidden</span>';
  const siteLink = p => p ? `<a href="https://remadebyai.com${esc(p)}">${esc(p)}</a>` : '';
  const central = t => new Date(t).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const groupTable = (title, note, rows, label) => `<h2>${title}</h2><p class="g">${note}</p>` + (rows.length
    ? `<table class="d"><tr><th>${label}</th><th>Clicks</th><th>Apps clicked</th><th>Referring pages</th></tr>${rows.slice(0, 40).map(g => `<tr><td>${esc(g.name)}</td><td><b>${g.clicks}</b></td><td class="l">${top(g.apps, 5, appLink)}</td><td class="l">${top(g.pages, 3, u => extLink(u))}</td></tr>`).join('')}</table>`
    : '<p class="g">None yet.</p>');
  const details = () => `<p class="g">Referrer details are kept from Nov 28, 2026 on, for 90 days; the tables below cover the last 30 days. "Direct or hidden" means the browser sent no referrer (typed address, bookmark, an app, or a site that hides it).</p>`
    + groupTable('Top referrers', 'The outside site the visit started from, before the click.', referrers, 'From')
    + (campaigns.length ? groupTable('Campaigns (utm tags)', 'Visits that arrived on a link with utm_source / utm_medium / utm_campaign.', campaigns, 'Source / medium / campaign') : '')
    + groupTable('Landing pages', 'The first remadebyai.com page of the visit.', landings.map(g => ({ ...g, name: g.name })), 'Landed on')
    + `<h2>Recent clicks</h2><p class="g">Newest first, times in Central.</p>` + (log.length
      ? `<table class="d"><tr><th>When</th><th>App</th><th>Button</th><th>Clicked on</th><th>From</th><th>Landed on</th><th>utm</th></tr>${log.slice(0, 100).map(e => `<tr><td>${central(e.time)}</td><td>${appLink(e.app || '')}</td><td>${esc(e.kind || '')}</td><td class="l">${siteLink(e.page)}</td><td class="l">${extLink(e.ref)}</td><td class="l">${siteLink(e.landing)}</td><td class="l">${esc([e.utm_source, e.utm_medium, e.utm_campaign].filter(Boolean).join(' / '))}</td></tr>`).join('')}</table>`
      : '<p class="g">None yet.</p>');
  const cells = o => KINDS.map(k => `<td>${o[k] || ''}</td>`).join('') + `<td><b>${sum(o)}</b></td>`;
  const head = KINDS.map(k => `<th>${k}</th>`).join('') + '<th>all</th>';
  // Light/dark mode (2026-11-22): dark by default, the button top right switches, the choice is kept in
  // this page's localStorage "theme" (the same key and look as remadebyai.com's header button).
  const html = `<!doctype html><html lang="en" data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="dark"><meta name="darkreader-lock"><title>RemadeByAI clicks</title>
<script>(function(){var t='dark';try{if(localStorage.getItem('theme')==='light')t='light'}catch(e){}document.documentElement.setAttribute('data-theme',t);if(t==='light')document.querySelector('meta[name="color-scheme"]').content='light'})()</script>
<style>:root{--bg:#090d0b;--ink:#eff8ef;--muted:#acbcb0;--line:#28392d;--green:#c2ff94;--btn:#3b5141}[data-theme=light]{--bg:#f5f8f3;--ink:#142019;--muted:#4d5f52;--line:#d3dfd4;--green:#2f7a1c;--btn:#b9cbbd}
html{background:var(--bg)}body{font:15px system-ui;margin:24px;background:var(--bg);color:var(--ink)}table{border-collapse:collapse}th,td{padding:5px 10px;border-bottom:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}th{color:var(--green);font-weight:600}.g{color:var(--muted)}a{color:var(--green)}h2{margin-top:32px;font-size:18px}table.d th,table.d td{text-align:left}td.l{text-align:left;max-width:420px;overflow-wrap:anywhere}table{display:block;overflow-x:auto;max-width:100%}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.theme-toggle{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border:1px solid var(--btn);border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:14px}.theme-toggle:hover{border-color:var(--green);color:var(--green)}[data-theme=dark] .to-dark,[data-theme=light] .to-light{display:none}</style>
<div class="top"><h1>Outbound clicks</h1><button class="theme-toggle" type="button" aria-label="Switch to light or dark mode"><span class="to-light">\u2600\uFE0E Light mode</span><span class="to-dark">\u263E Dark mode</span></button></div>
<p class="g">Button clicks that leave remadebyai.com. Last 30 days from ${since} (UTC), and all time.</p>
<table><tr><th rowspan="2">App</th><th colspan="${KINDS.length + 1}">Last 30 days</th><th colspan="${KINDS.length + 1}">All time</th></tr><tr>${head}${head}</tr>
${list.map(r => `<tr><td><a href="https://remadebyai.com/apps/${esc(r.app)}/">${esc(r.app)}</a></td>${cells(r.last30)}${cells(r.total)}</tr>`).join('\n') || '<tr><td colspan="11" class="g">No clicks yet.</td></tr>'}
</table>
${details()}
<script>document.querySelector('.theme-toggle').addEventListener('click',function(){var d=document.documentElement,t=d.getAttribute('data-theme')==='light'?'dark':'light';d.setAttribute('data-theme',t);document.querySelector('meta[name="color-scheme"]').content=t;try{localStorage.setItem('theme',t)}catch(e){}})</script>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
