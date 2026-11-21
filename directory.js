const searchLabel = document.querySelector('.search');
const searchInput = searchLabel.querySelector('input');
const filters = document.querySelector('.filters');
const buttons = [...filters.querySelectorAll('button')];
const projects = [...document.querySelectorAll('.card')];
const count = document.querySelector('.count');
const empty = document.querySelector('.empty');
let selected = 'all';

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

