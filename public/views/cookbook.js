import { h, mount, $$ } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { StarRating } from '../components/starRating.js';
import { Breadcrumb } from '../components/breadcrumb.js';
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

    // Breadcrumb
    root.appendChild(Breadcrumb([
      { label: 'Home', href: '#/', icon: 'home' },
      { label: state.cookbook.name },
    ]));

    // Header
    const header = h('header.cookbook-header');
    const spine = h('div.cookbook-spine');
    spine.style.setProperty('--cover-text', state.cookbook.coverTextColor || '#FFFFFF');
    if (state.cookbook.coverImage) {
      spine.style.background = `center/cover no-repeat url(${JSON.stringify(state.cookbook.coverImage)})`;
      spine.setAttribute('data-cover', 'image');
    } else {
      spine.style.background = state.cookbook.coverColor || '#F8B4D9';
    }
    // Icon renders on every spine — even image-backed ones — so the user's
    // chosen category glyph is consistent between the home card and detail.
    // 'none' is the explicit no-icon sentinel: blank spine.
    if (state.cookbook.coverIcon && state.cookbook.coverIcon !== 'none') {
      spine.innerHTML = icon(state.cookbook.coverIcon);
    }
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

    // Book layout: paper-textured page on the left with tabs sticking out on
    // the right edge like a recipe binder.
    const book = h('div.cookbook-book');

    const page = h('div.cookbook-page');
    page.style.borderLeftColor = state.cookbook.coverColor || '#F8B4D9';
    book.appendChild(page);

    // Page header — current tab name as a section title on the page
    const activeTab = state.activeTabId ? state.tabs.find(t => t.id === state.activeTabId) : null;
    const pageHead = h('div.cookbook-page-head');
    if (activeTab) {
      const iconHtml = activeTab.icon ? `<span class="ph-icon">${icon(activeTab.icon)}</span>` : '';
      pageHead.innerHTML = `${iconHtml}<h2 style="color:${darken(activeTab.color)}">${escapeText(activeTab.name)}</h2>`;
    } else {
      pageHead.innerHTML = `<h2>All recipes</h2>`;
    }
    page.appendChild(pageHead);

    // Recipes
    const recipesToShow = state.activeTabId
      ? state.recipes.filter(r => r.tabId === state.activeTabId)
      : state.recipes;

    if (!recipesToShow.length) {
      const empty = h('div.empty');
      empty.appendChild(h('div.empty-illustration', { html: icon('bookmark') }));
      empty.appendChild(h('h3', state.activeTabId ? 'Nothing in this tab yet' : 'No recipes in this cookbook'));
      empty.appendChild(h('p', state.activeTabId
        ? 'Save a recipe and drop it in this tab from the recipe page.'
        : 'Paste a recipe URL from the home page to get started.'));
      const cta = h('button.btn.btn-primary', { style: { marginTop: 'var(--s-4)' }, onClick: () => navigate('/') });
      cta.innerHTML = `${icon('home')}<span>Back home</span>`;
      empty.appendChild(cta);
      page.appendChild(empty);
    } else {
      const grid = h('div.recipe-grid');
      recipesToShow.forEach(r => grid.appendChild(recipeCard(r, state)));
      page.appendChild(grid);
    }

    // Side tabs (right edge of the book)
    const tabsNav = h('nav.cookbook-tabs', { role: 'tablist', 'aria-label': 'Cookbook sections' });

    const allTab = h('button.cookbook-tab', {
      type: 'button',
      role: 'tab',
      'aria-selected': state.activeTabId == null ? 'true' : 'false',
      style: { background: 'var(--pink-200)' },
    });
    const allDark = darken('#FFD0E3');
    allTab.innerHTML = `<span class="ct-label" style="color:${allDark}">All</span><span class="ct-count" style="color:${allDark}">${state.recipes.length}</span>`;
    allTab.addEventListener('click', () => { state.activeTabId = null; render(); });
    tabsNav.appendChild(allTab);

    state.tabs.forEach(t => {
      const tab = h('button.cookbook-tab', {
        type: 'button',
        role: 'tab',
        'aria-selected': state.activeTabId === t.id ? 'true' : 'false',
        style: { background: t.color },
      });
      const dark = darken(t.color);
      const iconHtml = t.icon ? `<span class="ct-icon" style="color:${dark}">${icon(t.icon)}</span>` : '';
      tab.innerHTML = `${iconHtml}<span class="ct-label" style="color:${dark}">${escapeText(t.name)}</span><span class="ct-count" style="color:${dark}">${t.recipeCount}</span>`;
      tab.addEventListener('click', () => { state.activeTabId = t.id; render(); });

      // Edit affordance: a small pencil button that appears on hover/focus.
      const editBtn = h('button.ct-edit', {
        type: 'button',
        'aria-label': `Edit tab ${t.name}`,
        title: 'Edit this tab',
      });
      editBtn.innerHTML = icon('edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTabEditor({ tab: t, cookbookId: state.cookbook.id, onSave: () => load() });
      });
      tab.appendChild(editBtn);

      tabsNav.appendChild(tab);
    });

    const newTab = h('button.cookbook-tab.cookbook-tab-new', { type: 'button' });
    newTab.innerHTML = `<span class="ct-icon">${icon('plus')}</span><span class="ct-label">New tab</span>`;
    newTab.addEventListener('click', () => {
      openTabEditor({ cookbookId: state.cookbook.id, onSave: () => load() });
    });
    tabsNav.appendChild(newTab);

    book.appendChild(tabsNav);
    root.appendChild(book);
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
