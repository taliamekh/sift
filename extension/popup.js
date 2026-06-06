// Popup orchestrator: get the active tab, run our parser in its context,
// render the result. If our local server is running, offer to save to a
// cookbook; otherwise show an "Open in app" button that requires the server.

const SERVER = 'http://localhost:4747';

const root = document.getElementById('popup-root');
const brandMark = document.querySelector('.brand-mark');
brandMark.innerHTML = window.Sift.icon('whisk');

const openAppBtn = document.getElementById('open-app');
let lastRecipe = null;

init();

async function init() {
  showState({
    spinner: true,
    title: 'Skimming the page…',
    body: 'Looking for the actual recipe so you can skip the story.',
  });

  const tab = await getActiveTab();
  if (!tab) {
    return showError("Couldn't find an active tab.");
  }
  if (!/^https?:/.test(tab.url || '')) {
    return showError(
      'Open a recipe page first, then click the Sift icon.',
      'The popup only works on regular web pages.'
    );
  }

  try {
    const [scriptResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/quantity.js', 'lib/parser.js'],
    });
  } catch (e) {
    return showError('Could not run on this page.', e.message);
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.Sift?.extractRecipe?.() || null,
  });

  if (!result || (!result.ingredients?.length && !result.instructions?.length)) {
    return showState({
      icon: 'flower',
      title: "We couldn't find a recipe here",
      body: 'This page might not be a recipe page, or it doesn’t expose structured data we can read.',
    });
  }

  lastRecipe = result;
  renderRecipe(result);
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (typeof v === 'boolean') v && node.setAttribute(k, '');
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function showState({ spinner = false, icon = 'sparkle', title, body }) {
  root.innerHTML = '';
  const state = el('div', { class: 'state' });
  if (spinner) state.appendChild(el('div', { class: 'spinner' }));
  else state.innerHTML = window.Sift.icon(icon);
  state.appendChild(el('h2', {}, title));
  if (body) state.appendChild(el('p', {}, body));
  root.appendChild(state);
}

function showError(title, body) {
  showState({ icon: 'flower', title, body });
}

function formatMinutes(m) {
  if (!m || m <= 0) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? (h === 1 ? '1 hr' : `${h} hr`) : `${h}h ${r}m`;
}

