// Search and filters for the "All apps" list on the home page.
// The cards themselves are plain HTML written by build.js from projects.json, so the list works without JavaScript;
// this script only hides and shows them. To add an app, edit projects.json and run "node build.js".
const searchLabel = document.querySelector('.search');
const searchInput = searchLabel.querySelector('input');
const filters = document.querySelector('.filters');
const groupButtons = [...filters.querySelectorAll('button[data-group]')];
const selects = [...filters.querySelectorAll('select[data-filter]')];
const cards = [...document.querySelectorAll('#all-apps .card')];
const count = filters.querySelector('.count');
const empty = document.querySelector('.empty');
let group = 'all';

function selectValue(name) {
  const select = selects.find(s => s.dataset.filter === name);
  return select ? select.value : '';
}

function update() {
  const terms = searchInput.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const category = selectValue('category');
  const platform = selectValue('platform');
  let visible = 0;
  for (const card of cards) {
    const show = (group === 'all' || card.dataset.group === group)
      && (!category || card.dataset.category === category)
      && (!platform || card.dataset.platforms.split('|').includes(platform))
      && terms.every(term => card.dataset.search.includes(term));
    card.hidden = !show;
    if (show) visible += 1;
  }
  for (const button of groupButtons) button.setAttribute('aria-pressed', String(button.dataset.group === group));
  count.textContent = visible === 1 ? '1 app' : visible + ' apps';
  empty.hidden = visible > 0;
}

for (const button of groupButtons) {
  button.addEventListener('click', () => { group = button.dataset.group; update(); });
}
for (const select of selects) select.addEventListener('change', update);
searchInput.addEventListener('input', update);
document.querySelector('#reset').addEventListener('click', () => {
  group = 'all';
  searchInput.value = '';
  for (const select of selects) select.value = '';
  update();
  searchInput.focus();
});

// A link like /?q=email or /?category=productivity opens the list already filtered.
const params = new URLSearchParams(location.search);
if (params.get('q')) searchInput.value = params.get('q');
for (const select of selects) if (params.get(select.dataset.filter)) select.value = params.get(select.dataset.filter);

searchLabel.hidden = false;
filters.hidden = false;
update();
