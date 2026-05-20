// Edit modals for cookbooks, tabs, and "save recipe to cookbook" flow.
import { h, $$, mount } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { openModal, closeModal } from '../lib/modal.js';
import * as toast from '../lib/toast.js';
import { api } from '../lib/api.js';

const COOKBOOK_COLORS = [
  '#F8B4D9', '#FFB6C1', '#F48FB1', '#EC407A',
  '#FFD8B4', '#FFE0B5', '#FFE9B5', '#FFCAB1',
  '#D4F0C2', '#B7DEC5', '#A5D6C8', '#B8D8E8',
  '#C5C2E8', '#D8C7E8', '#E8C7D8', '#C2185B',
];

const COOKBOOK_ICONS = [
  // sweets / baked goods
  'cupcake', 'cookie', 'cake', 'donut', 'pie', 'pieSlice', 'croissant',
  'croissant2', 'bread', 'baguette', 'iceCream', 'milkshake', 'candy',
  'lollipop', 'strawberry', 'apple',
  // savoury
  'burger', 'chicken', 'drumstick',
  // tools / kitchen
  'whisk', 'rollingPin', 'mixer', 'bowl', 'pot', 'oven', 'grill',
  'chefHat', 'knife', 'fork', 'spoon', 'mug', 'kettle', 'saltShaker',
  'scale', 'herb',
  // botanical / decorative
  'heart', 'heartLine', 'daisy', 'rose', 'lily', 'tulip',
  'leaf', 'sparkle', 'starFour', 'starBurst', 'sun', 'moon', 'cloud',
  // animals / home
  'cow', 'cat', 'dog', 'house',
];

const TAB_COLORS = [
  '#FFD6E8', '#FFC2D6', '#FFB1CC', '#F8A1B6',
  '#FFE0B5', '#FFD8B4', '#FFE9B5', '#FFCAB1',
  '#D4F0C2', '#B7DEC5', '#B8D8E8', '#D8C7E8',
];

// Curated text colours for the cookbook label + icon. Four groupings,
// each tuned to complement a family of COOKBOOK_COLORS:
//   • lights — read on rich pastels, photo covers, and the deep-pink
//     #C2185B / #EC407A swatches
//   • cute mid-tones — saturated, playful, match the pastel-recipe-book
//     vibe and read well on the lightest pastel covers
//   • warm darks — sit naturally on the peach/cream/yellow row
//   • cool darks / near-black — pair with the green/blue/lavender/purple
//     covers and provide deep ink for any white-ish cover
// Three rows of six in the editor.
const COOKBOOK_TEXT_COLORS = [
  // Lights
  { value: '#FFFFFF', label: 'White' },
  { value: '#FFF4E6', label: 'Cream' },
  { value: '#FFE8F1', label: 'Blush' },
  // Cute mid-tones (saturated, playful)
  { value: '#F26CA7', label: 'Bubblegum' },
  { value: '#FF7E7E', label: 'Coral' },
  { value: '#F0B530', label: 'Sunny' },
  { value: '#5FB48C', label: 'Mint' },
  { value: '#5FB5DE', label: 'Sky' },
  { value: '#A98BD8', label: 'Lavender' },
  // Warm darks
  { value: '#8C4A2E', label: 'Rust' },
  { value: '#8C6E2F', label: 'Mustard' },
  { value: '#4A2C3A', label: 'Cocoa' },
  // Deep pinks → cool darks → near-black
  { value: '#7A1F47', label: 'Berry' },
  { value: '#5C2E5C', label: 'Plum' },
  { value: '#2A3A5C', label: 'Navy' },
  { value: '#4F6B4D', label: 'Sage' },
  { value: '#2E4A33', label: 'Forest' },
  { value: '#2A1E25', label: 'Ink' },
];

// ─── Cookbook editor ───────────────────────────────────────────────────────

