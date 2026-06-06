// Entry point — routes hash URLs to views and renders them into #app.
// Also wires up the nav auth widget on boot and adds a /signin route that
// hosts the email magic-link sign-in card.

import { $, mount, h } from './lib/h.js';
import { icon } from './lib/icons.js';
import { route, startRouter, currentPath } from './lib/router.js';
import { onAuthChange } from './lib/supabase.js';
import { mountNavAuth, SignInCard } from './lib/authUI.js';
import { HomeView } from './views/home.js';
import { ParsedRecipeView } from './views/recipe.js';
import { CookbookView } from './views/cookbook.js';
import { SavedRecipeView } from './views/savedRecipe.js';
// Inject the brand mark SVG into the topbar — chef hat to match the favicon
const brandMark = $('.brand-mark');
if (brandMark) brandMark.innerHTML = icon('chefHat');

// "← Portfolio" only makes sense when sift is hosted at mekh.ca/sift/. When
// someone clones this repo and runs it locally (or hosts it elsewhere), the
// link goes nowhere — remove it. The subtree on the website keeps it visible
// because the URL path starts with /sift/ there.
const navBack = $('.nav-back');
if (navBack && !window.location.pathname.startsWith('/sift/')) navBack.remove();

const app = $('#app');

async function renderView(factory) {
  // Subtle fade transition between views
  app.style.transition = 'opacity 140ms';
  app.style.opacity = '0.4';
  const view = await factory();
  mount(app, view);
  requestAnimationFrame(() => { app.style.opacity = '1'; window.scrollTo({ top: 0, behavior: 'instant' }); });
  updateNavHighlight();
}

function updateNavHighlight() {
  const path = currentPath();
  document.querySelectorAll('.nav-link').forEach(link => {
    const r = link.getAttribute('data-route');
    if (r === path) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

// Hydrate the nav auth widget (sign in/out + user email).
mountNavAuth($('#nav-auth'));

// Re-render the current view whenever auth state flips so home swaps between
// "sign in to save" and "your cookbooks" without a manual refresh. Ignore
// no-op events (TOKEN_REFRESHED) where the user identity didn't change.
let lastUserId = null;
onAuthChange(user => {
  const nextId = user?.id || null;
  if (nextId === lastUserId) return;
  lastUserId = nextId;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

route('/', () => renderView(() => HomeView()));

route('/signin', () => renderView(() => {
  const root = h('div.container.stack-7');
  root.appendChild(SignInCard());
  return root;
}));

route('/recipe', ({ query }) => {
  const url = query.get('url');
  if (!url) return renderView(() => HomeView());
  renderView(() => ParsedRecipeView({ url }));
});

route('/cookbook/:id', ({ params }) => renderView(() => CookbookView({ id: params.id })));
route('/saved/:id', ({ params, query }) => renderView(() => SavedRecipeView({
  id: params.id,
  fallbackUrl: query.get('fallback') || null,
})));

startRouter();