function renderRecipe(recipe) {
  root.innerHTML = '';

  // Title only — the long description is exactly what we're skipping.
  if (recipe.title) root.appendChild(el('h1', { class: 'r-title' }, recipe.title));

  // Meta
  const metaItems = [];
  if (recipe.totalMinutes) metaItems.push(metaItem('Total', formatMinutes(recipe.totalMinutes)));
  if (recipe.prepMinutes)  metaItems.push(metaItem('Prep',  formatMinutes(recipe.prepMinutes)));
  if (recipe.cookMinutes)  metaItems.push(metaItem('Bake',  formatMinutes(recipe.cookMinutes)));
  if (recipe.yieldText)    metaItems.push(metaItem('Makes', recipe.yieldText));
  if (metaItems.length) {
    const meta = el('div', { class: 'r-meta' });
    metaItems.forEach(i => meta.appendChild(i));
    root.appendChild(meta);
  }

  if (recipe.rating?.value) {
    const ratingRow = el('div', { class: 'r-meta', style: 'display:flex; align-items:center; gap:8px;' });
    ratingRow.appendChild(renderStars(recipe.rating.value, recipe.rating.count));
    root.insertBefore(ratingRow, root.querySelector('.r-meta'));
  }

  // Servings + Ingredients
  if (recipe.ingredients?.length) {
    const section = el('section', { class: 'section' });
    section.appendChild(el('div', { class: 'section-h' }, 'Ingredients'));

    const originalServings = recipe.servings || 1;
    // Ratio-based scaling — same logic as the web app. Stepping by clean
    // fractions keeps quantities sensible (no 1.83 eggs).
    const RATIOS = [
      { mul: 1 / 4, label: '¼' }, { mul: 1 / 3, label: '⅓' },
      { mul: 1 / 2, label: '½' }, { mul: 2 / 3, label: '⅔' },
      { mul: 3 / 4, label: '¾' }, { mul: 1, label: '1' },
      { mul: 3 / 2, label: '1½' }, { mul: 2, label: '2' },
      { mul: 3, label: '3' }, { mul: 4, label: '4' },
    ];
    const state = { idx: RATIOS.findIndex(r => r.mul === 1), done: new Set() };

    const serving = el('div', { class: 'servings' });
    serving.appendChild(el('span', { class: 'label' }, 'Makes'));
    const stepper = el('div', { class: 'stepper' });
    const minus = el('button', { type: 'button', 'aria-label': 'Smaller batch', html: window.Sift.icon('minus') });
    const valueEl = el('span', { class: 'value' });
    const plus = el('button', { type: 'button', 'aria-label': 'Larger batch', html: window.Sift.icon('plus') });
    stepper.append(minus, valueEl, plus);
    serving.appendChild(stepper);
    section.appendChild(serving);

    const list = el('ul', { class: 'ing-list' });
    section.appendChild(list);

    const renderIngs = () => {
      const ratio = RATIOS[state.idx];
      const displayServings = Math.max(1, Math.round(originalServings * ratio.mul));
      valueEl.textContent = String(displayServings);
      minus.disabled = state.idx <= 0;
      plus.disabled  = state.idx >= RATIOS.length - 1;
      list.innerHTML = '';
      recipe.ingredients.forEach((ing, idx) => {
        const parts = window.Sift.renderIngredientParts(ing, ratio.mul);
        const li = el('li', { class: 'ing' + (state.done.has(idx) ? ' done' : '') });
        li.appendChild(el('span', { class: 'ing-check', html: window.Sift.icon('check') }));
        const text = el('span', { class: 'text' });
        if (parts.qty)  { text.appendChild(el('span', { class: 'qty' }, parts.qty)); text.appendChild(document.createTextNode(' ')); }
        if (parts.unit) { text.appendChild(el('span', { class: 'unit' }, parts.unit)); text.appendChild(document.createTextNode(' ')); }
        text.appendChild(document.createTextNode(parts.name || ing.text || ''));
        li.appendChild(text);
        li.addEventListener('click', () => {
          if (state.done.has(idx)) { state.done.delete(idx); li.classList.remove('done'); }
          else { state.done.add(idx); li.classList.add('done'); }
        });
        list.appendChild(li);
      });
    };
    minus.addEventListener('click', () => { if (state.idx > 0) { state.idx--; renderIngs(); }});
    plus.addEventListener('click',  () => { if (state.idx < RATIOS.length - 1) { state.idx++; renderIngs(); }});
    renderIngs();

    root.appendChild(section);
  }

  // Instructions
  if (recipe.instructions?.length) {
    const section = el('section', { class: 'section' });
    section.appendChild(el('div', { class: 'section-h' }, 'Instructions'));
    const list = el('ol', { class: 'inst-list' });
    let stepNum = 0;
    const doneSet = new Set();
    recipe.instructions.forEach((step, idx) => {
      if (step.isHeading && step.section) {
        list.appendChild(el('div', { class: 'inst-section' }, step.section));
        return;
      }
      stepNum++;
      const item = el('li', { class: 'inst' });
      item.appendChild(el('span', { class: 'step-n' }, String(stepNum)));
      item.appendChild(el('span', {}, step.text || ''));
      item.addEventListener('click', () => {
        if (doneSet.has(idx)) { doneSet.delete(idx); item.classList.remove('done'); }
        else { doneSet.add(idx); item.classList.add('done'); }
      });
      list.appendChild(item);
    });
    section.appendChild(list);
    root.appendChild(section);
  }

  // Actions
  const actions = el('div', { class: 'actions' });
  const saveBtn = el('button', { class: 'btn btn-primary' });
  saveBtn.innerHTML = `${window.Sift.icon('bookmark')}<span>Save to cookbook</span>`;
  saveBtn.addEventListener('click', () => saveToCookbook(saveBtn));
  actions.appendChild(saveBtn);

  const printBtn = el('button', { class: 'btn btn-secondary' });
  printBtn.innerHTML = `${window.Sift.icon('print')}<span>Print</span>`;
  printBtn.addEventListener('click', () => window.print());
  actions.appendChild(printBtn);
  root.appendChild(actions);

  // Show "open in app" link if server is reachable
  openAppBtn.hidden = false;
  openAppBtn.addEventListener('click', openInApp, { once: true });

  // Notice banner
  if (recipe.parseSource === 'heuristic' || recipe.parseSource === 'none') {
    const banner = el('div', { class: 'toast-line err' },
      'Heads up — this page didn’t use standard recipe markup. Double-check before you bake.'
    );
    root.appendChild(banner);
  }
}