export function openCookbookEditor({ cookbook = null, onSave }) {
  let name = cookbook?.name || '';
  let color = cookbook?.coverColor || COOKBOOK_COLORS[0];
  let iconName = cookbook?.coverIcon || 'cupcake';
  let description = cookbook?.description || '';
  let coverImage = cookbook?.coverImage || null;
  let textColor = cookbook?.coverTextColor || '#FFFFFF';

  const root = h('div.stack-5');
  root.appendChild(h('h3', cookbook ? 'Edit cookbook' : 'New cookbook'));

  // Preview — shows the icon over the image cover too, so users can pick a
  // combo (image + icon + text colour) without saving first.
  const preview = h('div', { style: { display: 'grid', placeItems: 'center', marginBottom: 'var(--s-2)' } });
  const previewBox = h('div.cookbook-spine');
  const previewIcon = h('span', { 'aria-hidden': 'true', style: { display: 'inline-flex' } });
  const refreshPreview = () => {
    // "none" is the explicit no-icon sentinel — cleared innerHTML keeps the
    // preview box uncluttered (label-only cover).
    previewIcon.innerHTML = iconName === 'none' ? '' : icon(iconName);
    // The .cookbook-spine svg rule resolves its colour from --cover-text,
    // so we set it on the preview box rather than relying on inherited
    // span colour (which the more-specific rule would override).
    previewBox.style.setProperty('--cover-text', textColor);
    if (coverImage) {
      previewBox.style.background = `center/cover no-repeat url(${JSON.stringify(coverImage)})`;
      previewBox.setAttribute('data-cover', 'image');
    } else {
      previewBox.style.background = color;
      previewBox.removeAttribute('data-cover');
    }
    // Propagate the live cover + text colour to the icon and text-colour
    // picker tiles via CSS vars on the modal root, so each tile renders
    // its glyph against the actual cookbook background the user is
    // building — true preview rather than a generic pink swatch.
    root.style.setProperty('--preview-cover', color);
    root.style.setProperty('--preview-text', textColor);
  };
  previewBox.appendChild(previewIcon);
  preview.appendChild(previewBox);
  root.appendChild(preview);
  refreshPreview();

  // Name input
  const nameInput = h('input.input', { type: 'text', placeholder: 'e.g. "Holiday Bakes"', maxlength: 60, value: name });
  nameInput.addEventListener('input', () => { name = nameInput.value; });
  root.appendChild(labelled('Name', nameInput));

  // Description
  const descInput = h('textarea.input', { placeholder: 'Optional — a line about this cookbook', maxlength: 200 }, description);
  descInput.addEventListener('input', () => { description = descInput.value; });
  root.appendChild(labelled('Description', descInput));

  // Cover image picker — a "No image" tile, then every preset image in
  // the shared gallery (public/assets/covers/), then an "Add to gallery"
  // tile that uploads a new preset (image or PDF; PDFs get rendered to
  // PNG server-side). Selecting any preset overrides the colour/icon look.
  const coverGrid = h('div.cover-presets-grid');
  const noneTile = h('button.cover-preset.cover-preset-none', { type: 'button', 'aria-label': 'No image (use color)' });
  noneTile.innerHTML = `<span>No image</span>`;
  noneTile.addEventListener('click', () => {
    coverImage = null;
    $$('.cover-preset', coverGrid).forEach(b => b.classList.toggle('selected', b === noneTile));
    refreshPreview();
  });
  if (!coverImage) noneTile.classList.add('selected');
  coverGrid.appendChild(noneTile);

  // Build a single preset tile — used for both initially-fetched presets
  // and freshly-uploaded ones. The little × in the corner deletes the
  // preset from the gallery (with a confirm). stopPropagation so clicking
  // × doesn't also select the tile.
  function makePresetTile(p) {
    const tile = h('button.cover-preset', { type: 'button', 'aria-label': `Use cover ${p.name}` });
    tile.dataset.url = p.url;
    tile.dataset.name = p.name;
    tile.style.backgroundImage = `url(${JSON.stringify(p.url)})`;
    if (coverImage === p.url) tile.classList.add('selected');
    tile.addEventListener('click', () => {
      coverImage = p.url;
      $$('.cover-preset', coverGrid).forEach(b => b.classList.toggle('selected', b === tile));
      refreshPreview();
    });
    const del = h('button.cover-preset-delete', {
      type: 'button',
      'aria-label': `Remove preset ${p.name}`,
      title: 'Remove from gallery',
    });
    del.innerHTML = icon('close');
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Remove "${p.name}" from the cover gallery? Cookbooks already using it will fall back to their colour.`)) return;
      try {
        await api.deleteCoverPreset(p.name);
        if (coverImage === p.url) {
          coverImage = null;
          noneTile.classList.add('selected');
          refreshPreview();
        }
        tile.remove();
      } catch (err) { toast.error(err.message); }
    });
    tile.appendChild(del);
    return tile;
  }

  // The "Add to gallery" button lives inside the grid as the LAST tile so
  // it visually reads as "+ new preset" alongside the others. Renders a
  // dashed border + plus icon to match the new-cookbook tile pattern.
  function makeAddTile() {
    const tile = h('label.cover-preset.cover-preset-add', { tabindex: '0', title: 'Upload an image or PDF — PDFs render to PNG' });
    tile.innerHTML = `${icon('plus')}<span>Add image / PDF</span>`;
    const input = h('input', { type: 'file', accept: 'image/*,application/pdf', hidden: '' });
    tile.appendChild(input);
    input.addEventListener('change', async () => {
      if (!input.files?.length) return;
      try {
        const { preset } = await api.uploadCoverPreset(input.files[0]);
        toast.success('Added to gallery');
        const newTile = makePresetTile(preset);
        // Insert before the add-tile so it joins the preset row
        coverGrid.insertBefore(newTile, tile);
        // Auto-select the new preset
        coverImage = preset.url;
        $$('.cover-preset', coverGrid).forEach(b => b.classList.toggle('selected', b === newTile));
        refreshPreview();
        input.value = '';
      } catch (err) { toast.error(err.message); }
    });
    return tile;
  }

  // Lazily fetch presets so we can re-select an existing coverImage when
  // editing an existing cookbook. The add-tile renders immediately so the
  // user doesn't wait on the network for the most important action.
  const addTile = makeAddTile();
  coverGrid.appendChild(addTile);
  api.listCoverPresets().then(({ presets }) => {
    (presets || []).forEach(p => {
      coverGrid.insertBefore(makePresetTile(p), addTile);
    });
    // Per-cookbook uploaded covers (legacy /uploads/ URLs from before the
    // shared gallery) still need to render as a selectable tile so the
    // user can keep them on the existing cookbook even though they're
    // not part of the shared preset gallery.
    if (coverImage && coverImage.startsWith('/uploads/') && !coverGrid.querySelector('.cover-preset.selected:not(.cover-preset-none)')) {
      const legacyTile = h('button.cover-preset.selected', { type: 'button', 'aria-label': 'Cookbook-only cover' });
      legacyTile.style.backgroundImage = `url(${JSON.stringify(coverImage)})`;
      coverGrid.insertBefore(legacyTile, addTile);
    }
  }).catch(() => { /* leave grid as just the "No image" + add tiles */ });

  const coverSection = labelled('Cover image', coverGrid);
  coverSection.appendChild(h('p.cover-upload-hint',
    'Upload a JPG / PNG / WEBP — or drop in a PDF and we\'ll render the first page. Uploaded covers join the gallery and are reusable across cookbooks.'));
  root.appendChild(coverSection);

  // Color picker
  const swatchGrid = h('div.swatch-grid');
  COOKBOOK_COLORS.forEach(c => {
    const s = h('button.swatch', { type: 'button', 'aria-label': `Color ${c}`, style: { background: c } });
    if (c === color) s.classList.add('selected');
    s.addEventListener('click', () => {
      color = c;
      $$('.swatch', swatchGrid).forEach(b => b.classList.toggle('selected', b === s));
      refreshPreview();
    });
    swatchGrid.appendChild(s);
  });
  root.appendChild(labelled('Notebook colour', swatchGrid));

  // Text colour — applies to title, description, MAKES meta, and icon.
  // Each chip's background is the cookbook's currently selected cover
  // colour (via --preview-cover), so the user sees the actual contrast
  // before committing. Placed above the icon picker so the chosen text
  // colour is also what tints the icon-picker tiles below.
  // 6-column grid → 12 chips form a clean 2×6 block.
  const textColorGrid = h('div.swatch-grid.swatch-grid-text');
  COOKBOOK_TEXT_COLORS.forEach(({ value, label }) => {
    const s = h('button.swatch.swatch-text', {
      type: 'button',
      'aria-label': `Text colour ${label}`,
      title: label,
    });
    s.innerHTML = `<span class="swatch-text-mark" style="color:${value}">Aa</span>`;
    if (value === textColor) s.classList.add('selected');
    s.addEventListener('click', () => {
      textColor = value;
      $$('.swatch-text', textColorGrid).forEach(b => b.classList.toggle('selected', b === s));
      refreshPreview();
    });
    textColorGrid.appendChild(s);
  });
  root.appendChild(labelled('Text & icon colour', textColorGrid));

  // Icon picker — rendered on top of every cover (image or color). Tile
  // background = --preview-cover, glyph = --preview-text, so each option
  // shows what the icon will look like over the actual cookbook colour.
  // First chip is a "no icon" option so the user can keep a clean
  // label-only cover (mirrors the tab editor's pattern).
  const iconGrid = h('div.icon-grid');
  const noneIcon = h('button.icon-pick.icon-pick-preview.icon-pick-none', {
    type: 'button',
    'aria-label': 'No icon',
    title: 'No icon',
  }, '—');
  if (iconName === 'none') noneIcon.classList.add('selected');
  noneIcon.addEventListener('click', () => {
    iconName = 'none';
    $$('.icon-pick', iconGrid).forEach(b => b.classList.toggle('selected', b === noneIcon));
    refreshPreview();
  });
  iconGrid.appendChild(noneIcon);
  COOKBOOK_ICONS.forEach(n => {
    const i = h('button.icon-pick.icon-pick-preview', { type: 'button', 'aria-label': n });
    i.innerHTML = icon(n);
    if (n === iconName) i.classList.add('selected');
    i.addEventListener('click', () => {
      iconName = n;
      $$('.icon-pick', iconGrid).forEach(b => b.classList.toggle('selected', b === i));
      refreshPreview();
    });
    iconGrid.appendChild(i);
  });
  root.appendChild(labelled('Icon', iconGrid));

  // Actions
  const actions = h('div.row');
  if (cookbook) {
    const del = h('button.btn.btn-danger.btn-sm', { type: 'button' }, 'Delete');
    del.innerHTML = `${icon('trash')}<span>Delete cookbook</span>`;
    del.addEventListener('click', async () => {
      if (!confirm(`Delete "${cookbook.name}" and everything inside it? This can't be undone.`)) return;
      try {
        await api.deleteCookbook(cookbook.id);
        toast.success('Cookbook deleted');
        closeModal();
        onSave?.({ deleted: true });
      } catch (e) { toast.error(e.message); }
    });
    actions.appendChild(del);
  }
  actions.appendChild(h('div.spacer'));
  const cancel = h('button.btn.btn-ghost', { type: 'button', onClick: closeModal }, 'Cancel');
  actions.appendChild(cancel);
  const save = h('button.btn.btn-primary', { type: 'button' }, cookbook ? 'Save changes' : 'Create cookbook');
  save.addEventListener('click', async () => {
    if (!name.trim()) { toast.error('Cookbook needs a name'); nameInput.focus(); return; }
    save.disabled = true;
    try {
      const payload = {
        name: name.trim(),
        coverColor: color,
        coverIcon: iconName,
        coverImage,
        coverTextColor: textColor,
        description: description.trim() || null,
      };
      const result = cookbook
        ? await api.updateCookbook(cookbook.id, payload)
        : await api.createCookbook(payload);
      toast.success(cookbook ? 'Cookbook updated' : 'Cookbook created');
      closeModal();
      onSave?.({ cookbook: result.cookbook });
    } catch (e) { toast.error(e.message); save.disabled = false; }
  });
  actions.appendChild(save);
  root.appendChild(actions);

  openModal(root);
  setTimeout(() => nameInput.focus(), 60);
}

