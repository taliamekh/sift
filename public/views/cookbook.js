import { h, mount, $$ } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { StarRating } from '../components/starRating.js';
import { openCookbookEditor, openTabEditor } from '../components/editors.js';
import * as toast from '../lib/toast.js';

export async function CookbookView({ id }) {
  const root = h('div.container.stack-6');
  root.appendChild(h('p.muted', 'Loading cookbook…'));

  let state = { cookbook: null, tabs: [], recipes: [], activeTabId: null };

  async function load() {
    try {
      const detail = await api.getCookbook(id);
      state.cookbook = detail.cookbook;
      state.tabs = detail.tabs;
      state.recipes = detail.recipes;
      if (state.activeTabId && !state.tabs.find(t => t.id === state.activeTabId)) {
        state.activeTabId = null;
      }
      render();
    } catch (e) {
      mount(root);
      root.appendChild(h('div.empty',
        h('div.empty-illustration', { html: icon('bowl') }),
        h('h3', 'Cookbook not found'),
        h('p.muted', e.message),
        h('button.btn.btn-primary', { style: { marginTop: 'var(--s-4)' }, onClick: () => navigate('/') }, 'Back home'),
      ));
    }
  }

  function render() {
    mount(root);

    // Back nav
    const back = h('button.btn.btn-ghost.btn-sm', { type: 'button', onClick: () => navigate('/') });
    back.innerHTML = `${icon('arrowLeft')}<span>All cookbooks</span>`;
    root.appendChild(back);

    // Header
    const header = h('header.cookbook-header');
    const spine = h('div.cookbook-spine');
    spine.style.background = state.cookbook.coverColor || '#F8B4D9';
    spine.innerHTML = icon(state.cookbook.coverIcon || 'cupcake');
    header.appendChild(spine);

    const info = h('div.flex-1');
    info.appendChild(h('span.eyebrow', 'Cookbook'));
    info.appendChild(h('h1', state.cookbook.name));
    if (state.cookbook.description) info.appendChild(h('p.description', state.cookbook.description));

    const row = h('div.row');
    const edit = h('button.btn.btn-secondary.btn-sm', { type: 'button' });
    edit.innerHTML = `${icon('edit')}<span>Customize</span>`;
    edit.addEventListener('click', () => openCookbookEditor({
      cookbook: state.cookbook,
      onSave: ({ deleted } = {}) => deleted ? navigate('/') : load(),
    }));
    row.appendChild(edit);

    const count = state.recipes.length;
    row.appendChild(h('span.tag', `${count} recipe${count === 1 ? '' : 's'}`));
    info.appendChild(row);
    header.appendChild(info);
    root.appendChild(header);

    // Tab bar
    const tabBar = h('nav.tab-bar', { role: 'tablist' });
    const allTab = h('button.tab', { type: 'button', role: 'tab', 'aria-selected': state.activeTabId == null ? 'true' : 'false' });
    allTab.innerHTML = `<span class="tab-color" style="background: var(--pink-200)"></span><span>All</span><span class="tab-count">${state.recipes.length}</span>`;
    allTab.addEventListener('click', () => { state.activeTabId = null; render(); });
    tabBar.appendChild(allTab);

    state.tabs.forEach(t => {
      const tab = h('button.tab', { type: 'button', role: 'tab', 'aria-selected': state.activeTabId === t.id ? 'true' : 'false' });
      const iconHtml = t.icon ? icon(t.icon) : '';
      tab.innerHTML = `<span class="tab-color" style="background: ${t.color}"></span>${iconHtml ? `<span class="tab-icon" style="display:inline-flex;width:16px;height:16px;color:${darken(t.color)}">${iconHtml}</span>` : ''}<span>${escapeText(t.name)}</span><span class="tab-count">${t.recipeCount}</span>`;
      tab.addEventListener('click', () => { state.activeTabId = t.id; render(); });
      // Right-click / long-press → edit
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openTabEditor({
          tab: t,
          cookbookId: state.cookbook.id,
          onSave: () => load(),
        });
      });
      // Double-click to edit too (more discoverable than right-click)
      tab.addEventListener('dblclick', () => {
        openTabEditor({
          tab: t,
          cookbookId: state.cookbook.id,
          onSave: () => load(),
        });
      });
      tabBar.appendChild(tab);
    });

    const newTab = h('button.tab.tab-new', { type: 'button' });
    newTab.innerHTML = `${icon('plus')}<span>New tab</span>`;
    newTab.addEventListener('click', () => {
      openTabEditor({
        cookbookId: state.cookbook.id,
        onSave: () => load(),
      });
    });
    tabBar.appendChild(newTab);
    root.appendChild(tabBar);

    // Edit-tab hint
    if (state.tabs.length > 0) {
      root.appendChild(h('p.muted', { style: { fontSize: 'var(--step--1)', marginTop: '-12px' } }, 'Tip: double-click a tab to rename or recolor it.'));
    }

    // Recipes
    const recipesToShow = state.activeTabId
      ? state.recipes.filter(r => r.tabId === state.activeTabId)
      : state.recipes;

    if (!recipesToShow.length) {
      const empty = h('div.empty');
      empty.appendChild(h('div.empty-illustration', { html: icon('bookmark') }));
      empty.appendChild(h('h3', state.activeTabId ? 'Nothing in this tab yet' : 'No recipes in this cookbook'));
      empty.appendChild(h('p', state.activeTabId
        ? 'Save a recipe to this tab from the recipe page, or drag one here.'
        : 'Paste a recipe URL from the home page to get started.'));
      const cta = h('button.btn.btn-primary', { style: { marginTop: 'var(--s-4)' }, onClick: () => navigate('/') });
      cta.innerHTML = `${icon('home')}<span>Back home</span>`;
      empty.appendChild(cta);
      root.appendChild(empty);
      return;
    }

    const grid = h('div.recipe-grid');
    recipesToShow.forEach(r => grid.appendChild(recipeCard(r, state)));
    root.appendChild(grid);
  }

  load();
  return root;
}

