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

  const header = renderHeader(recipe, state, opts);
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
  // The MAKES meta cell at the top of the page lives-updates whenever the
  // user adjusts the multiplier — so the printed output reflects the
  // actually-cooked batch, not just the recipe's nominal yield.
  const makesValueEl = root.querySelector('.recipe-meta-makes .value');
  const rerenderIngredients = () => {
    renderIngredients(ingList, recipe.ingredients || [], state);
    if (makesValueEl) {
      makesValueEl.textContent = formatMakes(state.servings, recipe.yieldText, recipe.servings);
    }
  };
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

function renderHeader(recipe, state, opts = {}) {
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

  if (opts.editableTitle) {
    const titleEl = h('h1.editable-title', {
      contentEditable: 'plaintext-only',
      spellcheck: 'false',
      title: 'Click to rename',
    }, recipe.title || 'Untitled recipe');
    const commit = () => {
      const next = titleEl.textContent.trim();
      if (!next || next === (recipe.title || '').trim()) return;
      if (typeof opts.onTitleChange === 'function') opts.onTitleChange(next);
      recipe.title = next;
    };
    titleEl.addEventListener('blur', commit);
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
      if (e.key === 'Escape') { titleEl.textContent = recipe.title || ''; titleEl.blur(); }
    });
    header.appendChild(titleEl);
  } else {
    header.appendChild(h('h1', recipe.title || 'Untitled recipe'));
  }

  // Description intentionally omitted — the recipe site's "intro paragraph"
  // is exactly the prose the user came here to skip.

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
    // Tagged with .recipe-meta-makes so the servings stepper can find this
    // value element and update it live as the multiplier changes.
    const block = h('div.recipe-meta-item.recipe-meta-makes');
    block.appendChild(h('span.label', 'Makes'));
    block.appendChild(h('span.value', formatMakes(state.servings, recipe.yieldText, recipe.servings)));
    items.push(block);
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

