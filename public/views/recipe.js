import { h, mount } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { RecipeView } from '../components/recipeView.js';
import { Breadcrumb } from '../components/breadcrumb.js';
import { openSaveRecipeFlow } from '../components/editors.js';
import { navigate } from '../lib/router.js';
import { addRecentlyViewed } from '../lib/recentlyViewed.js';
import * as toast from '../lib/toast.js';

// View shown after pasting a URL. Renders a loading state, calls /api/parse,
// then renders RecipeView with a "Save to cookbook" action.
export async function ParsedRecipeView({ url }) {
  const root = h('div.container');
  root.appendChild(loadingSkeleton());

  try {
    const { recipe } = await api.parseUrl(url);
    // Track this view locally so the home page can surface it even when
    // the user doesn't save the recipe.
    addRecentlyViewed({
      kind: 'parsed',
      url: recipe.sourceUrl || url,
      title: recipe.title,
      heroImage: recipe.heroImage,
      totalMinutes: recipe.totalMinutes,
      externalRating: recipe.rating?.value,
    });
    mount(root);
    root.appendChild(Breadcrumb([
      { label: 'Home', href: '#/', icon: 'home' },
      { label: recipe.title || 'New recipe' },
    ]));
    const view = RecipeView(recipe, {
      headerActions: buildHeaderActions(recipe),
    });
    root.appendChild(view);
  } catch (e) {
    mount(root);
    root.appendChild(renderError(e, url));
  }
  return root;
}

function buildHeaderActions(recipe) {
  const save = h('button.btn.btn-primary');
  save.innerHTML = `${icon('bookmarkFilled')}<span>Save to cookbook</span>`;
  save.addEventListener('click', () => {
    openSaveRecipeFlow({
      recipe,
      onSave: (saved) => navigate(`/saved/${saved.id}`),
    });
  });

  const print = h('button.btn.btn-secondary');
  print.innerHTML = `${icon('print')}<span>Print</span>`;
  print.addEventListener('click', () => window.print());

  const actions = [save, print];
  if (recipe.sourceUrl) {
    const source = h('a.btn.btn-ghost', { href: recipe.sourceUrl, target: '_blank', rel: 'noopener noreferrer' });
    source.innerHTML = `${icon('external')}<span>Original</span>`;
    actions.push(source);
  }
  return actions;
}

function loadingSkeleton() {
  const wrap = h('div.recipe-layout', { 'aria-busy': 'true' });
  const left = h('div.stack-5');
  left.appendChild(h('div.skeleton.skeleton-line', { style: { height: 'var(--step-1)', width: '40%' } }));
  left.appendChild(h('div.skeleton.skeleton-line', { style: { height: 'var(--step-4)', width: '80%' } }));
  left.appendChild(h('div.skeleton.skeleton-line', { style: { height: '1em' } }));
  left.appendChild(h('div.skeleton.skeleton-line.short'));
  left.appendChild(h('div.skeleton', { style: { aspectRatio: '16/10', borderRadius: 'var(--r-xl)', marginTop: 'var(--s-4)' } }));
  wrap.appendChild(left);

  const right = h('div.stack-3');
  for (let i = 0; i < 8; i++) right.appendChild(h('div.skeleton.skeleton-line', { style: { height: '1.4em' } }));
  right.style.maxWidth = '380px';
  wrap.appendChild(right);

  return wrap;
}

function renderError(err, url) {
  const wrap = h('div.container-narrow', { style: { padding: 'var(--s-8) var(--s-6)' } });
  const empty = h('div.empty');
  empty.appendChild(h('div.empty-illustration', { html: icon('daisy') }));
  empty.appendChild(h('h3', 'We couldn’t reach this recipe'));
  empty.appendChild(h('p', err.message || 'Something went wrong while fetching this page.'));
  if (url) {
    empty.appendChild(h('p.muted', { style: { marginTop: 'var(--s-3)' } }, `URL: ${url}`));
  }
  empty.appendChild(h('p.muted', { style: { marginTop: 'var(--s-3)', maxWidth: '52ch', margin: 'var(--s-4) auto 0' } },
    'Some sites use aggressive bot protection that blocks our server. The Chrome extension runs inside your browser, so it gets through. Try installing the extension and using the toolbar icon on that page.'));
  const back = h('button.btn.btn-primary', { style: { marginTop: 'var(--s-5)' }, type: 'button' });
  back.innerHTML = `${icon('arrowLeft')}<span>Back home</span>`;
  back.addEventListener('click', () => navigate('/'));
  empty.appendChild(back);
  wrap.appendChild(empty);
  return wrap;
}
