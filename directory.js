// Renders the project cards from projects.json, then wires up search and filters.
// To add a project, add an entry to projects.json. No HTML changes needed.
const searchLabel = document.querySelector('.search');
const searchInput = searchLabel.querySelector('input');
const filters = document.querySelector('.filters');
const buttons = [...filters.querySelectorAll('button')];
const cardList = document.querySelector('.cards');
const count = document.querySelector('.count');
const empty = document.querySelector('.empty');
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
    projects = data.projects.map(renderCard);
    cardList.replaceChildren(...projects);
  } catch (error) {
    cardList.replaceChildren(el('p', 'load-error', 'Projects could not be loaded. Please refresh the page.'));
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
