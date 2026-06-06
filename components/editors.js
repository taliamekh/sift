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

  // Cover image picker — presets + (when editing an existing cookbook)
  // an upload button. Selecting any preset overrides the color/icon look.
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

  // Lazily fetch presets so old saved coverImages still highlight correctly
  api.listCoverPresets().then(({ presets }) => {
    (presets || []).forEach(p => {
      const tile = h('button.cover-preset', { type: 'button', 'aria-label': `Use cover ${p.name}` });
      tile.style.backgroundImage = `url(${JSON.stringify(p.url)})`;
      if (coverImage === p.url) tile.classList.add('selected');
      tile.addEventListener('click', () => {
        coverImage = p.url;
        $$('.cover-preset', coverGrid).forEach(b => b.classList.toggle('selected', b === tile));
        refreshPreview();
      });
      coverGrid.appendChild(tile);
    });
    // Show the previously-uploaded custom cover as a selectable tile too
    if (coverImage && coverImage.startsWith('/uploads/') && !coverGrid.querySelector('.cover-preset.selected:not(.cover-preset-none)')) {
      const customTile = h('button.cover-preset.selected', { type: 'button', 'aria-label': 'Uploaded cover' });
      customTile.style.backgroundImage = `url(${JSON.stringify(coverImage)})`;
      coverGrid.appendChild(customTile);
    }
  }).catch(() => { /* leave grid as just the "No image" tile */ });

  const coverSection = labelled('Cover image', coverGrid);
  if (cookbook) {
    const uploadBtn = h('label.cover-upload-btn', { tabindex: '0' });
    uploadBtn.innerHTML = `${icon('camera')}<span>Upload your own…</span>`;
    const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: '' });
    uploadBtn.appendChild(fileInput);
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files?.length) return;
      try {
        const { url, cookbook: updated } = await api.uploadCoverImage(cookbook.id, fileInput.files[0]);
        coverImage = url;
        refreshPreview();
        toast.success('Cover uploaded');
        // Add to grid and select it
        $$('.cover-preset', coverGrid).forEach(b => b.classList.remove('selected'));
        const newTile = h('button.cover-preset.selected', { type: 'button', 'aria-label': 'Uploaded cover' });
        newTile.style.backgroundImage = `url(${JSON.stringify(url)})`;
        coverGrid.appendChild(newTile);
        // Surface the saved cookbook data to the parent so card refreshes
        if (updated) cookbook.coverImage = url;
      } catch (e) { toast.error(e.message); }
    });
    coverSection.appendChild(uploadBtn);
  } else {
    coverSection.appendChild(h('p.cover-upload-hint',
      'Upload custom covers after creating the cookbook (or drop image files into public/assets/covers/ to share them across all cookbooks).'));
  }
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
