import { h, mount } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { renderIngredientParts } from '../lib/quantity.js';
import { StarRating } from './starRating.js';

// Renders the full reading view for a recipe — used both for transient parsed
// recipes (before save) and saved recipes (with extra detail blocks beside).
// `recipe`: the parsed recipe shape (or saved recipe with same fields).
// `opts`: { sideContent?: Node, headerActions?: Node[], onUpdate?: fn }
export function RecipeView(recipe, opts = {}) {
  const state = {
    servings: recipe.servings || 1,
    originalServings: recipe.servings || 1,
    ingredientDone: new Set(),
    instructionDone: new Set(),
  };

  const root = h('article.recipe-layout');

  // === Left column: title, image, instructions ===
  const left = h('div.recipe-left');
  root.appendChild(left);

  const header = renderHeader(recipe, state);
  left.appendChild(header);

  if (recipe.heroImage) {
    const heroBox = h('div.hero-image',
      h('img', { src: recipe.heroImage, alt: recipe.title, loading: 'lazy' })
    );
    left.appendChild(heroBox);
  }

  if (Array.isArray(opts.headerActions) && opts.headerActions.length) {
    const actions = h('div.recipe-actions', ...opts.headerActions);
    left.appendChild(actions);
  }

  // Instructions section
  const instrSection = h('section.recipe-instructions');
  instrSection.appendChild(h('h3.section-title', 'Instructions'));
  const instrList = h('ol.instructions');
  instrSection.appendChild(instrList);
  left.appendChild(instrSection);

  renderInstructions(instrList, recipe.instructions || [], state);

  // === Right column: servings + ingredients (sticky) ===
  const right = h('aside.recipe-right');
  const card = h('div.ingredients-card');
  right.appendChild(card);
  root.appendChild(right);

  // Build the ingredient list first so the servings stepper's update callback
  // can target it from the very first invocation (which fires synchronously
  // inside renderServingsControl to set the initial disabled/value state).
  const ingList = h('ul.ingredient-list');
  const rerenderIngredients = () => renderIngredients(ingList, recipe.ingredients || [], state);
  card.appendChild(renderServingsControl(state, rerenderIngredients, recipe.yieldText));
  card.appendChild(h('h3.section-title', 'Ingredients'));
  card.appendChild(ingList);
  rerenderIngredients();

  // Optional side content (notes editor, photos for saved recipes)
  if (opts.sideContent) {
    const extra = h('div', { style: { marginTop: 'var(--s-5)' } }, opts.sideContent);
    right.appendChild(extra);
  }

  return root;
}

function renderHeader(recipe, state) {
  const header = h('header.recipe-header');
  if (recipe.parseSource === 'json-ld' || recipe.parseSource === 'microdata') {
    header.appendChild(h('span.eyebrow', '✦ Parsed cleanly ✦'));
  } else if (recipe.parseSource === 'heuristic') {
    header.appendChild(h('span.eyebrow', '✦ Heuristic parse — double-check ✦'));
  } else if (recipe.parseSource === 'none') {
    header.appendChild(h('span.eyebrow', '✦ Limited recipe data ✦'));
  } else {
    header.appendChild(h('span.eyebrow', '✦ Recipe ✦'));
  }

  header.appendChild(h('h1', recipe.title || 'Untitled recipe'));

  if (recipe.description) {
    header.appendChild(h('p.description', recipe.description));
  }

  if (recipe.fetchedVia === 'reader-proxy') {
    const note = h('div.proxy-note', {}, [
      h('span', {}, ''), 'Pulled through a reader proxy (the site blocked direct access).'
    ]);
    note.querySelector('span').innerHTML = icon('sparkle');
    header.appendChild(note);
  }

  const meta = h('div.recipe-meta');
  const items = [];
  if (recipe.totalMinutes != null) {
    items.push(metaItem('Total time', formatMinutes(recipe.totalMinutes)));
  } else if (recipe.prepMinutes || recipe.cookMinutes) {
    items.push(metaItem('Total time', formatMinutes((recipe.prepMinutes || 0) + (recipe.cookMinutes || 0))));
  }
  if (recipe.prepMinutes != null && recipe.prepMinutes > 0) {
    items.push(metaItem('Prep', formatMinutes(recipe.prepMinutes)));
  }
  if (recipe.cookMinutes != null && recipe.cookMinutes > 0) {
    items.push(metaItem('Bake', formatMinutes(recipe.cookMinutes)));
  }
  if (recipe.yieldText || recipe.servings) {
    items.push(metaItem('Makes', recipe.yieldText || `${recipe.servings} servings`));
  }
  if (recipe.rating?.value || recipe.externalRating) {
    const v = recipe.rating?.value ?? recipe.externalRating;
    const c = recipe.rating?.count ?? recipe.externalRatingCount;
    const block = h('div.recipe-meta-item');
    block.appendChild(h('span.label', 'Rating'));
    const valueWrap = h('div', { style: { marginTop: '2px' } }, StarRating(v, c, { size: '1.1em' }));
    block.appendChild(valueWrap);
    items.push(block);
  }
  if (items.length === 0) {
    // Show source link in the meta row so it isn't entirely empty
    items.push(h('div.recipe-meta-item',
      h('span.label', 'Source'),
      h('span.value', { style: { fontSize: 'var(--step-1)' } }, prettyHost(recipe.sourceUrl || ''))
    ));
  } else if (recipe.sourceUrl) {
    items.push(h('div.recipe-meta-item',
      h('span.label', 'Source'),
      sourceLink(recipe.sourceUrl),
    ));
  }
  for (const i of items) meta.appendChild(i);
  header.appendChild(meta);

  return header;
}

