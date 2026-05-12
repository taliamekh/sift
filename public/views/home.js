import { h, mount } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { openCookbookEditor } from '../components/editors.js';
import * as toast from '../lib/toast.js';
import { StarRating } from '../components/starRating.js';
import { getRecentlyViewed } from '../lib/recentlyViewed.js';

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
  // Glyph in an explicitly-sized span — relying on CSS width on a raw <svg>
  // without a width attribute is unreliable; wrapping fixes it.
  const glyph = h('span.input-icon-glyph', { 'aria-hidden': 'true' });
  glyph.innerHTML = icon('link');
  inputWrap.appendChild(glyph);
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

  // Recent recipes — pulled from localStorage so URLs the user only
  // viewed (didn't save) still show up here.
  const recentSection = h('section');
  recentSection.appendChild(h('div.section-head', h('h2', 'Recently Viewed')));
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

    // Render recently-viewed recipes from localStorage
    mount(recentGrid);
    const viewed = getRecentlyViewed();
    if (!viewed.length) {
      const empty = h('div.empty');
      empty.innerHTML = `<div class="empty-illustration">${icon('bookmark')}</div>
        <h3>Nothing viewed yet</h3>
        <p>Paste a recipe URL above. We'll keep a list here so you can come back to it whether you save it or not.</p>`;
      recentGrid.appendChild(empty);
      return;
    }
    viewed.forEach(v => recentGrid.appendChild(viewedCard(v)));
  }

  await render();
  return root;
}

function cookbookCard(cb) {
  // A cookbook card *looks* like a physical book: spine on the left,
  // colored cover (or full-bleed image) with the icon and title, page
  // stack peeking out on the right edge.
  const card = h('button.cookbook-card', { type: 'button' });
  card.style.setProperty('--cover', cb.coverColor || '#F8B4D9');
  if (cb.coverImage) {
    card.setAttribute('data-cover', 'image');
    card.style.setProperty('--cover-image', `url(${JSON.stringify(cb.coverImage)})`);
  } else {
    card.setAttribute('data-cover', 'color');
  }

  const content = h('div.cookbook-cover-content');

  const iconWrap = h('div.cookbook-cover-icon');
  if (!cb.coverImage) iconWrap.innerHTML = icon(cb.coverIcon || 'cupcake');
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

function viewedCard(v) {
  // Recently-viewed entries come from localStorage. Saved ones link to their
  // detail page; parsed ones replay the URL through the parser.
  const card = h('button.recipe-card', { type: 'button' });
  const imgWrap = h('div.recipe-card-image');
  if (v.heroImage) {
    imgWrap.appendChild(h('img', { src: v.heroImage, alt: v.title, loading: 'lazy' }));
  } else {
    const ph = h('div.placeholder');
    ph.innerHTML = icon('image');
    imgWrap.appendChild(ph);
  }
  // Small badge in the corner so users can tell at a glance whether a card
  // is in their cookbook or just a quick parse-and-go.
  if (v.kind === 'saved') {
    const badge = h('span.recipe-card-tab', { style: { background: 'var(--pink-400)' } }, 'Saved');
    imgWrap.appendChild(badge);
  }
  card.appendChild(imgWrap);

  const content = h('div.recipe-card-content');
  content.appendChild(h('h4', v.title));
  const metaRow = h('div.recipe-card-meta');
  const parts = [];
  if (v.totalMinutes) {
    const span = h('span');
    span.innerHTML = `${icon('clock')}<span style="margin-left:4px">${formatMinutes(v.totalMinutes)}</span>`;
    parts.push(span);
  }
  if (v.externalRating) {
    parts.push(StarRating(v.externalRating, null, { size: '0.95em' }));
  }
  parts.forEach((p, i) => {
    if (i > 0) metaRow.appendChild(h('span.dot', '·'));
    metaRow.appendChild(p);
  });
  content.appendChild(metaRow);
  card.appendChild(content);
  card.addEventListener('click', () => {
    if (v.kind === 'saved' && v.id != null) navigate(`/saved/${v.id}`);
    else if (v.url) navigate('/recipe?' + new URLSearchParams({ url: v.url }));
  });
  return card;
}

function formatMinutes(m) {
  if (!m || m <= 0) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h}h ${r}m`;
}