// ─── Tab editor ────────────────────────────────────────────────────────────

export function openTabEditor({ tab = null, cookbookId, onSave }) {
  let name = tab?.name || '';
  let color = tab?.color || TAB_COLORS[0];
  let iconName = tab?.icon || null;

  const root = h('div.stack-5');
  root.appendChild(h('h3', tab ? 'Edit tab' : 'New tab'));

  // Preview row
  const preview = h('div.tab', { 'aria-hidden': 'true', style: { background: 'var(--pink-50)' } });
  const colorDot = h('span.tab-color', { style: { background: color } });
  const nameSpan = h('span', name || 'Untitled tab');
  preview.appendChild(colorDot);
  preview.appendChild(nameSpan);
  root.appendChild(h('div', { style: { display: 'grid', placeItems: 'center', marginBottom: 'var(--s-1)' } }, preview));

  const nameInput = h('input.input', { type: 'text', placeholder: 'e.g. "Cookies"', maxlength: 40, value: name });
  nameInput.addEventListener('input', () => { name = nameInput.value; nameSpan.textContent = name || 'Untitled tab'; });
  root.appendChild(labelled('Name', nameInput));

  // Color picker
  const swatchGrid = h('div.swatch-grid');
  TAB_COLORS.forEach(c => {
    const s = h('button.swatch', { type: 'button', 'aria-label': `Color ${c}`, style: { background: c } });
    if (c === color) s.classList.add('selected');
    s.addEventListener('click', () => {
      color = c;
      $$('.swatch', swatchGrid).forEach(b => b.classList.toggle('selected', b === s));
      colorDot.style.background = c;
    });
    swatchGrid.appendChild(s);
  });
  root.appendChild(labelled('Color', swatchGrid));

  // Icon picker (optional for tabs)
  const iconGrid = h('div.icon-grid');
  const noneBtn = h('button.icon-pick', { type: 'button', 'aria-label': 'No icon' }, '—');
  if (iconName == null) noneBtn.classList.add('selected');
  noneBtn.addEventListener('click', () => {
    iconName = null;
    $$('.icon-pick', iconGrid).forEach(b => b.classList.toggle('selected', b === noneBtn));
  });
  iconGrid.appendChild(noneBtn);
  COOKBOOK_ICONS.forEach(n => {
    const i = h('button.icon-pick', { type: 'button', 'aria-label': n });
    i.innerHTML = icon(n);
    if (n === iconName) i.classList.add('selected');
    i.addEventListener('click', () => {
      iconName = n;
      $$('.icon-pick', iconGrid).forEach(b => b.classList.toggle('selected', b === i));
    });
    iconGrid.appendChild(i);
  });
  root.appendChild(labelled('Icon (optional)', iconGrid));

  const actions = h('div.row');
  if (tab) {
    const del = h('button.btn.btn-danger.btn-sm', { type: 'button' });
    del.innerHTML = `${icon('trash')}<span>Delete tab</span>`;
    del.addEventListener('click', async () => {
      if (!confirm(`Delete tab "${tab.name}"? Its recipes stay in the cookbook but lose their tab.`)) return;
      try {
        await api.deleteTab(tab.id);
        toast.success('Tab deleted');
        closeModal();
        onSave?.({ deleted: true });
      } catch (e) { toast.error(e.message); }
    });
    actions.appendChild(del);
  }
  actions.appendChild(h('div.spacer'));
  actions.appendChild(h('button.btn.btn-ghost', { type: 'button', onClick: closeModal }, 'Cancel'));
  const save = h('button.btn.btn-primary', { type: 'button' }, tab ? 'Save' : 'Create');
  save.addEventListener('click', async () => {
    if (!name.trim()) { toast.error('Tab needs a name'); nameInput.focus(); return; }
    save.disabled = true;
    try {
      const payload = { name: name.trim(), color, icon: iconName };
      const result = tab
        ? await api.updateTab(tab.id, payload)
        : await api.createTab(cookbookId, payload);
      toast.success(tab ? 'Tab updated' : 'Tab created');
      closeModal();
      onSave?.({ tab: result.tab });
    } catch (e) { toast.error(e.message); save.disabled = false; }
  });
  actions.appendChild(save);
  root.appendChild(actions);

  openModal(root);
  setTimeout(() => nameInput.focus(), 60);
}

