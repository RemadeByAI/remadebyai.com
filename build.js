#!/usr/bin/env node
// Builds the static pages of remadebyai.com from projects.json.
// Run it from this folder after any change to projects.json, partials/, styles.css, site.js, directory.js or contact.js:
//   node build.js
// It needs only Node.js (18 or newer) and no packages. It checks projects.json first and stops with a
// clear message if an entry is wrong, then rewrites:
//   index.html (between the <!-- build:NAME --> markers only), apps/ (incl. the All apps list), categories/, new/,
//   about/ and list/ (from partials/), badge/, search.json, sitemap.xml
// Never edit the generated folders by hand; edit projects.json and run the build again.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SITE = 'https://remadebyai.com';
const NEW_ON_HOME = 6;
const GROUPS = { emukey: 'EmuKey app', open: 'Open source', indie: 'Independent' }; // indie = closed source, not by EmuKey
const PLATFORMS = ['Windows', 'macOS', 'Linux', 'Web', 'iOS', 'Android'];
const GENERATED_DIRS = ['apps', 'categories', 'new', 'about', 'list', 'badge', 'alternatives', 'platforms'];

// Analytics. Both are optional: leave a value empty and that part is left out of every page.
// - cloudflareToken: the Cloudflare Web Analytics site token for remadebyai.com (page views, visitors,
//   referrers). Found in Cloudflare > Analytics & Logs > Web Analytics > remadebyai.com > Manage site.
// - clicksEndpoint: the clicks Worker (clicks-worker/) that counts Download, Visit site and Source code
//   button clicks per app. Cloudflare Web Analytics can't count clicks on links that leave the site.
const ANALYTICS = {
  cloudflareToken: '0f5ef649282441df8c6138452124737d',
  clicksEndpoint: 'https://remadebyai-clicks.remadebyai.workers.dev/click',
};

// Filter values used by the home page filters and the search index.
const PRICES = ['Free', 'Freemium', 'Paid'];
const LICENCES = ['MIT', 'Apache-2.0', 'GPL-3.0', 'AGPL-3.0', 'Unlicense'];
const CLOSED = 'Closed source';
function priceTags(app) {
  const text = String(app.price || '');
  const tags = [];
  if (/freemium/i.test(text)) tags.push('Freemium');
  else if (/\bfree\b/i.test(text)) tags.push('Free');
  if (/\bpaid\b|\$|€|£|one-time|subscription/i.test(text)) tags.push('Paid');
  return tags;
}
function licenceTags(app) {
  const tags = LICENCES.filter(l => new RegExp(`(^|[^A-Za-z])${l.replace(/[.-]/g, '\\$&')}([^A-Za-z0-9]|$)`).test(app.license || ''));
  return tags.length ? tags : (app.source ? [] : [CLOSED]);
}

// ---------- helpers ----------
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = text => String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// Line endings are normalised so a Windows checkout (CRLF) gives the same hash as the repo (LF).
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
const paragraphs = text => String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  .map(p => `<p>${esc(p)}</p>`).join('\n');
const formatDate = iso => new Date(iso + 'T12:00:00Z')
  .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
