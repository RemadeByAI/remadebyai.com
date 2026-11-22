// Search and filters for the "All apps" list on the home page.
// The cards themselves are plain HTML written by build.js from projects.json, so the list works without JavaScript;
// this script only hides and shows them. To add an app, edit projects.json and run "node build.js".
// Each <select data-filter="NAME"> matches the card's data-NAME attribute (a "|"-separated list).
// The current search and filters are kept in the address bar, so a filtered list can be shared:
//   /?q=email  /?category=productivity  /?platform=Linux&price=Free  /?group=open&licence=MIT
const searchLabel = document.querySelector('.search');
const searchInput = searchLabel.querySelector('input');
const filters = document.querySelector('.filters');
const groupButtons = [...filters.querySelectorAll('button[data-group]')];
const selects = [...filters.querySelectorAll('select[data-filter]')];
const cards = [...document.querySelectorAll('#all-apps .card')];
const count = filters.querySelector('.count');
const empty = document.querySelector('.empty');
let group = 'all';

function update({ keepUrl = false } = {}) {
  const terms = searchInput.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const active = selects.filter(s => s.value).map(s => [s.dataset.filter, s.value]);
  let visible = 0;
  for (const card of cards) {
    const show = (group === 'all' || card.dataset.group === group)
      && active.every(([name, value]) => (card.dataset[name] || '').split('|').includes(value))
      && terms.every(term => card.dataset.search.includes(term));
    card.hidden = !show;
    if (show) visible += 1;
  }
  for (const button of groupButtons) button.setAttribute('aria-pressed', String(button.dataset.group === group));
  count.textContent = visible === cards.length ? `${visible} apps`
    : `${visible} of ${cards.length} ${cards.length === 1 ? 'app' : 'apps'}`;
  empty.hidden = visible > 0;
  if (!keepUrl) saveToUrl(active);
}

function saveToUrl(active) {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
  if (group !== 'all') params.set('group', group);
  for (const [name, value] of active) params.set(name, value);
  const query = params.toString();
  history.replaceState(null, '', (query ? `/?${query}` : '/') + location.hash);
}

for (const button of groupButtons) {
  button.addEventListener('click', () => { group = button.dataset.group; update(); });
}
for (const select of selects) select.addEventListener('change', () => update());
searchInput.addEventListener('input', () => update());
document.querySelector('#reset').addEventListener('click', () => {
  group = 'all';
  searchInput.value = '';
  for (const select of selects) select.value = '';
  update();
  searchInput.focus();
});

// The header search box (site.js) calls this on the home page instead of reloading it.
window.rbaShowSearch = query => {
  searchInput.value = query;
  update();
  document.getElementById('directory').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// A link like /?q=email or /?category=productivity opens the list already filtered.
const params = new URLSearchParams(location.search);
let fromLink = false;
if (params.get('q')) { searchInput.value = params.get('q'); fromLink = true; }
if (groupButtons.some(b => b.dataset.group === params.get('group'))) { group = params.get('group'); fromLink = true; }
for (const select of selects) {
  const wanted = params.get(select.dataset.filter);
  if (wanted && [...select.options].some(o => o.value === wanted)) { select.value = wanted; fromLink = true; }
}

searchLabel.hidden = false;
filters.hidden = false;
update({ keepUrl: true });
if (fromLink && !location.hash) document.getElementById('directory').scrollIntoView({ block: 'start' });