// ─── Save recipe to cookbook ───────────────────────────────────────────────

export async function openSaveRecipeFlow({ recipe, onSave }) {
  const { cookbooks } = await api.listCookbooks();

  let cookbookId = cookbooks[0]?.id ?? null;
  let tabId = null;
  let tabs = [];

  const root = h('div.stack-5');
  root.appendChild(h('h3', 'Save to cookbook'));
  root.appendChild(h('p.muted', `"${recipe.title || 'Untitled recipe'}" will be added to your cookbook with all of its ingredients, instructions, and rating.`));

  // Cookbook picker
  const cookbookSelect = h('select.input');
  cookbooks.forEach(cb => {
    const opt = h('option', { value: cb.id }, cb.name);
    cookbookSelect.appendChild(opt);
  });
  const newOpt = h('option', { value: '__new' }, '＋ New cookbook…');
  cookbookSelect.appendChild(newOpt);
  if (cookbookId) cookbookSelect.value = String(cookbookId);

  const tabSelect = h('select.input');
  const tabWrap = labelled('Tab (optional)', tabSelect);

  async function refreshTabs() {
    tabSelect.innerHTML = '';
    tabSelect.appendChild(h('option', { value: '' }, '— None —'));
    if (!cookbookId) { tabWrap.style.display = 'none'; return; }
    const detail = await api.getCookbook(cookbookId);
    tabs = detail.tabs || [];
    tabs.forEach(t => {
      const opt = h('option', { value: t.id }, t.name);
      tabSelect.appendChild(opt);
    });
    tabSelect.appendChild(h('option', { value: '__new' }, '＋ New tab…'));
    tabWrap.style.display = tabs.length || true ? '' : 'none';
    tabId = null;
    tabSelect.value = '';
  }

  cookbookSelect.addEventListener('change', async () => {
    const v = cookbookSelect.value;
    if (v === '__new') {
      openCookbookEditor({
        onSave: async (res) => {
          if (res?.cookbook) {
            // Re-fetch to include in list
            const { cookbooks: refreshed } = await api.listCookbooks();
            cookbookSelect.innerHTML = '';
            refreshed.forEach(cb => cookbookSelect.appendChild(h('option', { value: cb.id }, cb.name)));
            cookbookSelect.appendChild(h('option', { value: '__new' }, '＋ New cookbook…'));
            cookbookId = res.cookbook.id;
            cookbookSelect.value = String(cookbookId);
            await refreshTabs();
            openSave(); // re-open the save flow (modal was closed by editor)
          }
        },
      });
      return;
    }
    cookbookId = Number(v);
    await refreshTabs();
  });

  tabSelect.addEventListener('change', async () => {
    const v = tabSelect.value;
    if (v === '__new') {
      openTabEditor({
        cookbookId,
        onSave: async (res) => {
          if (res?.tab) {
            tabs.push(res.tab);
            tabSelect.value = '';
            const newOption = h('option', { value: res.tab.id }, res.tab.name);
            tabSelect.insertBefore(newOption, tabSelect.querySelector('option[value="__new"]'));
            tabSelect.value = String(res.tab.id);
            tabId = res.tab.id;
            openSave(); // re-open
          }
        },
      });
      return;
    }
    tabId = v ? Number(v) : null;
  });

  function openSave() {
    const actions = h('div.row');
    actions.appendChild(h('div.spacer'));
    actions.appendChild(h('button.btn.btn-ghost', { type: 'button', onClick: closeModal }, 'Cancel'));
    const save = h('button.btn.btn-primary', { type: 'button' });
    save.innerHTML = `${icon('bookmarkFilled')}<span>Add to cookbook</span>`;
    save.addEventListener('click', async () => {
      if (!cookbookId) { toast.error('Pick a cookbook'); return; }
      save.disabled = true;
      try {
        const payload = {
          cookbookId,
          tabId,
          recipe: {
            sourceUrl: recipe.sourceUrl,
            title: recipe.title,
            description: recipe.description,
            heroImage: recipe.heroImage,
            author: recipe.author,
            prepMinutes: recipe.prepMinutes,
            cookMinutes: recipe.cookMinutes,
            totalMinutes: recipe.totalMinutes,
            servings: recipe.servings,
            yieldText: recipe.yieldText,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            rating: recipe.rating,
          },
        };
        const result = await api.saveRecipe(payload);
        toast.success('Saved to your cookbook');
        closeModal();
        onSave?.(result.recipe);
      } catch (e) { toast.error(e.message); save.disabled = false; }
    });
    actions.appendChild(save);

    const newRoot = h('div.stack-5');
    newRoot.appendChild(h('h3', 'Save to cookbook'));
    newRoot.appendChild(h('p.muted', `"${recipe.title || 'Untitled recipe'}" will be added with all of its ingredients, instructions, and rating.`));
    newRoot.appendChild(labelled('Cookbook', cookbookSelect));
    newRoot.appendChild(tabWrap);
    newRoot.appendChild(actions);
    openModal(newRoot);
  }

  await refreshTabs();
  openSave();
}