// Format "Makes" with the *scaled* serving count. Splits the recipe's
// yieldText into [number, unit] and swaps the number for the user's current
// servings ("12 cupcakes" + 24 → "24 cupcakes"). If yieldText is just a
// number or missing, falls back to "{servings}" or "{servings} servings".
function formatMakes(currentServings, yieldText, originalServings) {
  const n = currentServings || originalServings || 1;
  if (yieldText) {
    const m = String(yieldText).match(/^\s*\d+(?:[.,]\d+)?\s*(.*)$/);
    if (m) {
      const unit = m[1].trim();
      return unit ? `${n} ${unit}` : String(n);
    }
    return String(yieldText);
  }
  return `${n} servings`;
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

// Servings stepper that scales by clean ratios instead of single-serving
// increments. Stepping by 1 produces gross fractions (11/12 → 0.92 cup,
// 1.83 eggs); stepping by ratios like ½× / ⅔× / 1× / 1½× / 2× keeps every
// ingredient quantity rounded to a sensible cooking fraction.
const SCALE_RATIOS = [
  { mul: 1 / 4, label: '¼' },
  { mul: 1 / 3, label: '⅓' },
  { mul: 1 / 2, label: '½' },
  { mul: 2 / 3, label: '⅔' },
  { mul: 3 / 4, label: '¾' },
  { mul: 1,     label: '1' },
  { mul: 3 / 2, label: '1½' },
  { mul: 2,     label: '2' },
  { mul: 3,     label: '3' },
  { mul: 4,     label: '4' },
];
const DEFAULT_RATIO_INDEX = SCALE_RATIOS.findIndex(r => r.mul === 1);

function renderServingsControl(state, onChange, yieldText) {
  state.ratioIndex = DEFAULT_RATIO_INDEX;
  state.scaleFactor = 1;

  const wrap = h('div.servings-control');
  const labelCol = h('div.servings-label-col');
  labelCol.appendChild(h('span.label', 'Makes'));
  labelCol.appendChild(h('span.servings-multiplier-badge', '× 1'));
  wrap.appendChild(labelCol);

  const stepper = h('div.stepper');
  const minus = h('button', { 'aria-label': 'Smaller batch', type: 'button' });
  minus.innerHTML = icon('minus');
  const valueEl = h('span.value', { 'aria-live': 'polite' });
  const plus = h('button', { 'aria-label': 'Larger batch', type: 'button' });
  plus.innerHTML = icon('plus');

  const badge = labelCol.querySelector('.servings-multiplier-badge');

  const update = () => {
    const ratio = SCALE_RATIOS[state.ratioIndex];
    state.scaleFactor = ratio.mul;
    state.servings = Math.max(1, Math.round((state.originalServings || 1) * ratio.mul));
    valueEl.textContent = String(state.servings);
    badge.textContent = `× ${ratio.label}`;
    // Highlight when the recipe has been scaled away from the original 1× so
    // users notice they're working with an adjusted batch.
    badge.classList.toggle('is-scaled', ratio.mul !== 1);
    minus.disabled = state.ratioIndex <= 0;
    plus.disabled = state.ratioIndex >= SCALE_RATIOS.length - 1;
    onChange();
  };
  minus.addEventListener('click', () => { if (state.ratioIndex > 0) { state.ratioIndex--; update(); } });
  plus.addEventListener('click',  () => { if (state.ratioIndex < SCALE_RATIOS.length - 1) { state.ratioIndex++; update(); } });

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
  // Use the exact ratio multiplier set by renderServingsControl rather than
  // dividing the (rounded) display servings by the original — otherwise our
  // ingredient quantities lose precision after rounding the servings label.
  const factor = state.scaleFactor != null ? state.scaleFactor : (state.servings / (state.originalServings || 1));
  ingredients.forEach((ing, idx) => {
    const parts = renderIngredientParts(ing, factor);
    const { name, note } = splitOffNote(parts.name || ing.text || '');

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
    text.appendChild(document.createTextNode(name));

    if (note) {
      const noteEl = h('span.ing-note');
      const arrow = h('span.ing-note-arrow', { 'aria-hidden': 'true' });
      arrow.innerHTML = icon('arrowRight');
      noteEl.appendChild(arrow);
      noteEl.appendChild(h('em', note));
      text.appendChild(noteEl);
    }

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

// Pulls the trailing parenthetical out of the ingredient name and renders
// it as a separate "note" line. Real-world quirks handled:
//   - parens often nest ("X ((Y, Note 1))" or "X (Y (Note 1))") — we
//     depth-count back from the closing paren to find its true match,
//     then unwrap one extra layer of fully-wrapped parens
//   - some sources prefix the note with stranded commas/slashes
//     ("(, cut into cubes)") — strip those
//   - broken-parser data from older saves may leave the name itself
//     starting with "," or "/" — strip those too
function splitOffNote(text) {
  if (!text) return { name: '', note: null };
  let s = text.replace(/\s+/g, ' ').trim().replace(/^[,/]\s*/, '');
  if (!s.endsWith(')')) return { name: s.trim(), note: null };

  // Walk back from the final ')' to find its matching '('.
  let depth = 1;
  let i = s.length - 2;
  for (; i >= 0; i--) {
    if (s[i] === ')') depth++;
    else if (s[i] === '(') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (i < 0 || depth !== 0) return { name: s.trim(), note: null };

  // Content between the outer matching parens.
  let noteContent = s.slice(i + 1, -1).trim();

  // Unwrap one extra layer when the content itself is fully bracketed —
  // covers the "((Note 1))" → "Note 1" case while leaving inline parens
  // like "50g / 2oz each, Note 3" alone.
  if (noteContent.startsWith('(') && noteContent.endsWith(')')) {
    const inner = noteContent.slice(1, -1);
    let d = 0, balanced = true;
    for (const c of inner) {
      if (c === '(') d++;
      else if (c === ')') { d--; if (d < 0) { balanced = false; break; } }
    }
    if (balanced && d === 0) noteContent = inner.trim();
  }

  noteContent = noteContent.replace(/^[,\s/]+/, '').trim();
  let prefix = s.slice(0, i).trim().replace(/[,\s]+$/, '');
  if (!noteContent) return { name: s.trim(), note: null };
  return { name: prefix, note: noteContent };
}

function escapeText(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
