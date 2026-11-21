#!/usr/bin/env node
// Builds the static pages of remadebyai.com from projects.json.
// Run it from this folder after any change to projects.json, partials/, styles.css or directory.js:
//   node build.js
// It needs only Node.js (18 or newer) and no packages. It checks projects.json first and stops with a
// clear message if an entry is wrong, then rewrites:
//   index.html (between the <!-- build:NAME --> markers only), apps/, categories/, new/, sitemap.xml
// Never edit the generated folders by hand; edit projects.json and run the build again.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SITE = 'https://remadebyai.com';
const NEW_ON_HOME = 6;
const GROUPS = { emukey: 'EmuKey app', open: 'Open source' };
const PLATFORMS = ['Windows', 'macOS', 'Linux', 'Web', 'iOS', 'Android'];
const GENERATED_DIRS = ['apps', 'categories', 'new'];

// ---------- helpers ----------
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = text => String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 10);
const paragraphs = text => String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  .map(p => `<p>${esc(p)}</p>`).join('\n');
const formatDate = iso => new Date(iso + 'T12:00:00Z')
  .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
function write(file, content) {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
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
    const slug = app.slug || slugify(app.name || '');
    if (slugs.has(slug)) problems.push(`${where}: slug "${slug}" is used twice. Give one of them its own "slug".`);
    slugs.add(slug);
    return { ...app, slug, order: index, categorySlug: slugify(app.category || '') };
  });
  if (data.projects.filter(app => app.featured).length > 1) problems.push('Only one project can have "featured": true.');
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
function head({ title, description, canonical, ogType = 'website' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#090d0b">
  <meta name="description" content="${esc(description)}">
  <title>${esc(title)}</title>
  <link rel="canonical" href="${SITE}${canonical}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="RemadeByAI">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}${canonical}">
  <meta property="og:image" content="${SITE}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/styles.css?v=${ASSET_VERSION.css}">
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
${header()}
<main id="main">`;
}
function header() {
  return `<header>
  <div class="wrap nav">
    <a class="brand" href="/"><img src="/assets/mark.svg" alt="" width="35" height="35"><span>RemadeBy<em>AI</em><small>.com</small></span></a>
    <nav aria-label="Main navigation"><a href="/categories/">Categories</a><a href="/new/">New</a><a href="/#directory">All apps</a><a href="/#about">About</a><a href="/#list">List your app</a></nav>
    <a class="company" href="https://emukey.com/">EmuKey LLC</a>
  </div>
</header>`;
}
const foot = `</main>
<footer>
  <div class="wrap foot"><a class="brand" href="/">RemadeBy<em>AI</em></a><p>A software directory from <a href="https://emukey.com/">EmuKey LLC</a>.</p></div>
</footer>
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
function card(app) {
  const search = [app.name, app.alternative, app.description, app.category, app.owner, ...(app.platforms || []), app.license]
    .filter(Boolean).join(' ').toLowerCase();
  return `<article class="card" data-group="${esc(app.group)}" data-category="${esc(app.categorySlug)}" data-platforms="${esc((app.platforms || []).join('|'))}" data-search="${esc(search)}">
  <div class="card-top">${tile(app)}<small>${esc(app.owner)}</small></div>
  <h3><a class="card-link" href="/apps/${app.slug}/">${esc(app.name)}</a></h3>
  <p class="alternative">${esc(app.alternative)}</p>
  <p>${esc(app.description)}</p>
  <div class="card-bottom"><a class="card-category" href="/categories/${app.categorySlug}/">${esc(app.category)}</a><span class="card-more" aria-hidden="true">Details →</span></div>
</article>`;
}
const cardGrid = apps => `<div class="cards">\n${apps.map(card).join('\n')}\n</div>`;

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

// ---------- pages ----------
function appPage(app, all) {
  const facts = [
    ['Category', `<a href="/categories/${app.categorySlug}/">${esc(app.category)}</a>`],
    ['Replaces', esc(app.alternative.replace(/^Alternative to\s*/i, ''))],
    ['Platforms', esc((app.platforms || []).join(', '))],
    ['Licence', esc(app.license)],
    ['Price', esc(app.price)],
    ['Made by', esc(app.maker || (app.group === 'emukey' ? app.owner : ''))],
    ['Source code', app.source ? `<a href="${esc(app.source)}">${esc(app.source.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : ''],
    ['Listed', esc(formatDate(app.added))],
  ].filter(([, value]) => value);

  const actions = [];
  if (app.download) actions.push(`<a class="button primary" href="${esc(app.download)}">Download</a>`);
  actions.push(`<a class="button${app.download ? '' : ' primary'}" href="${esc(app.url)}">${esc(externalLabel(app))}</a>`);

  const shots = (app.screenshots || []).length ? `
  <section class="app-section" aria-labelledby="shots-title">
    <h2 id="shots-title">Screenshots</h2>
    <div class="shots">${app.screenshots.map(s =>
      `<figure><a href="${esc(s.src)}"><img src="${esc(s.src)}" alt="${esc(s.alt)}" loading="lazy"></a>${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ''}</figure>`).join('')}</div>
  </section>` : '';

  const built = app.builtWithAI
    ? paragraphs(app.builtWithAI)
    : `<p class="muted">We haven't confirmed how ${esc(app.name)} was built yet. If you made it, <a href="/#list">tell us how AI was part of it</a>.</p>`;

  const review = app.review ? `
    <div class="review">
      ${app.review.verdict ? `<p class="review-verdict">${esc(app.review.verdict)}</p>` : ''}
      ${paragraphs(app.review.body)}
      <p class="review-meta">Reviewed ${esc(formatDate(app.review.date))}${app.review.version ? ` · version ${esc(app.review.version)}` : ''}${app.review.author ? ` · by ${esc(app.review.author)}` : ''}</p>
    </div>` : `<p class="muted">We haven't reviewed ${esc(app.name)} yet.</p>`;

  const related = all.filter(a => a.categorySlug === app.categorySlug && a.slug !== app.slug).sort(byNewest).slice(0, 3);
  const relatedHtml = related.length ? `
  <section class="app-section" aria-labelledby="related-title">
    <h2 id="related-title">More in ${esc(app.category)}</h2>
    ${cardGrid(related)}
  </section>` : '';

  const title = `${app.name}: ${app.alternative} | RemadeByAI`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: app.name,
    description: app.description, applicationCategory: app.category, url: app.url,
    ...(app.platforms ? { operatingSystem: app.platforms.join(', ') } : {}),
    ...(app.license ? { license: app.license } : {}),
    ...(app.maker || app.group === 'emukey' ? { author: { '@type': 'Organization', name: app.maker || app.owner } } : {}),
  };
  return `${head({ title, description: `${app.name}. ${app.description}`, canonical: `/apps/${app.slug}/` })}
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
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
  <section class="app-section" aria-labelledby="review-title">
    <h2 id="review-title">Our review</h2>
    ${review}
  </section>
  ${relatedHtml}
</div>
${foot}`;
}

function listPage({ canonical, title, description, label, heading, intro, apps, extra = '' }) {
  return `${head({ title, description, canonical })}
<div class="wrap list-page">
  <p class="section-label">✦ ${esc(label)}</p>
  <h1 class="page-title">${heading}</h1>
  <p class="page-intro">${intro}</p>
  ${extra}
  ${cardGrid(apps)}
</div>
${foot}`;
}

// ---------- home page (only the marked regions change) ----------
function replaceRegion(html, name, content) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`);
  if (!re.test(html)) { console.error(`index.html is missing the <!-- build:${name} --> markers.`); process.exit(1); }
  return html.replace(re, `$1\n${content}\n$2`);
}
function featured(app) {
  if (!app) return '';
  let art = '';
  if (app.featureArt) {
    const file = path.join(ROOT, 'partials', `art-${app.featureArt}.html`);
    if (fs.existsSync(file)) art = fs.readFileSync(file, 'utf8').trim();
  }
  return `<section class="wrap" id="featured" aria-labelledby="featured-title">
    <p class="section-label">✦ Featured project</p>
    <article class="feature">
      <div class="feature-copy">
        ${tile(app)}
        <h2 id="featured-title">${esc(app.name)}</h2>
        <p class="lede">${esc(app.tagline || app.alternative)}</p>
        <p>${esc(app.featureText || app.description)}</p>
        <div class="feature-actions"><a class="button primary" href="${esc(app.url)}">${esc(app.featureLinkText || 'Visit ' + app.name)}</a><a class="button" href="/apps/${app.slug}/">Details</a></div>
        <small class="owner">By ${esc(app.owner)}</small>
      </div>
      ${art}
    </article>
  </section>`;
}
function filterOptions(categories, apps) {
  const platforms = PLATFORMS.filter(p => apps.some(a => (a.platforms || []).includes(p)));
  const cat = `<label class="select"><span class="visually-hidden">Category</span><select data-filter="category"><option value="">All categories</option>${categories.map(c => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></label>`;
  const plat = platforms.length ? `<label class="select"><span class="visually-hidden">Platform</span><select data-filter="platform"><option value="">Any platform</option>${platforms.map(p => `<option>${p}</option>`).join('')}</select></label>` : '';
  return cat + plat;
}

// ---------- run ----------
function main() {
  const apps = load();
  ASSET_VERSION = { css: hash('styles.css'), js: hash('directory.js') };
  const categories = categoriesOf(apps);
  const newest = [...apps].sort(byNewest);
  const az = [...apps].sort(byName);

  for (const dir of GENERATED_DIRS) fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });

  for (const app of apps) write(`apps/${app.slug}/index.html`, appPage(app, apps));

  write('categories/index.html', `${head({ title: 'Categories | RemadeByAI', description: 'Browse AI-built apps and alternatives to familiar software by category.', canonical: '/categories/' })}
<div class="wrap list-page">
  <p class="section-label">✦ Categories</p>
  <h1 class="page-title">Browse by category</h1>
  <p class="page-intro">${apps.length} apps in ${categories.length} categories.</p>
  ${categoryChips(categories)}
</div>
${foot}`);
  for (const c of categories) {
    write(`categories/${c.slug}/index.html`, listPage({
      canonical: `/categories/${c.slug}/`, title: `${c.name} apps | RemadeByAI`,
      description: `AI-built ${c.name.toLowerCase()} apps and alternatives to familiar software, listed on RemadeByAI.`,
      label: 'Category', heading: esc(c.name), intro: `${c.apps.length} ${c.apps.length === 1 ? 'app' : 'apps'}. <a href="/categories/">All categories</a>`,
      apps: [...c.apps].sort(byName),
    }));
  }
  write('new/index.html', listPage({
    canonical: '/new/', title: 'New arrivals | RemadeByAI', description: 'The latest AI-built apps added to RemadeByAI.',
    label: 'New arrivals', heading: 'Newest apps', intro: 'Every app on RemadeByAI, most recently listed first.',
    apps: newest,
  }));

  let home = read('index.html');
  home = replaceRegion(home, 'assets', `  <link rel="stylesheet" href="/styles.css?v=${ASSET_VERSION.css}">\n  <script src="/directory.js?v=${ASSET_VERSION.js}" defer></script>`);
  home = replaceRegion(home, 'featured', featured(apps.find(a => a.featured)));
  home = replaceRegion(home, 'new', cardGrid(newest.slice(0, NEW_ON_HOME)));
  home = replaceRegion(home, 'categories', categoryChips(categories));
  home = replaceRegion(home, 'filters', filterOptions(categories, apps));
  home = replaceRegion(home, 'cards', az.map(card).join('\n'));
  home = replaceRegion(home, 'count', `${apps.length} apps`);
  write('index.html', home);

  const urls = ['/', '/categories/', '/new/', ...categories.map(c => `/categories/${c.slug}/`), ...apps.map(a => `/apps/${a.slug}/`)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`Built ${apps.length} app pages, ${categories.length} category pages, new arrivals, home page and sitemap.`);
}

main();