function metaItem(label, value) {
  const block = h('div.recipe-meta-item');
  block.appendChild(h('span.label', label));
  block.appendChild(h('span.value', value));
  return block;
}

function sourceLink(url) {
  const a = h('a.source-link', { href: url, target: '_blank', rel: 'noopener noreferrer' });
  a.innerHTML = `${icon('external')}<span>${escapeText(prettyHost(url))}</span>`;
  return a;
}

function prettyHost(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch { return url; }
}

function formatMinutes(m) {
  if (!m || m <= 0) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return h === 1 ? '1 hr' : `${h} hr`;
  return `${h} hr ${r} min`;
}

function renderServingsControl(state, onChange, yieldText) {
  const wrap = h('div.servings-control');
  wrap.appendChild(h('span.label', 'Servings'));
  const stepper = h('div.stepper');
  const minus = h('button', { 'aria-label': 'Decrease servings', type: 'button' });
  minus.innerHTML = icon('minus');
  const valueEl = h('span.value', { 'aria-live': 'polite' }, String(state.servings));
  const plus = h('button', { 'aria-label': 'Increase servings', type: 'button' });
  plus.innerHTML = icon('plus');

  const update = () => {
    valueEl.textContent = String(state.servings);
    minus.disabled = state.servings <= 1;
    plus.disabled = state.servings >= 999;
    onChange();
  };
  minus.addEventListener('click', () => { if (state.servings > 1) { state.servings--; update(); } });
  plus.addEventListener('click',  () => { if (state.servings < 999) { state.servings++; update(); } });

  stepper.appendChild(minus);
  stepper.appendChild(valueEl);
  stepper.appendChild(plus);
  wrap.appendChild(stepper);

  update();
  return wrap;
}

function renderIngredients(host, ingredients, state) {
  mount(host);
  if (!ingredients.length) {
    host.appendChild(h('p.muted', { style: { padding: 'var(--s-3)' } }, 'No ingredients were found in this recipe.'));
    return;
  }
  const factor = state.servings / (state.originalServings || 1);
  ingredients.forEach((ing, idx) => {
    const parts = renderIngredientParts(ing, factor);
    const item = h('li.ingredient-item', { tabindex: '0', role: 'checkbox', 'aria-checked': state.ingredientDone.has(idx) ? 'true' : 'false' });
    if (state.ingredientDone.has(idx)) item.classList.add('done');

    const check = h('span.ingredient-check');
    check.innerHTML = icon('check');
    item.appendChild(check);

    const text = h('span.ingredient-text');
    if (parts.qty) {
      const qtySpan = h('span.qty', parts.qty);
      text.appendChild(qtySpan);
      text.appendChild(document.createTextNode(' '));
    }
    if (parts.unit) {
      const unitSpan = h('span.unit', parts.unit);
      text.appendChild(unitSpan);
      text.appendChild(document.createTextNode(' '));
    }
    text.appendChild(document.createTextNode(parts.name || ing.text || ''));
    item.appendChild(text);

    const toggle = () => {
      if (state.ingredientDone.has(idx)) {
        state.ingredientDone.delete(idx);
        item.classList.remove('done');
        item.setAttribute('aria-checked', 'false');
      } else {
        state.ingredientDone.add(idx);
        item.classList.add('done');
        item.setAttribute('aria-checked', 'true');
      }
    };
    item.addEventListener('click', toggle);
    item.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
    host.appendChild(item);
  });
}

function renderInstructions(host, instructions, state) {
  mount(host);
  if (!instructions.length) {
    host.appendChild(h('p.muted', 'No instructions were found in this recipe.'));
    return;
  }
  let stepCounter = 0;
  instructions.forEach((step, idx) => {
    if (step.isHeading && step.section) {
      host.appendChild(h('div.instruction-section', step.section));
      return;
    }
    stepCounter++;
    const li = h('li.instruction', { tabindex: '0', role: 'checkbox', 'aria-checked': state.instructionDone.has(idx) ? 'true' : 'false' });
    if (state.instructionDone.has(idx)) li.classList.add('done');
    li.appendChild(h('span.step-num', String(stepCounter)));
    li.appendChild(h('span.step-text', step.text || ''));
    const toggle = () => {
      if (state.instructionDone.has(idx)) {
        state.instructionDone.delete(idx);
        li.classList.remove('done');
        li.setAttribute('aria-checked', 'false');
      } else {
        state.instructionDone.add(idx);
        li.classList.add('done');
        li.setAttribute('aria-checked', 'true');
      }
    };
    li.addEventListener('click', toggle);
    li.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });
    host.appendChild(li);
  });
}

function escapeText(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
