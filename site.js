// Loaded on every page of remadebyai.com. Three jobs (plus the screenshot viewer):
// 1. The search box in the header (focused on page load on computers with a mouse): suggests matching apps as you type, from /search.json (written by
//    build.js). Enter shows every match in the All apps list (/apps/?q=...). Without JavaScript the box is a
//    plain form that opens /apps/?q=..., which directory.js filters.
// 2. Click counting: links with data-track (Download, Visit site, Source code, featured buttons) send a
//    small anonymous ping to the clicks Worker named in the header form's data-clicks attribute. No
//    cookies, nothing about the visitor; just which app, which button and which page. Set in build.js.
// 3. The light/dark mode button in the header (last block).
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

  // Every word has to match somewhere; matches in the name count most, then search keywords (k, e.g. "wow"), what it replaces, maker, category.
  function search(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !index) return [];
    const results = [];
    for (const app of index) {
      const fields = [
        [app.n, 100], [app.k || '', 60], [app.r, 45], [app.m, 30], [app.c, 30],
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
    items = shown.map(app => ({ url: app.u, html: `<strong>${escape(app.n)}</strong><span>${app.i ? 'Inspired by' : 'Replaces'} ${escape(app.r)} · ${escape(app.c)}</span>` }));
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

  let quietFocus = false; // true while the page itself focuses the box on load (see below)
  input.addEventListener('focus', () => { load(); if (input.value.trim() && !quietFocus) load().then(render); });
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

  // Put the text cursor in the box when a page opens, so visitors can just start typing. Only on
  // computers with a mouse (on phones and tablets it would pop up the on-screen keyboard), never when
  // the address has a #section to jump to or the visitor has already clicked or tabbed somewhere,
  // and without scrolling the page. The suggestions list stays closed until they type.
  const autofocus = () => {
    if (location.hash || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    quietFocus = true;
    input.focus({ preventScroll: true });
    quietFocus = false;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autofocus, { once: true });
  else autofocus();

  // Click counting.
  const endpoint = form.dataset.clicks;
  // Sent with fetch(keepalive), not navigator.sendBeacon: some privacy extensions block every
  // sendBeacon ("ping") request, which silently dropped all clicks. sendBeacon is only a fallback.
  if (endpoint) {
    const send = body => {
      try {
        fetch(endpoint, { method: 'POST', body, keepalive: true, mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'text/plain' } })
          .catch(() => { try { navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' })); } catch { /* ignore */ } });
      } catch { /* never block the link */ }
    };
    const count = event => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      const link = event.target.closest('a[data-track]');
      if (!link) return;
      send(JSON.stringify({ app: link.dataset.app || '', kind: link.dataset.track, page: location.pathname }));
    };
    document.addEventListener('click', count, { capture: true });
    document.addEventListener('auxclick', count, { capture: true }); // middle-click opens a new tab
  }
})();

// Screenshot viewer on app pages. Clicking a screenshot opens it large in a dialog with a close (X) button.
// Esc, the X, or a click on the dark area around the picture closes it; left/right arrow keys (or the
// on-screen arrows, or a swipe on phones) move between screenshots. Focus goes back to the thumbnail.
// Without JavaScript the thumbnails are plain links to the image file.
(() => {
  const links = [...document.querySelectorAll('.shots a')];
  if (!links.length || typeof HTMLDialogElement !== 'function') return;

  const dialog = document.createElement('dialog');
  dialog.className = 'viewer';
  dialog.setAttribute('aria-label', 'Screenshot');
  dialog.innerHTML = `
    <button type="button" class="viewer-close" aria-label="Close screenshot" title="Close (Esc)">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
    </button>
    <figure class="viewer-frame">
      <img alt="">
      <figcaption></figcaption>
    </figure>
    <button type="button" class="viewer-nav viewer-prev" aria-label="Previous screenshot">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button type="button" class="viewer-nav viewer-next" aria-label="Next screenshot">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;
  document.body.append(dialog);

  const img = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  const prev = dialog.querySelector('.viewer-prev');
  const next = dialog.querySelector('.viewer-next');
  const many = links.length > 1;
  prev.hidden = next.hidden = !many;
  let current = 0;

  function show(i) {
    current = (i + links.length) % links.length;
    const link = links[current];
    const thumb = link.querySelector('img');
    const text = link.closest('figure')?.querySelector('figcaption')?.textContent.trim() || '';
    img.src = link.href;
    img.alt = thumb ? thumb.alt : '';
    caption.textContent = many ? `${text}${text ? ' · ' : ''}${current + 1} of ${links.length}` : text;
    caption.hidden = !caption.textContent;
  }
  function open(i) {
    show(i);
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('viewer-open');
    dialog.querySelector('.viewer-close').focus();
  }

  links.forEach((link, i) => link.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; // new tab still works
    event.preventDefault();
    open(i);
  }));
  dialog.querySelector('.viewer-close').addEventListener('click', () => dialog.close());
  prev.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  // Anything that isn't the picture or a button counts as the backdrop.
  dialog.addEventListener('click', event => {
    if (!event.target.closest('img, button')) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (!many) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('viewer-open');
    img.removeAttribute('src');
    links[current].focus();
  });

  // Swipe left/right on touch screens.
  let startX = null;
  dialog.addEventListener('touchstart', event => { startX = event.touches.length === 1 ? event.touches[0].clientX : null; }, { passive: true });
  dialog.addEventListener('touchend', event => {
    if (startX === null || !many) return;
    const dx = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  });
})();

// Light/dark mode button in the header. The <head> script (build.js siteAssets) has already applied the
// saved choice; this flips html[data-theme], saves it under localStorage "theme" and keeps the
// color-scheme and theme-color metas in step. Dark is the default.
(() => {
  const root = document.documentElement;
  const metaScheme = document.querySelector('meta[name="color-scheme"]');
  const metaColor = document.querySelector('meta[name="theme-color"]');
  const label = theme => theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  const apply = theme => {
    root.setAttribute('data-theme', theme);
    if (metaScheme) metaScheme.content = theme;
    if (metaColor) metaColor.content = theme === 'light' ? '#f5f8f3' : '#090d0b';
    document.querySelectorAll('.theme-toggle').forEach(b => b.setAttribute('aria-label', label(theme)));
  };
  apply(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  document.querySelectorAll('.theme-toggle').forEach(button => button.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode: still switches for this page */ }
  }));
})();

// Copy buttons next to code snippets (the README badge code on app pages and /badge/).
document.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('[data-copy]');
  if (!btn) return;
  var code = btn.closest('.snippet').querySelector('code');
  var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code.textContent).then(done, function () {});
  else { var r = document.createRange(); r.selectNodeContents(code); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { document.execCommand('copy'); done(); } catch (err) {} }
});
