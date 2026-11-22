// Loaded on every page of remadebyai.com. Two jobs:
// 1. The search box in the header: suggests matching apps as you type, from /search.json (written by
//    build.js). Enter shows every match in the All apps list (/apps/?q=...). Without JavaScript the box is a
//    plain form that opens /apps/?q=..., which directory.js filters.
// 2. Click counting: links with data-track (Download, Visit site, Source code, featured buttons) send a
//    small anonymous ping to the clicks Worker named in the header form's data-clicks attribute. No
//    cookies, nothing about the visitor; just which app, which button and which page. Set in build.js.
(() => {
  const form = document.querySelector('.site-search');
  if (!form) return;
  const input = form.querySelector('input');
  const list = form.querySelector('.site-search-results');
  let index = null;
  let loading = null;
  let items = [];
  let active = -1;

  const load = () => loading || (loading = fetch('/search.json')
    .then(r => r.json()).then(data => { index = data.apps; }).catch(() => { loading = null; }));

  // Every word has to match somewhere; matches in the name count most, then what it replaces, maker, category.
  function search(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !index) return [];
    const results = [];
    for (const app of index) {
      const fields = [
        [app.n, 100], [app.r, 45], [app.m, 30], [app.c, 30],
        [[...app.p, ...app.$, ...app.l, app.o ? 'open source' : ''].join(' '), 15], [app.d, 8],
      ].map(([text, weight]) => [String(text).toLowerCase(), weight]);
      let score = 0;
      for (const term of terms) {
        let best = 0;
        for (const [text, weight] of fields) {
          const at = text.indexOf(term);
          if (at === -1) continue;
          const wordStart = at === 0 || /[^a-z0-9]/.test(text[at - 1]);
          best = Math.max(best, weight * (wordStart ? 1 : 0.5) + (at === 0 ? 5 : 0));
        }
        if (!best) { score = 0; break; }
        score += best;
      }
      if (score) results.push([score, app]);
    }
    return results.sort((a, b) => b[0] - a[0] || a[1].n.localeCompare(b[1].n)).map(r => r[1]);
  }

  const escape = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const allUrl = query => `/apps/?q=${encodeURIComponent(query)}`;

  function render() {
    const query = input.value.trim();
    if (!query) return close();
    const found = search(query);
    const shown = found.slice(0, 7);
    items = shown.map(app => ({ url: app.u, html: `<strong>${escape(app.n)}</strong><span>Replaces ${escape(app.r)} · ${escape(app.c)}</span>` }));
    items.push({
      url: allUrl(query), all: true,
      html: found.length ? `<span>See all ${found.length} ${found.length === 1 ? 'match' : 'matches'} in the app list →</span>` : `<span>No apps match "${escape(query)}"</span>`,
    });
    active = -1;
    list.innerHTML = items.map((item, i) =>
      `<li role="option" id="ss-${i}" aria-selected="false"${item.all ? ' class="all"' : ''}><a href="${escape(item.url)}" tabindex="-1">${item.html}</a></li>`).join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function close() {
    list.hidden = true;
    list.innerHTML = '';
    items = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function highlight(next) {
    if (!items.length) return;
    active = (next + items.length) % items.length;
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    input.setAttribute('aria-activedescendant', `ss-${active}`);
  }
  function showAll(query) {
    close();
    if (window.rbaShowSearch && location.pathname === '/apps/') window.rbaShowSearch(query);
    else location.href = allUrl(query);
  }

  input.addEventListener('focus', () => { load(); if (input.value.trim()) load().then(render); });
  input.addEventListener('input', () => { load().then(render); });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); highlight(active + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); highlight(active - 1); }
    else if (event.key === 'Escape') { close(); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const query = input.value.trim();
    if (active >= 0 && items[active] && !items[active].all) location.href = items[active].url;
    else if (query) showAll(query);
  });
  list.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    if (link.parentElement.classList.contains('all')) { event.preventDefault(); showAll(input.value.trim()); }
  });
  document.addEventListener('click', event => { if (!form.contains(event.target)) close(); });
  form.addEventListener('focusout', () => setTimeout(() => { if (!form.contains(document.activeElement)) close(); }, 150));

  // Click counting.
  const endpoint = form.dataset.clicks;
  if (endpoint && navigator.sendBeacon) {
    const count = event => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      const link = event.target.closest('a[data-track]');
      if (!link) return;
      const body = JSON.stringify({ app: link.dataset.app || '', kind: link.dataset.track, page: location.pathname });
      try { navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' })); } catch { /* never block the link */ }
    };
    document.addEventListener('click', count, { capture: true });
    document.addEventListener('auxclick', count, { capture: true }); // middle-click opens a new tab
  }
})();
