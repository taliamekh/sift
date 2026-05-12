// Entry point — routes hash URLs to views and renders them into #app.

import { $, mount, h } from './lib/h.js';
import { icon } from './lib/icons.js';
import { route, startRouter, currentPath } from './lib/router.js';
import { HomeView } from './views/home.js';
import { ParsedRecipeView } from './views/recipe.js';
import { CookbookView } from './views/cookbook.js';
import { SavedRecipeView } from './views/savedRecipe.js';
// Inject the brand mark SVG into the topbar
const brandMark = $('.brand-mark');
if (brandMark) brandMark.innerHTML = icon('whisk');

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

route('/', () => renderView(() => HomeView()));

route('/recipe', ({ query }) => {
  const url = query.get('url');
  if (!url) return renderView(() => HomeView());
  renderView(() => ParsedRecipeView({ url }));
});

route('/cookbook/:id', ({ params }) => renderView(() => CookbookView({ id: params.id })));
route('/saved/:id', ({ params }) => renderView(() => SavedRecipeView({ id: params.id })));

startRouter();
