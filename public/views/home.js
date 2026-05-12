import { h, mount } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { openCookbookEditor } from '../components/editors.js';
import * as toast from '../lib/toast.js';
import { StarRating } from '../components/starRating.js';

export async function HomeView() {
  const root = h('div.container.stack-7');

  // Hero — single decorative cupcake (per user preference), gently floating
  const hero = h('section.hero');
  hero.innerHTML += `<div class="hero-decor right">${icon('cupcake')}</div>`;

  const title = h('h1');
  title.innerHTML = `Skip the story, <em>get to the recipe</em>.`;
  hero.appendChild(title);
  hero.appendChild(h('p.lead', 'Paste any recipe URL. We sift through and hand you the ingredients, instructions, and ratings so you can get cooking straight away. Save anything worth keeping to a cookbook of your own.'));

  // Paste card
  const pasteCard = h('div.paste-card');
  const form = h('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = input.value.trim();
    if (!url) return;
    submit(url);
  });

  const inputWrap = h('div.input-icon.flex-1');
  inputWrap.innerHTML = icon('link');
  const input = h('input.input', {
    type: 'url',
    name: 'url',
    placeholder: 'Paste a recipe URL to get started',
    autocomplete: 'off',
    'aria-label': 'Recipe URL',
    autofocus: '',
  });
  inputWrap.appendChild(input);
  form.appendChild(inputWrap);

  const btn = h('button.btn.btn-primary.btn-lg', { type: 'submit' });
  btn.innerHTML = `<span>Sweeten</span>${icon('arrowRight')}`;
  form.appendChild(btn);

  pasteCard.appendChild(form);

  function submit(url) {
    navigate('/recipe?' + new URLSearchParams({ url }).toString());
  }
  hero.appendChild(pasteCard);
  root.appendChild(hero);

  // Cookbooks (the dashed "+ New cookbook" tile in the grid is the only
  // way to add — no separate button in the section header).
  const cookbooksSection = h('section');
  const head = h('div.section-head');
  head.appendChild(h('h2', 'Your Cookbooks'));
  cookbooksSection.appendChild(head);

  const grid = h('div.cookbook-grid');
  cookbooksSection.appendChild(grid);
  root.appendChild(cookbooksSection);

  // Recent recipes
  const recentSection = h('section');
  recentSection.appendChild(h('div.section-head', h('h2', 'Recently Saved')));
  const recentGrid = h('div.recipe-grid');
  recentSection.appendChild(recentGrid);
  root.appendChild(recentSection);

  async function render() {
    // Render cookbook cards (with a sentinel "+ New cookbook" tile last)
    mount(grid);
    try {
      const { cookbooks } = await api.listCookbooks();
      cookbooks.forEach(cb => grid.appendChild(cookbookCard(cb)));
      const newTile = h('button.cookbook-card.cookbook-new', { type: 'button' });
      const inner = h('div.cookbook-new-inner');
      inner.innerHTML = `${icon('plus')}<span>New cookbook</span>`;
      newTile.appendChild(inner);
      newTile.addEventListener('click', () => openCookbookEditor({ onSave: () => render() }));
      grid.appendChild(newTile);
    } catch (e) {
      grid.appendChild(h('p.muted', 'Could not load cookbooks: ' + e.message));
    }

    // Render recent recipes
    mount(recentGrid);
    try {
      const { recipes } = await api.listRecipes({ limit: 12 });
      if (!recipes.length) {
        const empty = h('div.empty');
        empty.innerHTML = `<div class="empty-illustration">${icon('bookmark')}</div>
          <h3>No saved recipes yet</h3>
          <p>Paste a recipe URL above to get a clean reading view, then add it to a cookbook.</p>`;
        recentGrid.appendChild(empty);
        return;
      }
      recipes.forEach(r => recentGrid.appendChild(recipeCard(r)));
    } catch (e) {
      recentGrid.appendChild(h('p.muted', 'Could not load recipes: ' + e.message));
    }
  }

  await render();
  return root;
}

function cookbookCard(cb) {
  // A cookbook card *looks* like a physical book: spine on the left,
  // colored cover with the icon and title, page stack peeking out on
  // the right edge.
  const card = h('button.cookbook-card', { type: 'button' });
  card.style.setProperty('--cover', cb.coverColor || '#F8B4D9');

  const content = h('div.cookbook-cover-content');

  const iconWrap = h('div.cookbook-cover-icon');
  iconWrap.innerHTML = icon(cb.coverIcon || 'cupcake');
  content.appendChild(iconWrap);

  const titleBlock = h('div.cookbook-cover-titleBlock');
  titleBlock.appendChild(h('h3.cookbook-cover-title', cb.name));
  if (cb.description) titleBlock.appendChild(h('p.cookbook-cover-desc', cb.description));
  const meta = h('div.cookbook-cover-meta');
  meta.innerHTML = `${icon('bookmark')}<span>${cb.recipeCount} recipe${cb.recipeCount === 1 ? '' : 's'}</span>`;
  titleBlock.appendChild(meta);
  content.appendChild(titleBlock);

  card.appendChild(content);
  card.addEventListener('click', () => navigate(`/cookbook/${cb.id}`));
  return card;
}

function recipeCard(r) {
  const card = h('button.recipe-card', { type: 'button' });
  const imgWrap = h('div.recipe-card-image');
  if (r.heroImage) {
    imgWrap.appendChild(h('img', { src: r.heroImage, alt: r.title, loading: 'lazy' }));
  } else {
    const ph = h('div.placeholder');
    ph.innerHTML = icon('image');
    imgWrap.appendChild(ph);
  }
  card.appendChild(imgWrap);

  const content = h('div.recipe-card-content');
  content.appendChild(h('h4', r.title));
  const metaRow = h('div.recipe-card-meta');
  const parts = [];
  if (r.totalMinutes) {
    const span = h('span');
    span.innerHTML = `${icon('clock')}<span style="margin-left:4px">${formatMinutes(r.totalMinutes)}</span>`;
    parts.push(span);
  }
  if (r.userRating || r.externalRating) {
    parts.push(StarRating(r.userRating ?? r.externalRating, null, { size: '0.95em' }));
  }
  parts.forEach((p, i) => {
    if (i > 0) metaRow.appendChild(h('span.dot', '·'));
    metaRow.appendChild(p);
  });
  content.appendChild(metaRow);
  card.appendChild(content);
  card.addEventListener('click', () => navigate(`/saved/${r.id}`));
  return card;
}

function formatMinutes(m) {
  if (!m || m <= 0) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h}h ${r}m`;
}