// ─── Manual recipe editor ──────────────────────────────────────────────────
//
// Used both for creating a brand-new recipe from scratch and editing an
// existing manually-created one. The recipe view's editable title + side
// content (notes, photos, rating, tab/cookbook picker) still handle their
// own in-place edits; this modal is for the bulk fields (description,
// times, servings, ingredients, instructions, hero image).
export async function openRecipeEditor({ recipe = null, cookbookId = null, tabId = null, onSave } = {}) {
  const isEdit = !!recipe;

  // Local working copy — all edits land here until Save.
  let state = {
    title:         recipe?.title || '',
    description:   recipe?.description || '',
    heroImage:     recipe?.heroImage || null,
    author:        recipe?.author || '',
    prepMinutes:   recipe?.prepMinutes ?? null,
    cookMinutes:   recipe?.cookMinutes ?? null,
    totalMinutes:  recipe?.totalMinutes ?? null,
    servings:      recipe?.servings ?? null,
    yieldText:     recipe?.yieldText || '',
    // Normalise ingredients/instructions into editable arrays of strings.
    // For ingredients we use the `.text` of each parsed object; for
    // instructions we collapse heading-vs-step into a tagged object.
    ingredients:   (recipe?.ingredients || []).map(i => (typeof i === 'string' ? i : (i?.text || ''))),
    instructions:  (recipe?.instructions || []).map(s => (
      s?.isHeading
        ? { kind: 'heading', text: s.section || s.text || '' }
        : { kind: 'step', text: s?.text || (typeof s === 'string' ? s : '') }
    )),
  };
  if (state.instructions.length === 0) state.instructions = [{ kind: 'step', text: '' }];
  if (state.ingredients.length === 0)  state.ingredients  = [''];

  const root = h('div.stack-5.recipe-editor');
  root.appendChild(h('h3', isEdit ? 'Edit recipe' : 'Create your own recipe'));

  // ── Title (required) ────────────────────────────────────────────────────
  const titleInput = h('input.input', { type: 'text', placeholder: 'e.g. "Grandma\'s Lemon Loaf"', maxlength: 200, value: state.title });
  titleInput.addEventListener('input', () => { state.title = titleInput.value; });
  root.appendChild(labelled('Title', titleInput));

  // ── Hero image upload ───────────────────────────────────────────────────
  const heroWrap = h('div.recipe-editor-hero');
  const heroPreview = h('div.recipe-editor-hero-preview');
  const refreshHero = () => {
    if (state.heroImage) {
      heroPreview.style.backgroundImage = `url(${JSON.stringify(state.heroImage)})`;
      heroPreview.classList.add('has-image');
      heroPreview.innerHTML = '';
      const clear = h('button.recipe-editor-hero-clear', { type: 'button', 'aria-label': 'Remove photo', title: 'Remove photo' });
      clear.innerHTML = icon('close');
      clear.addEventListener('click', (e) => { e.preventDefault(); state.heroImage = null; refreshHero(); });
      heroPreview.appendChild(clear);
    } else {
      heroPreview.style.backgroundImage = '';
      heroPreview.classList.remove('has-image');
      heroPreview.innerHTML = `<span class="muted">No photo yet</span>`;
    }
  };
  refreshHero();
  const heroBtn = h('label.cover-upload-btn', { tabindex: '0' });
  heroBtn.innerHTML = `${icon('camera')}<span>Choose photo…</span>`;
  const heroInput = h('input', { type: 'file', accept: 'image/*', hidden: '' });
  heroBtn.appendChild(heroInput);
  heroInput.addEventListener('change', async () => {
    if (!heroInput.files?.length) return;
    try {
      const { url } = await api.uploadImage(heroInput.files[0]);
      state.heroImage = url;
      refreshHero();
      toast.success('Photo added');
      heroInput.value = '';
    } catch (err) { toast.error(err.message); }
  });
  heroWrap.appendChild(heroPreview);
  heroWrap.appendChild(heroBtn);
  root.appendChild(labelled('Hero photo', heroWrap));

  // ── Description (optional) ──────────────────────────────────────────────
  const descInput = h('textarea.input', { placeholder: 'Optional — a line or two about this recipe', maxlength: 600, rows: 2 }, state.description);
  descInput.addEventListener('input', () => { state.description = descInput.value; });
  root.appendChild(labelled('Description', descInput));

  // ── Times (prep / cook / total) ─────────────────────────────────────────
  function numField(placeholder, key) {
    const input = h('input.input.input-num', { type: 'number', min: '0', step: '1', placeholder, value: state[key] ?? '' });
    input.addEventListener('input', () => {
      const v = input.value.trim();
      state[key] = v === '' ? null : Math.max(0, Math.floor(Number(v)));
    });
    return input;
  }
  const timesGrid = h('div.recipe-editor-grid-3');
  timesGrid.appendChild(labelled('Prep (min)', numField('e.g. 15', 'prepMinutes')));
  timesGrid.appendChild(labelled('Cook (min)', numField('e.g. 25', 'cookMinutes')));
  timesGrid.appendChild(labelled('Total (min)', numField('e.g. 45', 'totalMinutes')));
  root.appendChild(timesGrid);

  // ── Servings + yield text ──────────────────────────────────────────────
  const servingsGrid = h('div.recipe-editor-grid-2');
  servingsGrid.appendChild(labelled('Servings', numField('e.g. 12', 'servings')));
  const yieldInput = h('input.input', { type: 'text', placeholder: 'e.g. "12 cookies"', maxlength: 60, value: state.yieldText });
  yieldInput.addEventListener('input', () => { state.yieldText = yieldInput.value; });
  servingsGrid.appendChild(labelled('Yield text', yieldInput));
  root.appendChild(servingsGrid);

  // ── Author (optional) ──────────────────────────────────────────────────
  const authorInput = h('input.input', { type: 'text', placeholder: 'e.g. "Grandma" — leave blank if it\'s your own', maxlength: 120, value: state.author });
  authorInput.addEventListener('input', () => { state.author = authorInput.value; });
  root.appendChild(labelled('Author (optional)', authorInput));

  // ── Ingredients (list) ─────────────────────────────────────────────────
  const ingList = h('div.recipe-editor-list');
  function renderIngredients() {
    mount(ingList);
    state.ingredients.forEach((text, idx) => {
      const row = h('div.recipe-editor-list-row');
      const input = h('input.input', {
        type: 'text', value: text,
        placeholder: 'e.g. "1 cup flour" or "2 large eggs, beaten"',
      });
      input.addEventListener('input', () => { state.ingredients[idx] = input.value; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); state.ingredients.splice(idx + 1, 0, ''); renderIngredients(); ingList.querySelectorAll('input')[idx + 1]?.focus(); }
      });
      const del = h('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': 'Remove ingredient', title: 'Remove' });
      del.innerHTML = icon('close');
      del.addEventListener('click', () => {
        state.ingredients.splice(idx, 1);
        if (state.ingredients.length === 0) state.ingredients = [''];
        renderIngredients();
      });
      row.appendChild(input);
      row.appendChild(del);
      ingList.appendChild(row);
    });
    const add = h('button.btn.btn-ghost.btn-sm.recipe-editor-add-row', { type: 'button' });
    add.innerHTML = `${icon('plus')}<span>Add ingredient</span>`;
    add.addEventListener('click', () => { state.ingredients.push(''); renderIngredients(); ingList.querySelectorAll('input')[state.ingredients.length - 1]?.focus(); });
    ingList.appendChild(add);
  }
  renderIngredients();
  root.appendChild(labelled('Ingredients', ingList));

  // ── Instructions (list with optional section headings) ─────────────────
  const stepsList = h('div.recipe-editor-list');
  function renderSteps() {
    mount(stepsList);
    state.instructions.forEach((item, idx) => {
      const row = h('div.recipe-editor-list-row');
      const input = item.kind === 'heading'
        ? h('input.input.recipe-editor-heading', {
            type: 'text', value: item.text,
            placeholder: 'Section title — e.g. "Preparation"',
          })
        : h('textarea.input', {
            rows: '2',
            placeholder: 'Step text — what to do, in detail',
          }, item.text);
      input.addEventListener('input', () => { state.instructions[idx].text = input.value; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          state.instructions.splice(idx + 1, 0, { kind: 'step', text: '' });
          renderSteps();
          stepsList.querySelectorAll('textarea, input')[idx + 1]?.focus();
        }
      });
      const del = h('button.btn.btn-ghost.btn-sm', { type: 'button', 'aria-label': 'Remove step', title: 'Remove' });
      del.innerHTML = icon('close');
      del.addEventListener('click', () => {
        state.instructions.splice(idx, 1);
        if (state.instructions.length === 0) state.instructions = [{ kind: 'step', text: '' }];
        renderSteps();
      });
      row.appendChild(input);
      row.appendChild(del);
      stepsList.appendChild(row);
    });
    const addRow = h('div.recipe-editor-add-buttons');
    const addStep = h('button.btn.btn-ghost.btn-sm', { type: 'button' });
    addStep.innerHTML = `${icon('plus')}<span>Add step</span>`;
    addStep.addEventListener('click', () => {
      state.instructions.push({ kind: 'step', text: '' });
      renderSteps();
      const els = stepsList.querySelectorAll('textarea, input');
      els[els.length - 1]?.focus();
    });
    const addHeading = h('button.btn.btn-ghost.btn-sm', { type: 'button' });
    addHeading.innerHTML = `${icon('sparkle')}<span>Add section heading</span>`;
    addHeading.addEventListener('click', () => {
      state.instructions.push({ kind: 'heading', text: '' });
      renderSteps();
      const els = stepsList.querySelectorAll('textarea, input');
      els[els.length - 1]?.focus();
    });
    addRow.appendChild(addStep);
    addRow.appendChild(addHeading);
    stepsList.appendChild(addRow);
  }
  renderSteps();
  root.appendChild(labelled('Instructions', stepsList));

  // ── Save / Cancel ───────────────────────────────────────────────────────
  const actions = h('div.row');
  if (isEdit) {
    // Delete-from-modal isn't exposed here — the recipe page already has a
    // Remove button. Modal stays focused on editing the fields.
  }
  actions.appendChild(h('div.spacer'));
  actions.appendChild(h('button.btn.btn-ghost', { type: 'button', onClick: closeModal }, 'Cancel'));
  const save = h('button.btn.btn-primary', { type: 'button' });
  save.innerHTML = `${icon('bookmarkFilled')}<span>${isEdit ? 'Save changes' : 'Create recipe'}</span>`;
  save.addEventListener('click', async () => {
    const title = state.title.trim();
    if (!title) { toast.error('Recipe needs a title'); titleInput.focus(); return; }
    save.disabled = true;
    try {
      const ingredientsForServer = state.ingredients.map(s => s.trim()).filter(Boolean);
      const instructionsForServer = state.instructions
        .filter(s => s.text.trim())
        .map(s => s.kind === 'heading' ? { isHeading: true, section: s.text.trim() } : { text: s.text.trim() });
      const payload = {
        cookbookId: cookbookId ?? recipe?.cookbookId ?? null,
        tabId:      tabId ?? recipe?.tabId ?? null,
        recipe: {
          title,
          description: state.description.trim() || null,
          heroImage:   state.heroImage || null,
          author:      state.author.trim() || null,
          prepMinutes: state.prepMinutes,
          cookMinutes: state.cookMinutes,
          totalMinutes: state.totalMinutes,
          servings:    state.servings,
          yieldText:   state.yieldText.trim() || null,
          ingredients: ingredientsForServer,
          instructions: instructionsForServer,
        },
      };
      let result;
      if (isEdit) {
        // PATCH the existing row with the edited fields. cookbookId/tabId
        // not in the payload (the recipe-page picker handles that already).
        result = await api.updateRecipe(recipe.id, payload.recipe);
      } else {
        result = await api.saveRecipe(payload);
      }
      toast.success(isEdit ? 'Recipe updated' : 'Recipe created');
      closeModal();
      onSave?.(result.recipe);
    } catch (err) { toast.error(err.message); save.disabled = false; }
  });
  actions.appendChild(save);
  root.appendChild(actions);

  openModal(root);
  setTimeout(() => titleInput.focus(), 60);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function labelled(label, control) {
  return h('label', { style: { display: 'block' } },
    h('span', { style: {
      display: 'block', marginBottom: 'var(--s-2)', fontSize: 'var(--step--1)',
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
      color: 'var(--berry)',
    }}, label),
    control
  );
}