function recipeCard(r, state) {
  const card = h('button.recipe-card', { type: 'button' });
  const imgWrap = h('div.recipe-card-image');
  if (r.heroImage) {
    imgWrap.appendChild(h('img', { src: r.heroImage, alt: r.title, loading: 'lazy' }));
  } else {
    const ph = h('div.placeholder');
    ph.innerHTML = icon('image');
    imgWrap.appendChild(ph);
  }
  // Tab pill overlay
  if (r.tabId) {
    const tab = state.tabs.find(t => t.id === r.tabId);
    if (tab) {
      const pill = h('span.recipe-card-tab', { style: { background: tab.color } }, tab.name);
      imgWrap.appendChild(pill);
    }
  }
  card.appendChild(imgWrap);

  const content = h('div.recipe-card-content');
  content.appendChild(h('h4', r.title));

  const metaParts = [];
  if (r.totalMinutes) {
    const sp = h('span');
    sp.innerHTML = `${icon('clock')}<span style="margin-left:4px">${formatMinutes(r.totalMinutes)}</span>`;
    metaParts.push(sp);
  }
  const rating = r.userRating ?? r.externalRating;
  if (rating) metaParts.push(StarRating(rating, null, { size: '0.95em' }));

  const meta = h('div.recipe-card-meta');
  metaParts.forEach((p, i) => {
    if (i > 0) meta.appendChild(h('span.dot', '·'));
    meta.appendChild(p);
  });
  content.appendChild(meta);
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

function darken(hex) {
  // Returns a darker form for icon contrast on the tab color dot. Simple
  // multiply by 0.55 in RGB.
  if (!hex?.startsWith('#') || hex.length !== 7) return 'currentColor';
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * 0.55);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * 0.55);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * 0.55);
  return `rgb(${r}, ${g}, ${b})`;
}

function escapeText(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
