// Renders the featured project and the project cards from projects.json, then wires up search and filters.
// To add a project, add an entry to projects.json. No HTML changes needed.
// To feature a project, set "featured": true on its entry (one at a time).
const searchLabel = document.querySelector('.search');
const searchInput = searchLabel.querySelector('input');
const filters = document.querySelector('.filters');
const buttons = [...filters.querySelectorAll('button')];
const cardList = document.querySelector('.cards');
const count = document.querySelector('.count');
const empty = document.querySelector('.empty');
const featuredSection = document.querySelector('#featured');
let projects = [];
let selected = 'all';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCard(project) {
  const card = el('article', 'card');
  card.dataset.group = project.group;

  const top = el('div', 'card-top');
  const tile = el('span', ['tile', project.tile].filter(Boolean).join(' '), project.icon);
  tile.setAttribute('aria-hidden', 'true');
  top.append(tile, el('small', '', project.owner));

  const bottom = el('div', 'card-bottom');
  const link = el('a', '', project.linkText);
  link.href = project.url;
  link.setAttribute('aria-label', (project.linkText === 'GitHub' ? 'View ' + project.name + ' on GitHub' : 'Visit ' + project.name));
  bottom.append(el('span', '', project.category), link);

  card.append(top, el('h3', '', project.name), el('p', 'alternative', project.alternative), el('p', '', project.description), bottom);
  return card;
}

function renderFeature(project) {
  const copy = el('div', 'feature-copy');
  const tile = el('span', ['tile', project.tile].filter(Boolean).join(' '), project.icon);
  tile.setAttribute('aria-hidden', 'true');
  const title = el('h2', '', project.name);
  title.id = 'featured-title';
  const link = el('a', 'button primary', project.featureLinkText || 'Visit ' + project.name);
  link.href = project.url;
  copy.append(tile, title, el('p', 'lede', project.tagline || project.alternative), el('p', '', project.featureText || project.description), link, el('small', 'owner', 'By ' + project.owner));

  const parts = [copy];
  const art = project.featureArt && document.querySelector('#art-' + project.featureArt);
  if (art) parts.push(art.content.cloneNode(true));
  featuredSection.querySelector('.feature').replaceChildren(...parts);
}

function updateProjects() {
  const terms = searchInput.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let visible = 0;
  for (const project of projects) {
    const matchesFilter = selected === 'all' || project.dataset.group === selected;
    const searchableText = project.textContent.toLowerCase();
    project.hidden = !(matchesFilter && terms.every(term => searchableText.includes(term)));
    if (!project.hidden) visible += 1;
  }
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === selected));
  }
  count.textContent = visible === 1 ? '1 project' : visible + ' projects';
  empty.hidden = visible > 0;
}

async function init() {
  try {
    const response = await fetch('projects.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const featured = data.projects.find(project => project.featured);
    if (featured) renderFeature(featured);
    else featuredSection.hidden = true;
    projects = data.projects.map(renderCard);
    cardList.replaceChildren(...projects);
  } catch (error) {
    cardList.replaceChildren(el('p', 'load-error', 'Projects could not be loaded. Please refresh the page.'));
    featuredSection.hidden = true;
    console.error('projects.json failed to load', error);
    return;
  }
  for (const button of buttons) {
    button.addEventListener('click', () => {
      selected = button.dataset.filter;
      updateProjects();
    });
  }
  searchInput.addEventListener('input', updateProjects);
  document.querySelector('#reset').addEventListener('click', () => {
    selected = 'all';
    searchInput.value = '';
    updateProjects();
    searchInput.focus();
  });
  searchLabel.hidden = false;
  filters.hidden = false;
  updateProjects();
}

init();