function metaItem(label, value) {
  const wrap = el('div', { class: 'r-meta-item' });
  wrap.appendChild(el('span', { class: 'label' }, label));
  wrap.appendChild(el('div', { class: 'value' }, value));
  return wrap;
}

function renderStars(value, count) {
  const pct = Math.max(0, Math.min(100, (Number(value) || 0) * 20));
  const wrap = el('div', { class: 'stars' });
  wrap.innerHTML = `
    <span style="position:relative">
      <span class="stars-track">${window.Sift.icon('star').repeat(5)}</span>
      <span class="stars-fill" style="width:${pct}%">${window.Sift.icon('star').repeat(5)}</span>
    </span>
    <span class="rating-text">${value.toFixed(1)}</span>
    ${count ? `<span class="rating-count">(${formatCount(count)})</span>` : ''}
  `;
  return wrap;
}
function formatCount(c) {
  if (c < 1000) return c;
  if (c < 10000) return (c / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(c / 1000) + 'k';
}

async function saveToCookbook(btn) {
  if (!lastRecipe) return;
  btn.disabled = true;
  const originalLabel = btn.innerHTML;
  btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;margin:0;"></span><span>Saving…</span>`;

  try {
    const cookbooks = await fetchJSON(`${SERVER}/api/cookbooks`);
    const first = cookbooks.cookbooks[0];
    if (!first) {
      throw new Error('No cookbooks yet. Open the app to create one first.');
    }
    const payload = {
      cookbookId: first.id,
      tabId: null,
      recipe: {
        sourceUrl: lastRecipe.sourceUrl,
        title: lastRecipe.title,
        description: lastRecipe.description,
        heroImage: lastRecipe.heroImage,
        author: lastRecipe.author,
        prepMinutes: lastRecipe.prepMinutes,
        cookMinutes: lastRecipe.cookMinutes,
        totalMinutes: lastRecipe.totalMinutes,
        servings: lastRecipe.servings,
        yieldText: lastRecipe.yieldText,
        ingredients: lastRecipe.ingredients,
        instructions: lastRecipe.instructions,
        rating: lastRecipe.rating,
      },
    };
    const result = await fetchJSON(`${SERVER}/api/recipes`, { method: 'POST', body: payload });
    const banner = el('div', { class: 'toast-line ok' },
      `Saved to "${first.name}". `,
    );
    const link = el('a', { href: `${SERVER}/#/saved/${result.recipe.id}`, target: '_blank', style: 'color:inherit; font-weight:700; text-decoration:underline;' }, 'Open it →');
    banner.appendChild(link);
    root.appendChild(banner);
    btn.innerHTML = `${window.Sift.icon('check')}<span>Saved!</span>`;
  } catch (e) {
    const banner = el('div', { class: 'toast-line err' },
      e.message.includes('fetch') || e.message.includes('Failed')
        ? 'Saving needs the Sift app running. Start it with "npm start" in the project folder.'
        : `Save failed: ${e.message}`
    );
    root.appendChild(banner);
    btn.disabled = false;
    btn.innerHTML = originalLabel;
  }
}

function openInApp() {
  if (!lastRecipe?.sourceUrl) return;
  chrome.tabs.create({ url: `${SERVER}/#/recipe?${new URLSearchParams({ url: lastRecipe.sourceUrl })}` });
}

async function fetchJSON(url, { method = 'GET', body } = {}) {
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}
