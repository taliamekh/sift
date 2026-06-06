import { h, mount, $$ } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { RecipeView } from '../components/recipeView.js';
import { StarInput, StarRating } from '../components/starRating.js';
import { Breadcrumb } from '../components/breadcrumb.js';
import { addRecentlyViewed, removeRecentlyViewed } from '../lib/recentlyViewed.js';
import * as toast from '../lib/toast.js';

export async function SavedRecipeView({ id, fallbackUrl = null }) {
  const root = h('div.container');

  let recipe = null;
  let photos = [];
  let cookbook = null;
  let tabs = [];

  try {
    const detail = await api.getRecipe(id);
    recipe = detail.recipe;
    photos = detail.photos;
    if (recipe.cookbookId) {
      const book = await api.getCookbook(recipe.cookbookId);
      cookbook = book.cookbook;
      tabs = book.tabs;
    }
    // Track this view so it surfaces on the home page even before a save
    // (and a saved view replaces any parsed entry with the same source URL).
    addRecentlyViewed({
      kind: 'saved',
      id: recipe.id,
      url: recipe.sourceUrl,
      title: recipe.title,
      heroImage: recipe.heroImage,
      totalMinutes: recipe.totalMinutes,
      externalRating: recipe.externalRating,
    });
  } catch (e) {
    // Stale recently-viewed entries (recipe deleted, or pointing at IDs from
    // a different machine) used to dead-end on a "Recipe not found" screen.
    // When the caller passed a fallback source URL (the recently-viewed card
    // attaches one), prune the bad entry and replay the URL through the
    // parser so the user lands on the actual recipe instead of a dead end.
    if (fallbackUrl) {
      const numericId = Number(id);
      removeRecentlyViewed(it => it.kind === 'saved' && it.id === numericId);
      navigate('/recipe?' + new URLSearchParams({ url: fallbackUrl }), { replace: true });
      return root;
    }
    root.appendChild(h('div.empty',
      h('div.empty-illustration', { html: icon('bowl') }),
      h('h3', 'Recipe not found'),
      h('p.muted', e.message),
      h('button.btn.btn-primary', { style: { marginTop: 'var(--s-4)' }, onClick: () => navigate('/') }, 'Back home'),
    ));
    return root;
  }

  // Breadcrumb so users can always get back home or to the cookbook
  const crumbs = [{ label: 'Home', href: '#/', icon: 'home' }];
  if (cookbook) crumbs.push({ label: cookbook.name, href: `#/cookbook/${cookbook.id}`, icon: cookbook.coverIcon });
  crumbs.push({ label: recipe.title || 'Recipe' });
  root.appendChild(Breadcrumb(crumbs));

  // Side content: user rating + notes + photos + cookbook/tab
  const sideContent = buildSideContent(recipe, photos, cookbook, tabs);

  const view = RecipeView(recipe, {
    headerActions: buildHeaderActions(recipe),
    sideContent,
    editableTitle: true,
    onTitleChange: async (newTitle) => {
      try {
        await api.updateRecipe(recipe.id, { title: newTitle });
        toast.success('Title updated');
      } catch (e) { toast.error(e.message); }
    },
  });
  root.appendChild(view);
  return root;
}

function buildHeaderActions(recipe) {
  const actions = [];

  if (recipe.sourceUrl) {
    const src = h('a.btn.btn-secondary', { href: recipe.sourceUrl, target: '_blank', rel: 'noopener noreferrer' });
    src.innerHTML = `${icon('external')}<span>Original recipe</span>`;
    actions.push(src);
  }

  const print = h('button.btn.btn-secondary');
  print.innerHTML = `${icon('print')}<span>Print</span>`;
  print.addEventListener('click', () => window.print());
  actions.push(print);

  const back = h('button.btn.btn-ghost');
  back.innerHTML = `${icon('arrowLeft')}<span>Back</span>`;
  back.addEventListener('click', () => {
    if (recipe.cookbookId) navigate(`/cookbook/${recipe.cookbookId}`);
    else navigate('/');
  });
  actions.push(back);

  const del = h('button.btn.btn-danger');
  del.innerHTML = `${icon('trash')}<span>Remove</span>`;
  del.addEventListener('click', async () => {
    if (!confirm('Remove this recipe from your cookbook? This can’t be undone.')) return;
    try {
      await api.deleteRecipe(recipe.id);
      toast.success('Recipe removed');
      if (recipe.cookbookId) navigate(`/cookbook/${recipe.cookbookId}`);
      else navigate('/');
    } catch (e) { toast.error(e.message); }
  });
  actions.push(del);

  return actions;
}