// Links to other sites always open in a new tab, so a visitor never leaves remadebyai.com by accident.
// Applied to every page the build writes; links that already say where to open are left alone.
const externalInNewTab = html => html.replace(/<a\b([^>]*?)\bhref="(https?:\/\/[^"]*)"([^>]*)>/g, (tag, before, href, after) => {
  if (/^https?:\/\/(www\.)?remadebyai\.com(\/|$)/i.test(href) || /\btarget=/.test(before + after)) return tag;
  return `<a${before}href="${href}"${after} target="_blank" rel="noopener">`;
});
// Shortens text for a meta description (search engines show about 155 characters), cutting at a word.
function clip(text, max = 155) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,.;:–—-]+$/, '') + '…';
}
// Width and height of a local PNG, JPEG or WebP (no packages needed). Lets pages reserve space for
// screenshots, so the layout doesn't jump while they load. Returns null if the file can't be read.
const SIZE_CACHE = new Map();
function imageSize(src) {
  if (/^https?:/.test(src)) return null;
  if (SIZE_CACHE.has(src)) return SIZE_CACHE.get(src);
  let size = null;
  try {
    const b = fs.readFileSync(path.join(ROOT, src.replace(/^\//, '')));
    if (b.toString('ascii', 1, 4) === 'PNG') size = { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    else if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const kind = b.toString('ascii', 12, 16);
      if (kind === 'VP8X') size = { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      else if (kind === 'VP8L') { const n = b.readUInt32LE(21); size = { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }; }
      else if (kind === 'VP8 ') size = { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    } else if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length - 9;) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) { size = { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }; break; }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch { size = null; }
  SIZE_CACHE.set(src, size);
  return size;
}
// Small copy of a screenshot for the thumbnail grid: /assets/apps/x/1.webp -> /assets/apps/x/thumb/1.webp.
// Made by tools/make-thumbs.py; pages fall back to the full image when there's no thumbnail yet.
function thumbOf(src) {
  if (/^https?:/.test(src)) return null;
  const t = src.replace(/\/([^/]+)$/, '/thumb/$1');
  return fs.existsSync(path.join(ROOT, t.replace(/^\//, ''))) ? t : null;
}
const jsonLdTag = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
function write(file, content) {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, file.endsWith('.html') ? externalInNewTab(content) : content);
}

// ---------- load and check the data ----------
function load() {
  const data = JSON.parse(read('projects.json'));
  const problems = [];
  const slugs = new Set();
  const apps = data.projects.map((app, index) => {
    const where = `projects.json entry ${index + 1} (${app.name || 'no name'})`;
    for (const field of ['name', 'group', 'owner', 'alternative', 'description', 'category', 'url', 'added']) {
      if (!app[field]) problems.push(`${where}: "${field}" is missing.`);
    }
    if (app.group && !GROUPS[app.group]) problems.push(`${where}: "group" must be one of ${Object.keys(GROUPS).join(', ')}.`);
    if (app.added && !/^\d{4}-\d{2}-\d{2}$/.test(app.added)) problems.push(`${where}: "added" must look like 2026-11-21.`);
    for (const p of app.platforms || []) {
      if (!PLATFORMS.includes(p)) problems.push(`${where}: platform "${p}" should be one of ${PLATFORMS.join(', ')}.`);
    }
    for (const shot of app.screenshots || []) {
      if (!shot.src || !shot.alt) problems.push(`${where}: each screenshot needs "src" and "alt".`);
      else if (!/^https?:/.test(shot.src) && !fs.existsSync(path.join(ROOT, shot.src.replace(/^\//, '')))) {
        problems.push(`${where}: screenshot file ${shot.src} does not exist.`);
      }
    }
    if (app.review && (!app.review.date || !app.review.body)) problems.push(`${where}: a review needs "date" and "body".`);
    if (app.whatPeopleSay) {
      const w = app.whatPeopleSay;
      if (!w.checked || !/^\d{4}-\d{2}-\d{2}$/.test(w.checked)) problems.push(`${where}: whatPeopleSay needs "checked" like 2026-11-23.`);
      if (w.none) {
        if (w.summary || (w.sources || []).length) problems.push(`${where}: whatPeopleSay with "none": true can't also have a summary or sources.`);
      } else if (!w.summary) problems.push(`${where}: whatPeopleSay needs a "summary" (or "none": true when we found no coverage).`);
      for (const src of w.sources || []) {
        if (!src.url || !/^https?:\/\//.test(src.url) || !src.site) problems.push(`${where}: each whatPeopleSay source needs "site" and an http(s) "url".`);
        if (src.quote && src.quote.split(/\s+/).length > 40) problems.push(`${where}: keep whatPeopleSay quotes short (40 words max).`);
      }
    }
    const slug = app.slug || slugify(app.name || '');
    if (slugs.has(slug)) problems.push(`${where}: slug "${slug}" is used twice. Give one of them its own "slug".`);
    slugs.add(slug);
    return { ...app, slug, order: index, categorySlug: slugify(app.category || '') };
  });
  if (problems.length) {
    console.error('projects.json has problems, nothing was built:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
  return apps;
}

// Newest first; entries added on the same day keep the order of the file, later ones first.
const byNewest = (a, b) => b.added.localeCompare(a.added) || b.order - a.order;
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

// ---------- shared pieces ----------
let ASSET_VERSION = {};
// The site-wide link preview picture, used when a page has no screenshot of its own.
const OG_DEFAULT = { src: '/assets/og-image.png', w: 1200, h: 630, alt: 'RemadeByAI logo with the tagline Familiar software. Rebuilt with AI.' };
// image: { src, w, h, alt } for the link preview (an app's first screenshot); noindex: keep the page out of search results.
function head({ title, description, canonical, ogType = 'website', scripts = '', image = OG_DEFAULT, noindex = false, jsonLd = [] }) {
  const desc = clip(description);
  const img = /^https?:/.test(image.src) ? image.src : SITE + image.src;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#090d0b">
  <meta name="color-scheme" content="dark">
  <meta name="darkreader-lock">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
${noindex ? '  <meta name="robots" content="noindex">\n' : ''}${canonical ? `  <link rel="canonical" href="${SITE}${canonical}">\n` : ''}  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="RemadeByAI">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
${canonical ? `  <meta property="og:url" content="${SITE}${canonical}">\n` : ''}  <meta property="og:image" content="${esc(img)}">
${image.w && image.h ? `  <meta property="og:image:width" content="${image.w}">\n  <meta property="og:image:height" content="${image.h}">\n` : ''}  <meta property="og:image:alt" content="${esc(image.alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(img)}">
  <meta name="twitter:image:alt" content="${esc(image.alt)}">
${siteAssets()}${scripts}${jsonLd.map(d => '\n  ' + jsonLdTag(d)).join('')}
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
${header()}
<main id="main">`;
}
// Stylesheet, the site-wide search script and the analytics beacon, shared by every page.
function siteAssets() {
  const lines = [
    // Light/dark mode: runs before the page paints. Dark unless the visitor chose light (key shared with InCloseMail and DesktopWiki).
    `  <script>(function(){var t='dark';try{if(localStorage.getItem('theme')==='light')t='light'}catch(e){}var d=document.documentElement;d.setAttribute('data-theme',t);if(t==='light'){var m=document.querySelector('meta[name="color-scheme"]');if(m)m.content='light';m=document.querySelector('meta[name="theme-color"]');if(m)m.content='#f5f8f3'}})();</script>`,
    `  <link rel="stylesheet" href="/styles.css?v=${ASSET_VERSION.css}">`,
    `  <script src="/site.js?v=${ASSET_VERSION.site}" defer></script>`,
    `  <link rel="alternate" type="application/rss+xml" title="RemadeByAI: new apps" href="${SITE}/feed.xml">`,
  ];
  if (ANALYTICS.cloudflareToken) {
    lines.push(`  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: ANALYTICS.cloudflareToken })}'></script>`);
  }
  return lines.join('\n');
}
function header() {
  return `<header>
  <div class="wrap nav">
    <a class="brand" href="/"><img src="/assets/mark.svg" alt="" width="35" height="35"><span>RemadeBy<em>AI</em><small>.com</small></span></a>
    <nav aria-label="Main navigation"><a href="/categories/">Categories</a><a href="/new/">New</a><a href="/apps/">All apps</a><a href="/about/">About</a><a href="/list/">List your app</a></nav>
    <form class="site-search" action="/apps/" method="get" role="search"${ANALYTICS.clicksEndpoint ? ` data-clicks="${esc(ANALYTICS.clicksEndpoint)}"` : ''}>
      <label><span class="visually-hidden">Search all apps</span><input type="search" name="q" placeholder="Search apps, e.g. Photoshop" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="site-search-results" aria-expanded="false"></label>
      <ul class="site-search-results" id="site-search-results" role="listbox" aria-label="Matching apps" hidden></ul>
    </form>
    <button class="theme-toggle" type="button" aria-label="Switch to light mode"><span class="to-light"><span class="icon" aria-hidden="true">☀\uFE0E</span><span class="label">Light mode</span></span><span class="to-dark"><span class="icon" aria-hidden="true">☾</span><span class="label">Dark mode</span></span></button>
  </div>
</header>`;
}
const footer = () => `<footer>
  <div class="wrap foot">
    <div class="foot-about"><a class="brand" href="/">RemadeBy<em>AI</em></a><p>Familiar software, rebuilt with AI. <em class="foot-note">(A software directory from <a href="https://emukey.com/">EmuKey LLC</a>.)</em></p></div>
    <nav class="foot-links" aria-label="Footer"><a href="/apps/">All apps</a><a href="/new/">New arrivals</a><a href="/categories/">Categories</a><a href="/alternatives/">Alternatives</a><a href="/platforms/">Platforms</a><a href="/about/">About</a><a href="/list/">List your app</a><a href="/feed.xml">RSS feed</a></nav>
  </div>
</footer>`;
const foot = `</main>
${footer()}
</body>
</html>
`;

function tile(app) {
  return `<span class="${['tile', app.tile].filter(Boolean).join(' ')}" aria-hidden="true">${esc(app.icon || '✦')}</span>`;
}
function externalLabel(app) {
  return app.linkText || (/github\.com/.test(app.url) ? 'GitHub' : 'Visit site');
}

// One card. data-* attributes feed the search and filters in directory.js.
function card(app, level = 3) {
  const search = [app.name, app.alternative, app.description, app.category, app.owner, app.maker, ...(app.platforms || []), app.license, app.price, ...(app.keywords || [])]
    .filter(Boolean).join(' ').toLowerCase();
  const list = values => esc(values.join('|'));
  return `<article class="card" data-group="${esc(app.group)}" data-category="${esc(app.categorySlug)}" data-platform="${list(app.platforms || [])}" data-price="${list(priceTags(app))}" data-licence="${list(licenceTags(app))}" data-search="${esc(search)}">
  <div class="card-top">${tile(app)}<small>${esc(app.owner)}</small></div>
  <h${level} class="card-title"><a class="card-link" href="/apps/${app.slug}/">${esc(app.name)}</a></h${level}>
  <p class="alternative">${esc(app.alternative)}</p>
  <p>${esc(app.description)}</p>
  <div class="card-bottom"><a class="card-category" href="/categories/${app.categorySlug}/">${esc(app.category)}</a><span class="card-more" aria-hidden="true">Details →</span></div>
</article>`;
}
// level: the heading level of each card's name (2 on pages where the cards sit right under the h1).
const cardGrid = (apps, level = 3) => `<div class="cards">\n${apps.map(a => card(a, level)).join('\n')}\n</div>`;

function categoriesOf(apps) {
  const map = new Map();
  for (const app of apps) {
    if (!map.has(app.categorySlug)) map.set(app.categorySlug, { name: app.category, slug: app.categorySlug, apps: [] });
    map.get(app.categorySlug).apps.push(app);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function categoryChips(categories) {
  return `<ul class="category-list">\n${categories.map(c =>
    `  <li><a href="/categories/${c.slug}/"><span>${esc(c.name)}</span><small>${c.apps.length}</small></a></li>`).join('\n')}\n</ul>`;
}
// Home page tiles: the category, how many apps it has and the first few by name.
function categoryTiles(categories) {
  return `<ul class="category-tiles">\n${categories.map(c => {
    const names = [...c.apps].sort(byName).map(a => a.name);
    const sample = names.slice(0, 3).join(', ') + (names.length > 3 ? ' and more' : '');
    return `  <li><a href="/categories/${c.slug}/">${tile(c.apps[0])}<span class="cat-name">${esc(c.name)}</span><small>${c.apps.length} ${c.apps.length === 1 ? 'app' : 'apps'}</small><span class="cat-sample">${esc(sample)}</span></a></li>`;
  }).join('\n')}\n</ul>`;
}

// ---------- pages ----------
// Google's app types for SoftwareApplication "applicationCategory"; our category name stays in applicationSubCategory.
const APP_CATEGORY = {
  Email: 'CommunicationApplication', Messaging: 'CommunicationApplication', Documentation: 'BusinessApplication',
  'Screen capture': 'MultimediaApplication', 'Developer tools': 'DeveloperApplication', Productivity: 'BusinessApplication',
  Business: 'BusinessApplication', Graphics: 'DesignApplication', Office: 'BusinessApplication', Home: 'HomeApplication',
  Video: 'MultimediaApplication', Utilities: 'UtilitiesApplication', '3D and CAD': 'DesignApplication', TV: 'EntertainmentApplication',
  Reading: 'ReferenceApplication', Audio: 'MultimediaApplication', 'Health and fitness': 'HealthApplication',
  'Maps and GIS': 'TravelApplication', Networking: 'UtilitiesApplication', Games: 'GameApplication', 'Media server': 'MultimediaApplication',
  Family: 'LifestyleApplication', Translation: 'ReferenceApplication', 'File sharing': 'UtilitiesApplication', Backup: 'UtilitiesApplication',
  '3D printing': 'DesignApplication', 'Science and space': 'EducationalApplication', Finance: 'FinanceApplication', Passwords: 'SecurityApplication',
};
// Price for structured data, only when we know it: free apps cost 0, and an exact price stated in "price" is used.
function appOffers(app) {
  const tags = priceTags(app);
  if (tags.length === 1 && tags[0] === 'Free') return { '@type': 'Offer', price: '0', priceCurrency: 'USD' };
  const m = /\$(\d+(?:\.\d{2})?)/.exec(app.price || '');
  if (m && !tags.includes('Free') && !tags.includes('Freemium')) return { '@type': 'Offer', price: m[1], priceCurrency: 'USD' };
  return null;
}
const breadcrumbs = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + url })),
});
// One screenshot: a small thumbnail (when tools/make-thumbs.py made one) linking to the full picture,
// with its size set so the page doesn't jump while it loads.
function shotFigure(s) {
  const thumb = thumbOf(s.src);
  const size = imageSize(thumb || s.src);
  const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
  return `<figure><a href="${esc(s.src)}"><img src="${esc(thumb || s.src)}" alt="${esc(s.alt)}"${dims} loading="lazy" decoding="async"></a>${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ''}</figure>`;
}
function appPage(app, all) {
  const facts = [
    ['Category', `<a href="/categories/${app.categorySlug}/">${esc(app.category)}</a>`],
    // Games say "Inspired by X" instead of "Alternative to X"; the facts row follows suit.
    [/^Inspired by\s/i.test(app.alternative) ? 'Inspired by' : 'Replaces', esc(app.alternative.replace(/^(Alternative to|Inspired by)\s*/i, ''))],
    ['Platforms', esc((app.platforms || []).join(', '))],
    ['Licence', esc(app.license)],
    ['Price', esc(app.price)],
    ['Made by', esc(app.maker || (app.group === 'emukey' ? app.owner : ''))],
    ['Source code', app.source ? `<a href="${esc(app.source)}" data-track="source" data-app="${app.slug}">${esc(app.source.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : ''],
    ['Listed', esc(formatDate(app.added))],
    ['See also', (app.topics || []).map(t => `<a href="/alternatives/${t.slug}/">Alternatives to ${esc(t.name)}</a>`).join(', ')],
  ].filter(([, value]) => value);

  const actions = [];
  const track = kind => ` data-track="${kind}" data-app="${app.slug}"`;
  if (app.download) actions.push(`<a class="button primary" href="${esc(app.download)}"${track('download')}>Download</a>`);
  actions.push(`<a class="button${app.download ? '' : ' primary'}" href="${esc(app.url)}"${track('site')}>${esc(externalLabel(app))}</a>`);

  const shots = (app.screenshots || []).length ? `
  <section class="app-section" aria-labelledby="shots-title">
    <h2 id="shots-title">Screenshots</h2>
    <div class="shots">${app.screenshots.map(shotFigure).join('')}</div>
  </section>` : '';

  const built = app.builtWithAI
    ? paragraphs(app.builtWithAI)
    : `<p class="muted">We haven't confirmed how ${esc(app.name)} was built yet. If you made it, <a href="/list/">tell us how AI was part of it</a>.</p>`;

  const review = app.review ? `
    <div class="review">
      ${app.review.verdict ? `<p class="review-verdict">${esc(app.review.verdict)}</p>` : ''}
      ${paragraphs(app.review.body)}
      <p class="review-meta">Reviewed ${esc(formatDate(app.review.date))}${app.review.version ? ` · version ${esc(app.review.version)}` : ''}${app.review.author ? ` · by ${esc(app.review.author)}` : ''}</p>
    </div>` : `<p class="muted">We haven't reviewed ${esc(app.name)} yet.</p>`;

  const buzz = whatPeopleSay(app);

  const related = all.filter(a => a.categorySlug === app.categorySlug && a.slug !== app.slug).sort(byNewest).slice(0, 3);
  const relatedHtml = related.length ? `
  <section class="app-section" aria-labelledby="related-title">
    <h2 id="related-title">More in ${esc(app.category)}</h2>
    ${cardGrid(related)}
  </section>` : '';

  // Titles: "Name: Alternative to X | RemadeByAI", dropping the site name when it would get cut off in search results.
  const fullTitle = `${app.name}: ${app.alternative} | RemadeByAI`;
  const title = fullTitle.length <= 65 ? fullTitle : `${app.name}: ${app.alternative}`;
  const page = `${SITE}/apps/${app.slug}/`;
  const shotsAbs = (app.screenshots || []).map(s => /^https?:/.test(s.src) ? s.src : SITE + s.src);
  const firstLocal = (app.screenshots || []).find(s => imageSize(s.src));
  const preview = firstLocal ? { src: firstLocal.src, ...imageSize(firstLocal.src), alt: firstLocal.alt } : OG_DEFAULT;
  const offers = appOffers(app);
  const software = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': `${page}#app`, name: app.name,
    description: app.description, applicationCategory: APP_CATEGORY[app.category] || 'UtilitiesApplication',
    applicationSubCategory: app.category, url: app.url, mainEntityOfPage: page,
    ...(app.platforms ? { operatingSystem: app.platforms.join(', ') } : {}),
    ...(app.license ? { license: app.license } : {}),
    ...(app.download ? { downloadUrl: app.download } : {}),
    ...(shotsAbs.length ? { screenshot: shotsAbs, image: shotsAbs[0] } : {}),
    ...(offers ? { offers } : {}),
    ...(app.maker || app.group === 'emukey' ? { author: { '@type': 'Organization', name: app.maker || app.owner } } : {}),
    // Our own editorial review, when there is one. Never for EmuKey's own apps (that would be self-review),
    // and never built from the third-party quotes under "What people say".
    ...(app.review && app.group !== 'emukey' ? { review: { '@type': 'Review', datePublished: app.review.date,
      reviewBody: app.review.body, author: { '@type': 'Organization', name: app.review.author || 'RemadeByAI' } } } : {}),
  };
  const crumbs = breadcrumbs([['Home', '/'], [app.category, `/categories/${app.categorySlug}/`], [app.name, `/apps/${app.slug}/`]]);
  return `${head({ title, description: `${app.name}, ${app.alternative.charAt(0).toLowerCase()}${app.alternative.slice(1)}. ${app.description}`,
    canonical: `/apps/${app.slug}/`, image: preview, jsonLd: [software, crumbs] })}
<div class="wrap app-page">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/categories/${app.categorySlug}/">${esc(app.category)}</a> / <span>${esc(app.name)}</span></nav>
  <section class="app-hero" aria-labelledby="app-title">
    <div>
      <div class="app-title-row">${tile(app)}<small class="owner">${esc(GROUPS[app.group])}</small></div>
      <h1 id="app-title">${esc(app.name)}</h1>
      <p class="lede">${esc(app.alternative)}</p>
      <p class="app-summary">${esc(app.description)}</p>
      <div class="app-actions">${actions.join('')}</div>
    </div>
    <dl class="facts">
${facts.map(([k, v]) => `      <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
    </dl>
  </section>
  ${app.longDescription ? `<section class="app-section" aria-labelledby="about-app-title"><h2 id="about-app-title">About ${esc(app.name)}</h2><div class="prose">${paragraphs(app.longDescription)}</div></section>` : ''}
  ${shots}
  <section class="app-section" aria-labelledby="built-title">
    <h2 id="built-title">How it was built with AI</h2>
    <div class="prose">${built}</div>
  </section>
  ${buzz}
  <section class="app-section" aria-labelledby="review-title">
    <h2 id="review-title">Our review</h2>
    ${review}
  </section>
  ${relatedHtml}
  ${badgeBox(app)}
</div>
${foot}`;
}

// ---------- "What people say" (compiled from public discussion) ----------
// Our own summary of what others say about an app, with short attributed quotes and links to the
// full threads/reviews. Never paste whole reviews. Apps without a whatPeopleSay entry show nothing;
// { checked, none: true } means we looked and found no real outside coverage, and shows one short line.
function whatPeopleSay(app) {
  const w = app.whatPeopleSay;
  if (!w) return '';
  if (w.none) return `
  <section class="app-section" aria-labelledby="buzz-title">
    <h2 id="buzz-title">What people say</h2>
    <p class="muted">No outside reviews of ${esc(app.name)} yet. We last checked ${esc(formatDate(w.checked))}.</p>
  </section>`;
  const list = (title, items, cls) => items && items.length
    ? `<div class="buzz-col ${cls}"><h3>${title}</h3><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '';
  const sources = (w.sources || []).map(src => {
    const by = [src.who ? esc(src.who) : '', esc(src.site)].filter(Boolean).join(' on ');
    const extra = [src.date ? esc(formatMonth(src.date)) : '', src.points ? esc(src.points) : ''].filter(Boolean).join(' · ');
    return `<li class="buzz-source">
        ${src.quote ? `<blockquote>&ldquo;${esc(src.quote)}&rdquo;</blockquote>` : ''}
        <p><a href="${esc(src.url)}">${esc(src.title || src.site)}</a> <span class="buzz-by">${by}${extra ? ` · ${extra}` : ''}</span></p>
      </li>`;
  }).join('');
  const n = (w.sources || []).length;
  return `
  <section class="app-section" aria-labelledby="buzz-title">
    <h2 id="buzz-title">What people say</h2>
    <div class="buzz">
      <div class="prose">${paragraphs(w.summary)}</div>
      ${(w.praise || []).length || (w.complaints || []).length ? `<div class="buzz-cols">${list('People like', w.praise, 'good')}${list('Common complaints', w.complaints, 'bad')}</div>` : ''}
      ${n ? `<h3 class="buzz-sources-title">Where people said it</h3><ul class="buzz-sources">${sources}</ul>` : ''}
      <p class="review-meta">Compiled by RemadeByAI from ${n ? `${n} public source${n === 1 ? '' : 's'}` : 'public discussion'}, checked ${esc(formatDate(w.checked))}. Quotes are short excerpts; follow the links for the full context.</p>
    </div>
  </section>`;
}

function formatMonth(d) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return formatDate(d);
  const m = /^(\d{4})-(\d{2})$/.exec(d);
  if (!m) return d;
  return new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ---------- "Listed on RemadeByAI" badge ----------
// Makers can put a small badge in their README that links to their app page. The two SVGs are hand-made
// files in assets/badge/ (dark and light). badgeSnippets() gives the copy-paste code for one app page.
const BADGE = { dark: `${SITE}/assets/badge/listed-dark.svg`, light: `${SITE}/assets/badge/listed-light.svg`, alt: 'Listed on RemadeByAI' };
function badgeSnippets(slug) {
  const page = `${SITE}/apps/${slug}/`;
  return {
    dark: `[![${BADGE.alt}](${BADGE.dark})](${page})`,
    light: `[![${BADGE.alt}](${BADGE.light})](${page})`,
    auto: `<a href="${page}"><picture><source media="(prefers-color-scheme: light)" srcset="${BADGE.light}"><img alt="${BADGE.alt}" src="${BADGE.dark}" height="28"></picture></a>`,
  };
}
const snippetBox = (label, code, attrs = '') =>
  `<div class="snippet"><div class="snippet-head"><span>${label}</span><button class="copy" type="button" data-copy>Copy</button></div><pre><code${attrs}>${esc(code)}</code></pre></div>`;
function badgeBox(app) {
  const s = badgeSnippets(app.slug);
  return `
  <details class="badge-box">
    <summary>Made ${esc(app.name)}? Add a “Listed on RemadeByAI” badge to your README</summary>
    <div class="badge-body">
      <p class="badge-previews"><img src="/assets/badge/listed-dark.svg" alt="${BADGE.alt} (dark)" width="172" height="28"> <img src="/assets/badge/listed-light.svg" alt="${BADGE.alt} (light)" width="172" height="28"></p>
      ${snippetBox('Markdown, dark badge', s.dark)}
      ${snippetBox('Markdown, light badge', s.light)}
      <p class="muted">Want it to follow the reader's light or dark mode on GitHub? See <a href="/badge/?app=${app.slug}">the badge page</a>.</p>
    </div>
  </details>`;
}
function badgePage(apps) {
  const sorted = [...apps].sort(byName);
  const first = sorted[0];
  const s = badgeSnippets(first.slug);
  return `${head({ title: 'Listed on RemadeByAI badge | RemadeByAI', description: 'A small badge for the README of any app listed on RemadeByAI, linking back to its page.', canonical: '/badge/' })}
<div class="wrap list-page badge-page">
  <p class="section-label">✦ Badge</p>
  <h1 class="page-title">Listed on RemadeByAI</h1>
  <p class="page-intro">If your app is listed here, you're welcome to show it. Add this small badge to your README or website. It links to your app's page on RemadeByAI. Using it is optional and free.</p>
  <div class="badge-samples">
    <figure><img src="/assets/badge/listed-dark.svg" alt="${BADGE.alt} (dark)" width="172" height="28"><figcaption>Dark</figcaption></figure>
    <figure class="light-sample"><img src="/assets/badge/listed-light.svg" alt="${BADGE.alt} (light)" width="172" height="28"><figcaption>Light</figcaption></figure>
  </div>
  <section class="app-section" aria-labelledby="badge-code-title">
    <h2 id="badge-code-title">Get the code</h2>
    <label class="select badge-pick"><span>Your app</span><select id="badge-app" data-site="${SITE}">
${sorted.map(a => `      <option value="${a.slug}"${a === first ? ' selected' : ''}>${esc(a.name)}</option>`).join('\n')}
    </select></label>
    ${snippetBox('Markdown, dark badge (for most READMEs)', s.dark, ' data-badge="dark"')}
    ${snippetBox('Markdown, light badge', s.light, ' data-badge="light"')}
    ${snippetBox('HTML that follows GitHub light/dark mode', s.auto, ' data-badge="auto"')}
    <p class="muted">Every app page also has its own code under “Add a badge to your README”. Not listed yet? <a href="/list/">List your app</a>.</p>
  </section>
  <section class="app-section" aria-labelledby="badge-rules-title">
    <h2 id="badge-rules-title">A few notes</h2>
    <div class="prose">
      <p>Link the badge to your own app's page, so readers land on your listing. The images are served from remadebyai.com at <code>/assets/badge/listed-dark.svg</code> and <code>/assets/badge/listed-light.svg</code>; please don't change their colours or wording.</p>
      <p>The badge means your app is listed in the RemadeByAI directory. It isn't a review, a rating or an endorsement.</p>
    </div>
  </section>
</div>
<script>
// Swap the app in the snippets when another one is picked (?app=slug preselects it).
(function () {
  var pick = document.getElementById('badge-app'); if (!pick) return;
  var site = pick.dataset.site, first = ${JSON.stringify(first.slug)};
  var wanted = new URLSearchParams(location.search).get('app');
  if (wanted && pick.querySelector('option[value="' + CSS.escape(wanted) + '"]')) pick.value = wanted;
  function update() {
    document.querySelectorAll('code[data-badge]').forEach(function (c) {
      c.textContent = c.textContent.split('/apps/' + (c.dataset.slug || first) + '/').join('/apps/' + pick.value + '/');
      c.dataset.slug = pick.value;
    });
  }
  pick.addEventListener('change', update); update();
})();
</script>
${foot}`;
}

// Search-friendly title for a category page: "AI-built graphics apps", "AI-built games", "AI-built developer tools".
function categoryTitle(c) {
  const lower = c.name.split(' ').map(w => w === w.toUpperCase() ? w : w.toLowerCase()).join(' ');
  return `AI-built ${c.name === 'Games' ? 'games' : /tools$/i.test(c.name) ? lower : `${lower} apps`}`;
}
// Unique search-result text for a category page: how many apps, a few names and what they replace.
function categoryDescription(c) {
  const sorted = [...c.apps].sort(byNewest);
  const names = sorted.slice(0, 3).map(a => a.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  const games = c.name === 'Games';
  const n = c.apps.length;
  const lower = c.name.split(' ').map(w => w === w.toUpperCase() ? w : w.toLowerCase()).join(' '); // keeps TV, CAD, GIS
  const noun = games ? 'games' : /tools$/i.test(c.name) ? lower : `${lower} ${n === 1 ? 'app' : 'apps'}`;
  const base = `${n} ${noun} built with AI, listed on RemadeByAI${n > 1 ? `, including ${list}` : `: ${list}`}.`;
  // Add what they replace, as many as fit in a search result.
  const replaces = [...new Set(sorted.map(a => a.alternative.replace(/^(Alternative to|Inspired by)\s*/i, '').split(/,| and | or /)[0].trim()))];
  for (let k = Math.min(3, replaces.length); k > 0; k--) {
    const some = replaces.slice(0, k);
    const named = replaces.length > k ? `${some.join(', ')} and more` : some.length > 1 ? `${some.slice(0, -1).join(', ')} and ${some[k - 1]}` : some[0];
    const text = `${base} ${games ? 'Inspired by' : 'Alternatives to'} ${named}.`;
    if (text.length <= 155) return text;
  }
  return base;
}
const itemList = (name, apps) => ({
  '@context': 'https://schema.org', '@type': 'ItemList', name, numberOfItems: apps.length,
  itemListElement: apps.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/apps/${a.slug}/`, name: a.name })),
});
// Home page: who runs the site, and the site search (Google can use it for a search box).
function siteJsonLd() {
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'EmuKey LLC', url: 'https://emukey.com/', logo: `${SITE}/assets/icon-512.png` },
    { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'RemadeByAI', url: `${SITE}/`, publisher: { '@id': `${SITE}/#org` },
      description: 'A directory of practical software built with AI: familiar tools rebuilt around how people actually work.',
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/apps/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
  ] };
}
// GitHub Pages serves 404.html for any missing address. Kept out of search results; links use the site root.
function notFoundPage(newest) {
  return `${head({ title: 'Page not found | RemadeByAI', description: 'That page is not on RemadeByAI. Search the directory or browse by category.', canonical: '', noindex: true })}
<div class="wrap list-page">
  <p class="section-label">✦ 404</p>
  <h1 class="page-title">Page not found</h1>
  <p class="page-intro">That address isn't on RemadeByAI. It may have moved. Try the search box above, see <a href="/apps/">all apps</a> or <a href="/categories/">browse by category</a>.</p>
  <h2 class="visually-hidden">Newest apps</h2>
  ${cardGrid(newest.slice(0, NEW_ON_HOME))}
</div>
${foot}`;
}

function listPage({ canonical, title, description, label, heading, intro, apps, extra = '', jsonLd = [] }) {
  return `${head({ title, description, canonical, jsonLd })}
<div class="wrap list-page">
  <p class="section-label">✦ ${esc(label)}</p>
  <h1 class="page-title">${heading}</h1>
  <p class="page-intro">${intro}</p>
  ${extra}
  ${cardGrid(apps, 2)}
</div>
${foot}`;
}

// ---------- landing pages for search ("alternatives to X" and "by platform") ----------
// Each topic gathers the listings whose "alternative" matches. A topic only gets a page when at least
// MIN_TOPIC_APPS real listings fit, so there are no thin pages; the build says which topics it skipped.
const MIN_TOPIC_APPS = 3;
const ALTERNATIVE_TOPICS = [
  { slug: 'adobe', name: 'Adobe apps', match: /\bAdobe\b|Photoshop|Lightroom|Illustrator|InDesign|Premiere|After Effects|Acrobat/,
    intro: 'Photoshop, Lightroom, Premiere Pro, Acrobat and the rest of Creative Cloud, rebuilt with AI. Most of these are free or open source, and none need an Adobe subscription.' },
  { slug: 'lightroom', name: 'Adobe Lightroom', match: /Lightroom/,
    intro: 'Photo organising and raw editing without the Lightroom subscription. Some run on your own computer, others work with a self-hosted photo library.' },
  { slug: 'microsoft-office', name: 'Microsoft Office', match: /Microsoft (Outlook|Word|Excel|PowerPoint|Office|Lens)|Excel/,
    intro: 'Replacements for Word, Excel, PowerPoint and Outlook, built with AI. Open your documents, spreadsheets and email without a Microsoft 365 plan.' },
  { slug: 'google-apps', name: 'Google apps', match: /Google/,
    intro: 'Alternatives to Google Docs, Calendar, Contacts, Workspace, Lens and the Google TV home screen, for people who want to rely less on Google.' },
  { slug: 'obsidian-notion', name: 'Obsidian, Notion and Confluence', match: /Obsidian|Notion|Typora|Confluence/,
    intro: 'Notes, wikis and knowledge bases in the spirit of Obsidian, Notion, Confluence and Typora, for one person or a whole team. Most keep your notes as files you own.' },
  { slug: 'figma', name: 'Figma and Illustrator', match: /Figma|Illustrator|Excalidraw|Miro/,
    intro: 'Design, vector drawing and whiteboard tools built with AI, as alternatives to Figma, Illustrator, Excalidraw+ and Miro.' },
  { slug: 'wispr-flow', name: 'Wispr Flow, Otter.ai and Granola', match: /Wispr|MacWhisper|Otter|Granola/,
    intro: 'Dictation, transcription and meeting-notes apps. Several run speech recognition on your own computer, so your recordings stay private.' },
  { slug: 'sonarr-radarr', name: 'Sonarr, Radarr and Overseerr', match: /Sonarr|Radarr|Overseerr/,
    intro: 'One app in place of the separate *arr tools for your home media server: requests, TV, movies and downloads in a single place.' },
  { slug: 'bartender', name: 'Bartender and the macOS Dock', match: /Bartender|uBar|macOS Dock/,
    intro: 'Mac menu bar and Dock tools built with AI: hide menu bar clutter, or swap the Dock for a taskbar.' },
];
const PLATFORM_PAGES = {
  Windows: { slug: 'windows', heading: 'AI-built apps for Windows' },
  macOS: { slug: 'macos', heading: 'AI-built apps for Mac' },
  Linux: { slug: 'linux', heading: 'AI-built apps for Linux' },
  Web: { slug: 'web', heading: 'AI-built web apps', note: 'They run in your browser, so there is nothing to install.' },
  iOS: { slug: 'ios', heading: 'AI-built apps for iPhone and iPad' },
  Android: { slug: 'android', heading: 'AI-built apps for Android' },
};
function alternativeTopics(apps) {
  const topics = [];
  for (const t of ALTERNATIVE_TOPICS) {
    const list = apps.filter(a => t.match.test(a.alternative)).sort(byName);
    if (list.length >= MIN_TOPIC_APPS) topics.push({ ...t, apps: list });
    else console.log(`Skipped "alternatives to ${t.name}": only ${list.length} listing(s), needs ${MIN_TOPIC_APPS}.`);
  }
  return topics;
}
function platformGroups(apps) {
  return PLATFORMS.map(p => ({ platform: p, ...PLATFORM_PAGES[p], apps: apps.filter(a => (a.platforms || []).includes(p)).sort(byName) }))
    .filter(g => g.apps.length >= MIN_TOPIC_APPS);
}
// "Page | RemadeByAI", dropping the site name when it would get cut off in search results (same rule as app pages).
const siteTitle = text => `${text} | RemadeByAI`.length <= 65 ? `${text} | RemadeByAI` : text;
// "A, B and C" from a list of names.
const andList = names => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '';
function topicPage(t) {
  const n = t.apps.length;
  const sample = andList([...t.apps].sort(byNewest).slice(0, 3).map(a => a.name));
  return listPage({
    canonical: `/alternatives/${t.slug}/`, title: siteTitle(`${n} AI-built alternatives to ${t.name}`),
    description: `${n} alternatives to ${t.name} built with AI, including ${sample}. ${t.intro}`,
    jsonLd: [itemList(`AI-built alternatives to ${t.name}`, t.apps), breadcrumbs([['Home', '/'], ['Alternatives', '/alternatives/'], [t.name, `/alternatives/${t.slug}/`]])],
    label: 'Alternatives', heading: `AI-built alternatives to ${esc(t.name)}`,
    intro: `${esc(t.intro)} ${n} apps. <a href="/alternatives/">More alternatives</a>`,
    apps: t.apps,
  });
}
function platformPage(g) {
  const n = g.apps.length;
  const games = g.apps.filter(a => a.category === 'Games').length;
  const plural = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  const counts = games ? `${plural(n - games, 'app')} and ${plural(games, 'game')}` : plural(n, 'app');
  const where = g.platform === 'Web' ? 'for the web' : `for ${g.platform}`;
  const sample = andList([...g.apps].sort(byNewest).filter(a => a.category !== 'Games').slice(0, 3).map(a => a.name));
  return listPage({
    canonical: `/platforms/${g.slug}/`, title: `${g.heading} | RemadeByAI`,
    description: `${counts} ${where} built with AI, including ${sample}. Alternatives to familiar software, listed on RemadeByAI.`,
    jsonLd: [itemList(g.heading, g.apps), breadcrumbs([['Home', '/'], ['Platforms', '/platforms/'], [g.platform, `/platforms/${g.slug}/`]])],
    label: 'Platform', heading: esc(g.heading),
    intro: `${counts} that run ${g.platform === 'Web' ? 'in a web browser' : `on ${esc(g.platform)}`}.${g.note ? ' ' + esc(g.note) : ''} <a href="/apps/?platform=${encodeURIComponent(g.platform)}">Filter them further</a> or see <a href="/platforms/">other platforms</a>.`,
    apps: g.apps,
  });
}
// Chip lists for the hubs, the categories page and the home page.
const topicChips = topics => `<ul class="category-list">\n${topics.map(t =>
  `  <li><a href="/alternatives/${t.slug}/"><span>${esc(t.name)}</span><small>${t.apps.length}</small></a></li>`).join('\n')}\n</ul>`;
const platformChips = groups => `<ul class="category-list">\n${groups.map(g =>
  `  <li><a href="/platforms/${g.slug}/"><span>${esc(g.platform)}</span><small>${g.apps.length}</small></a></li>`).join('\n')}\n</ul>`;
function hubPage({ canonical, title, description, label, heading, intro, chips }) {
  return `${head({ title, description, canonical })}
<div class="wrap list-page">
  <p class="section-label">✦ ${esc(label)}</p>
  <h1 class="page-title">${heading}</h1>
  <p class="page-intro">${intro}</p>
  ${chips}
</div>
${foot}`;
}

// ---------- RSS feed of the newest listings ----------
const FEED_ITEMS = 50;
const xmlEsc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function rssFeed(newest) {
  // Only the day is known; entries listed the same day get minutes apart in file order so readers keep the order.
  const perDay = {};
  const items = newest.slice(0, FEED_ITEMS).map(a => {
    perDay[a.added] = (perDay[a.added] || 0) + 1;
    return { a, when: new Date(Date.parse(a.added + 'T12:00:00Z') - (perDay[a.added] - 1) * 60000) };
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>RemadeByAI: new apps</title>
  <link>${SITE}/new/</link>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>The newest AI-built apps listed on RemadeByAI: familiar software, rebuilt with AI.</description>
  <language>en-us</language>
  <lastBuildDate>${items.length ? items[0].when.toUTCString() : new Date().toUTCString()}</lastBuildDate>
  <image><url>${SITE}/assets/icon-512.png</url><title>RemadeByAI: new apps</title><link>${SITE}/new/</link></image>
${items.map(({ a, when }) => `  <item>
    <title>${xmlEsc(`${a.name}: ${a.alternative}`)}</title>
    <link>${SITE}/apps/${a.slug}/</link>
    <guid isPermaLink="true">${SITE}/apps/${a.slug}/</guid>
    <pubDate>${when.toUTCString()}</pubDate>
    <category>${xmlEsc(a.category)}</category>
    <description>${xmlEsc(a.description + ([a.platforms && a.platforms.join(', '), a.price, a.license].some(Boolean) ? ` (${[a.platforms && a.platforms.join(', '), a.price, a.license].filter(Boolean).join(' · ')})` : ''))}</description>
  </item>`).join('\n')}
</channel>
</rss>
`;
}

// ---------- home page (only the marked regions change) ----------
function replaceRegion(html, name, content) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`);
  if (!re.test(html)) { console.error(`index.html is missing the <!-- build:${name} --> markers.`); process.exit(1); }
  return html.replace(re, (_, open, close) => `${open}\n${content}\n${close}`);
}
// Every entry with "featured": true takes a turn: all are rendered, the first is shown
// without JavaScript, and a tiny inline script shows one at random on each page load.
function featured(apps) {
  if (!apps.length) return '';
  const articles = apps.map((app, i) => {
    let art = '';
    if (app.featureArt) {
      const file = path.join(ROOT, 'partials', `art-${app.featureArt}.html`);
      if (fs.existsSync(file)) art = fs.readFileSync(file, 'utf8').trim();
    }
    return `<article class="feature" data-feature${i ? ' hidden' : ''} aria-labelledby="featured-${app.slug}">
      <div class="feature-copy">
        ${tile(app)}
        <h2 id="featured-${app.slug}">${esc(app.name)}</h2>
        <p class="lede">${esc(app.tagline || app.alternative)}</p>
        <p>${esc(app.featureText || app.description)}</p>
        <div class="feature-actions"><a class="button primary" href="${esc(app.url)}" data-track="featured" data-app="${app.slug}">${esc(app.featureLinkText || 'Visit ' + app.name)}</a><a class="button" href="/apps/${app.slug}/">Details</a></div>
        <small class="owner">By ${esc(app.owner)}</small>
      </div>
      ${art}
    </article>`;
  }).join('\n    ');
  const pick = apps.length > 1
    ? `\n    <script>(function(){var f=document.querySelectorAll('#featured [data-feature]'),n=Math.floor(Math.random()*f.length);for(var i=0;i<f.length;i++)f[i].hidden=i!==n;})();</script>`
    : '';
  return `<section class="wrap" id="featured" aria-label="Featured project">
    <p class="section-label">✦ Featured project</p>
    ${articles}${pick}
  </section>`;
}
function filterOptions(categories, apps) {
  const platforms = PLATFORMS.filter(p => apps.some(a => (a.platforms || []).includes(p)));
  const cat = `<label class="select"><span class="visually-hidden">Category</span><select data-filter="category"><option value="">All categories</option>${categories.map(c => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></label>`;
  const plat = platforms.length ? `<label class="select"><span class="visually-hidden">Platform</span><select data-filter="platform"><option value="">Any platform</option>${platforms.map(p => `<option>${p}</option>`).join('')}</select></label>` : '';
  const used = (tagger, order) => order.filter(v => apps.some(a => tagger(a).includes(v)));
  const select = (name, label, any, values) => values.length
    ? `<label class="select"><span class="visually-hidden">${label}</span><select data-filter="${name}"><option value="">${any}</option>${values.map(v => `<option>${esc(v)}</option>`).join('')}</select></label>`
    : '';
  const price = select('price', 'Price', 'Any price', used(priceTags, PRICES));
  const licence = select('licence', 'Licence', 'Any licence', used(licenceTags, [...LICENCES, CLOSED]));
  return cat + plat + price + licence;
}

// All apps (/apps/): the full A to Z list with search and filters (directory.js). Kept off the home page.
function allAppsPage(apps, categories) {
  const az = [...apps].sort(byName);
  return `${head({ title: 'All apps | RemadeByAI', description: 'Every AI-built app and alternative to familiar software on RemadeByAI, A to Z, with search and filters.', canonical: '/apps/',
    scripts: `\n  <script src="/directory.js?v=${ASSET_VERSION.js}" defer></script>` })}
<section class="wrap directory list-page" id="directory" aria-labelledby="directory-title">
  <p class="section-label">✦ All apps</p>
  <div class="directory-top">
    <div><h1 class="page-title" id="directory-title">All apps</h1><p>EmuKey apps and independent open-source picks, A to Z. <a href="/categories/">Browse by category</a> or see what's <a href="/new/">new</a>.</p></div>
    <label class="search" hidden><span class="visually-hidden">Search apps</span><input type="search" placeholder="Filter this list"></label>
  </div>
  <div class="filters" hidden>
    <div class="filter-group" role="group" aria-label="Filter apps">
      <button type="button" data-group="all" aria-pressed="true">All apps</button>
      <button type="button" data-group="emukey" aria-pressed="false">EmuKey apps</button>
      <button type="button" data-group="open" aria-pressed="false">Open source</button>
      ${filterOptions(categories, apps)}
    </div>
    <span class="count" role="status">${apps.length} apps</span>
  </div>
  <div class="cards" id="all-apps">
${az.map(a => card(a, 2)).join('\n')}
  </div>
  <div class="empty" hidden><strong>No matching apps</strong><p>Try a different search or reset the filters.</p><button class="button" type="button" id="reset">Reset filters</button></div>
</section>
${foot}`;
}
// About (/about/) and List your app (/list/): hand-edited bodies in partials/, wrapped in the site shell.
function partialPage({ canonical, title, description, partial, scripts = '' }) {
  return `${head({ title, description, canonical, scripts })}
${read(`partials/${partial}`).trim()}
${foot}`;
}

// The index the header search box uses on every page (site.js). Short keys keep it small.
function searchIndex(apps) {
  return JSON.stringify({
    apps: [...apps].sort(byName).map(a => ({
      n: a.name, u: `/apps/${a.slug}/`, r: a.alternative.replace(/^(Alternative to|Inspired by)\s*/i, ''),
      ...(/^Inspired by\s/i.test(a.alternative) ? { i: 1 } : {}),
      ...(a.keywords ? { k: a.keywords.join(' ') } : {}),
      c: a.category, m: a.maker || a.owner, p: a.platforms || [], d: a.description,
      $: priceTags(a), l: licenceTags(a), o: a.group === 'open',
    })),
  });
}

// ---------- run ----------
function main() {
  const apps = load();
  ASSET_VERSION = { css: hash('styles.css'), js: hash('directory.js'), contact: hash('contact.js'), site: hash('site.js') };
  const categories = categoriesOf(apps);
  const newest = [...apps].sort(byNewest);

  const topics = alternativeTopics(apps);
  const platforms = platformGroups(apps);
  for (const app of apps) app.topics = topics.filter(t => t.apps.includes(app));

  for (const dir of GENERATED_DIRS) fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });

  for (const app of apps) write(`apps/${app.slug}/index.html`, appPage(app, apps));

  write('categories/index.html', `${head({ title: 'Categories | RemadeByAI', description: 'Browse AI-built apps and alternatives to familiar software by category.', canonical: '/categories/' })}
<div class="wrap list-page">
  <p class="section-label">✦ Categories</p>
  <h1 class="page-title">Browse by category</h1>
  <p class="page-intro">${apps.length} apps in ${categories.length} categories.</p>
  ${categoryChips(categories)}
  <h2 class="sub-title">Alternatives to popular software</h2>
  ${topicChips(topics)}
  <h2 class="sub-title">By platform</h2>
  ${platformChips(platforms)}
</div>
${foot}`);
  for (const c of categories) {
    write(`categories/${c.slug}/index.html`, listPage({
      canonical: `/categories/${c.slug}/`, title: `${categoryTitle(c)} | RemadeByAI`,
      description: categoryDescription(c),
      jsonLd: [itemList(`${c.name} apps`, [...c.apps].sort(byName)), breadcrumbs([['Home', '/'], ['Categories', '/categories/'], [c.name, `/categories/${c.slug}/`]])],
      label: 'Category', heading: esc(c.name), intro: `${c.apps.length} ${c.apps.length === 1 ? 'app' : 'apps'}. <a href="/categories/">All categories</a>`,
      apps: [...c.apps].sort(byName),
    }));
  }
  write('alternatives/index.html', hubPage({
    canonical: '/alternatives/', title: 'AI-built alternatives to popular software | RemadeByAI',
    description: `AI-built alternatives to ${andList(topics.slice(0, 4).map(t => t.name))} and more, gathered from the RemadeByAI directory.`,
    label: 'Alternatives', heading: 'Alternatives to popular software',
    intro: `AI-built replacements for the software people know best. Each page lists only apps we've checked. See also <a href="/categories/">categories</a> and <a href="/platforms/">platforms</a>.`,
    chips: topicChips(topics),
  }));
  for (const t of topics) write(`alternatives/${t.slug}/index.html`, topicPage(t));
  write('platforms/index.html', hubPage({
    canonical: '/platforms/', title: 'AI-built apps by platform | RemadeByAI',
    description: `AI-built apps for ${andList(platforms.map(g => g.platform === 'Web' ? 'the web' : g.platform))}: alternatives to familiar software, listed on RemadeByAI.`,
    label: 'Platforms', heading: 'Browse by platform',
    intro: `Find apps that run on your device. Many run on more than one. See also <a href="/categories/">categories</a> and <a href="/alternatives/">alternatives</a>.`,
    chips: platformChips(platforms),
  }));
  for (const g of platforms) write(`platforms/${g.slug}/index.html`, platformPage(g));
  write('feed.xml', rssFeed(newest));

  write('new/index.html', listPage({
    canonical: '/new/', title: 'New arrivals | RemadeByAI', description: 'The latest AI-built apps added to RemadeByAI.',
    label: 'New arrivals', heading: 'Newest apps', intro: 'Every app on RemadeByAI, most recently listed first. Follow new listings with the <a href="/feed.xml">RSS feed</a>.',
    apps: newest,
  }));

  write('apps/index.html', allAppsPage(apps, categories));
  write('about/index.html', partialPage({ canonical: '/about/', title: 'About | RemadeByAI', partial: 'about.html',
    description: 'RemadeByAI is a directory from EmuKey LLC of practical software that rebuilds familiar tools with AI.' }));
  write('badge/index.html', badgePage(apps));
  write('list/index.html', partialPage({ canonical: '/list/', title: 'List your app | RemadeByAI', partial: 'list.html',
    description: 'Made a working alternative to familiar software with AI? Ask to have it listed on RemadeByAI.',
    scripts: `\n  <script src="/contact.js?v=${ASSET_VERSION.contact}" defer></script>` }));

  let home = read('index.html');
  home = replaceRegion(home, 'assets', siteAssets());
  home = replaceRegion(home, 'jsonld', '  ' + jsonLdTag(siteJsonLd(apps)));
  home = replaceRegion(home, 'header', header());
  home = replaceRegion(home, 'stats', `${apps.length} apps in ${categories.length} categories`);
  home = replaceRegion(home, 'featured', featured(apps.filter(a => a.featured)));
  home = replaceRegion(home, 'new', cardGrid(newest.slice(0, NEW_ON_HOME)));
  home = replaceRegion(home, 'categories', categoryTiles(categories));
  home = replaceRegion(home, 'alternatives', topicChips(topics));
  home = replaceRegion(home, 'count', `${apps.length}`);
  home = replaceRegion(home, 'footer', footer());
  write('index.html', home);
  write('search.json', searchIndex(apps));

  // lastmod: the newest date we know for each page (listed, reviewed, or "What people say" checked).
  const appDate = a => [a.added, a.review && a.review.date, a.whatPeopleSay && a.whatPeopleSay.checked].filter(Boolean).sort().pop();
  const newestOf = list => list.map(appDate).sort().pop();
  const all = newestOf(apps);
  const urls = [['/', all], ['/apps/', all], ['/categories/', all], ['/new/', newestOf(apps.map(a => ({ added: a.added })))],
    ['/about/'], ['/list/'], ['/badge/'], ['/alternatives/', newestOf(topics.flatMap(t => t.apps))], ['/platforms/', all],
    ...topics.map(t => [`/alternatives/${t.slug}/`, newestOf(t.apps)]), ...platforms.map(g => [`/platforms/${g.slug}/`, newestOf(g.apps)]),
    ...categories.map(c => [`/categories/${c.slug}/`, newestOf(c.apps)]), ...apps.map(a => [`/apps/${a.slug}/`, appDate(a)])];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${SITE}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);
  // The repo's notes and Worker code are served by GitHub Pages too; keep them out of search results.
  write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /docs/\nDisallow: /clicks-worker/\nDisallow: /forms-worker/\nDisallow: /partials/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  write('404.html', notFoundPage(newest));

  console.log(`Built ${apps.length} app pages, ${categories.length} category pages, ${topics.length} alternatives pages, ${platforms.length} platform pages, new arrivals, RSS feed, home page and sitemap.`);
}

main();