function buildSideContent(recipe, photos, cookbook, tabs) {
  const wrap = h('div.stack-5');

  // Cookbook + tab badge
  if (cookbook) {
    const filed = h('div.card', { style: { padding: 'var(--s-4) var(--s-5)' } });
    const head = h('div.row', { style: { marginBottom: 'var(--s-2)' } });
    const spineDot = h('span', { style: {
      width: '18px', height: '18px', borderRadius: '6px',
      background: cookbook.coverColor || '#F8B4D9', display: 'inline-grid', placeItems: 'center', color: 'white',
    } });
    spineDot.innerHTML = `<span style="display:inline-flex;width:12px;height:12px;">${icon(cookbook.coverIcon || 'cupcake')}</span>`;
    head.appendChild(spineDot);
    const link = h('a', { href: `#/cookbook/${cookbook.id}`, style: { fontWeight: 600, color: 'var(--cocoa)' } }, cookbook.name);
    head.appendChild(link);
    filed.appendChild(head);

    const tabRow = h('div.row', { style: { marginTop: 'var(--s-2)' } });
    tabRow.appendChild(h('span', { style: {
      fontSize: 'var(--step--1)', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.12em', color: 'var(--berry)',
    }}, 'Tab'));

    const tabSelect = h('select.input', { style: { padding: '0.4em 0.7em', fontSize: 'var(--step--1)', flex: '1' } });
    tabSelect.appendChild(h('option', { value: '' }, '— None —'));
    tabs.forEach(t => {
      const opt = h('option', { value: t.id }, t.name);
      tabSelect.appendChild(opt);
    });
    tabSelect.value = recipe.tabId ? String(recipe.tabId) : '';
    tabSelect.addEventListener('change', async () => {
      const newTabId = tabSelect.value ? Number(tabSelect.value) : null;
      try {
        await api.updateRecipe(recipe.id, { tabId: newTabId });
        toast.success(newTabId ? 'Moved to tab' : 'Removed from tab');
      } catch (e) { toast.error(e.message); }
    });
    tabRow.appendChild(tabSelect);
    filed.appendChild(tabRow);
    wrap.appendChild(filed);
  }

  // User rating
  const ratingCard = h('div.card', { style: { padding: 'var(--s-5)' } });
  ratingCard.appendChild(h('h4', { style: { marginBottom: 'var(--s-2)' } }, 'My rating'));
  ratingCard.appendChild(h('p.muted', { style: { fontSize: 'var(--step--1)', marginBottom: 'var(--s-3)' } }, 'How was it for you?'));
  let currentRating = recipe.userRating ?? null;
  const stars = StarInput(currentRating, async (val) => {
    currentRating = val;
    try {
      await api.updateRecipe(recipe.id, { userRating: val });
    } catch (e) { toast.error(e.message); }
  });
  ratingCard.appendChild(stars);
  wrap.appendChild(ratingCard);

  // Notes
  const notesCard = h('div.notes-area');
  const notesHeader = h('div.row', { style: { marginBottom: 'var(--s-3)' } });
  notesHeader.appendChild(h('h4', 'Notes'));
  notesHeader.appendChild(h('div.spacer'));
  const savedFlag = h('span.notes-saved', 'Saved ✓');
  notesHeader.appendChild(savedFlag);
  notesCard.appendChild(notesHeader);

  const textarea = h('textarea', {
    placeholder: 'Adjustments, tips, what worked, what to try next time…',
    rows: '4',
  }, recipe.userNotes || '');
  let saveTimer = null;
  textarea.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await api.updateRecipe(recipe.id, { userNotes: textarea.value });
        savedFlag.classList.add('visible');
        setTimeout(() => savedFlag.classList.remove('visible'), 1800);
      } catch (e) { toast.error(e.message); }
    }, 600);
  });
  notesCard.appendChild(textarea);
  wrap.appendChild(notesCard);

  // Photos
  const photoCard = h('div.card', { style: { padding: 'var(--s-5)' } });
  photoCard.appendChild(h('h4', { style: { marginBottom: 'var(--s-3)' } }, 'My photos'));
  const gallery = h('div.photo-gallery');
  photoCard.appendChild(gallery);
  wrap.appendChild(photoCard);

  function refreshGallery() {
    mount(gallery);
    photos.forEach(p => gallery.appendChild(photoThumb(p, async () => {
      try {
        await api.deletePhoto(p.id);
        photos = photos.filter(x => x.id !== p.id);
        refreshGallery();
        toast.success('Photo removed');
      } catch (e) { toast.error(e.message); }
    })));
    const uploadBtn = h('label.photo-upload', { tabindex: '0' });
    uploadBtn.innerHTML = `<span class="photo-upload-inner">${icon('camera')}<span>Add photo</span></span>`;
    const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: '', hidden: '' });
    uploadBtn.appendChild(fileInput);
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files.length) return;
      try {
        const { photos: added } = await api.uploadPhotos(recipe.id, [...fileInput.files]);
        photos = photos.concat(added);
        refreshGallery();
        toast.success('Photo added');
      } catch (e) { toast.error(e.message); }
    });
    gallery.appendChild(uploadBtn);
  }
  refreshGallery();

  return wrap;
}

function photoThumb(p, onDelete) {
  const wrap = h('div.photo-thumb', {
    onClick: (e) => {
      if (e.target.closest('.photo-thumb-remove')) return;
      window.open(p.url, '_blank');
    },
  });
  wrap.appendChild(h('img', { src: p.url, alt: p.caption || 'Photo' }));
  const del = h('button.photo-thumb-remove', { type: 'button', 'aria-label': 'Delete photo' });
  del.innerHTML = icon('close');
  del.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });
  wrap.appendChild(del);
  return wrap;
}
