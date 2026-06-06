import { h, mount } from '../lib/h.js';
import { icon } from '../lib/icons.js';
import { api } from '../lib/api.js';
import { navigate } from '../lib/router.js';
import { openCookbookEditor } from '../components/editors.js';
import * as toast from '../lib/toast.js';
import { StarRating } from '../components/starRating.js';
import { getRecentlyViewed } from '../lib/recentlyViewed.js';
import { currentUser } from '../lib/supabase.js';

export async function HomeView() {
  const root = h('div.container.stack-7');

  // Hero — single centered title, no decorations
  const hero = h('section.hero');
  const title = h('h1', 'Skip the story, get to the recipe.');
  hero.appendChild(title);
  hero.appendChild(h('p.lead', 'Paste any recipe URL. We sift through and hand you the ingredients, instructions, and ratings so you can get cooking straight away. Save anything worth keeping to a cookbook of your own.'));

  // Paste card
  const pasteCard = h('div.paste-card');
  const form = h('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = input.value.trim();
    if (!url) return;
    submit(url);
  });

  const inputWrap = h('div.input-icon.flex-1');
  // Glyph in an explicitly-sized span — relying on CSS width on a raw <svg>
  // without a width attribute is unreliable; wrapping fixes it.
  const glyph = h('span.input-icon-glyph', { 'aria-hidden': 'true' });
  glyph.innerHTML = icon('link');
  inputWrap.appendChild(glyph);
  const input = h('input.input', {
    type: 'url',
    name: 'url',
    placeholder: 'Paste a recipe URL to get started',
    autocomplete: 'off',
    'aria-label': 'Recipe URL',
    autofocus: '',
  });
  inputWrap.appendChild(input);
  form.appendChild(inputWrap);

  const btn = h('button.btn.btn-primary.btn-lg', { type: 'submit' });
  btn.innerHTML = `<span>Sweeten</span>${icon('arrowRight')}`;
  form.appendChild(btn);

  pasteCard.appendChild(form);

  function submit(url) {
    navigate('/recipe?' + new URLSearchParams({ url }).toString());
  }
  hero.appendChild(pasteCard);
  root.appendChild(hero);

  // Cookbooks — always show the section so the "+ New cookbook" affordance
  // is visible. Signed-out visitors see an inline notice strip explaining
  // they need to sign in to save, and clicking the New cookbook tile routes
  // them to /signin instead of opening the editor.
  const user = await currentUser();
  const cookbooksSection = h('section');
  const head = h('div.section-head');
  head.appendChild(h('h2', 'Your Cookbooks'));
  cookbooksSection.appendChild(head);
  if (!user) cookbooksSection.appendChild(SignInNotice());
  const grid = h('div.cookbook-grid');
  cookbooksSection.appendChild(grid);
  root.appendChild(cookbooksSection);

  // Recent recipes — pulled from localStorage so URLs the user only
  // viewed (didn't save) still show up here.
  const recentSection = h('section');
  recentSection.appendChild(h('div.section-head', h('h2', 'Recently Viewed')));
  const recentGrid = h('div.recipe-grid');
  recentSection.appendChild(recentGrid);
  root.appendChild(recentSection);

  async function render() {
    mount(grid);
    // Always render the "+ New cookbook" sentinel tile so signed-out
    // visitors can see the affordance — clicking it just bounces them to
    // /signin. Signed-in visitors get the real grid populated above it.
    if (user) {
      try {
        const { cookbooks } = await api.listCookbooks();
        cookbooks.forEach(cb => grid.appendChild(cookbookCard(cb)));
      } catch (e) {
        grid.appendChild(h('p.muted', 'Could not load cookbooks: ' + e.message));
      }
    }
    const newTile = h('button.cookbook-card.cookbook-new', { type: 'button' });
    const inner = h('div.cookbook-new-inner');
    inner.innerHTML = `${icon('plus')}<span>New cookbook</span>`;
    newTile.appendChild(inner);
    newTile.addEventListener('click', () => {
      if (!user) {
        toast.toast('Sign in to create a cookbook.', { duration: 3000 });
        navigate('/signin');
        return;
      }
      openCookbookEditor({ onSave: () => render() });
    });
    grid.appendChild(newTile);

    // Render recently-viewed recipes from localStorage
    mount(recentGrid);
    const viewed = getRecentlyViewed();
    if (!viewed.length) {
      const empty = h('div.empty');
      empty.innerHTML = `<div class="empty-illustration">${icon('bookmark')}</div>
        <h3>Nothing viewed yet</h3>
        <p>Paste a recipe URL above. We'll keep a list here so you can come back to it whether you save it or not.</p>`;
      recentGrid.appendChild(empty);
      return;
    }
    viewed.forEach(v => recentGrid.appendChild(viewedCard(v)));
  }

  await render();
  return root;
}

function SignInNotice() {
  // Thin notice strip above the cookbook grid for signed-out visitors,
  // explaining why a "+ New cookbook" tile is visible but won't actually
  // save anything until they sign in.
  const notice = h('div.signin-notice', { role: 'note' });
  const lockGlyph = h('span.signin-notice-glyph', { 'aria-hidden': 'true' });
  lockGlyph.innerHTML = icon('bookmark');
  notice.appendChild(lockGlyph);
  const text = h('p.signin-notice-text', 'Sign in to save your cookbooks.');
  notice.appendChild(text);
  const cta = h('a.btn.btn-soft.signin-notice-cta', { href: '#/signin' }, 'Sign in');
  notice.appendChild(cta);
  return notice;
}

function cookbookCard(cb) {
  // A cookbook card *looks* like a physical book: spine on the left,
  // colored cover (or full-bleed image) with the icon and a rounded
  // "label" panel holding the title — the way a school notebook has a
  // pasted label on the front. Tabs from the cookbook stick out the
  // right edge like binder dividers.
  const card = h('button.cookbook-card', { type: 'button' });
  card.style.setProperty('--cover', cb.coverColor || '#F8B4D9');
  card.style.setProperty('--cover-text', cb.coverTextColor || '#FFFFFF');
  if (cb.coverImage) {
    card.setAttribute('data-cover', 'image');
    card.style.setProperty('--cover-image', `url(${JSON.stringify(cb.coverImage)})`);
  } else {
    card.setAttribute('data-cover', 'color');
  }

  const content = h('div.cookbook-cover-content');

  // Title label sits at the top of every cookbook (consistent across all
  // books, whether they have an image cover or just a color). The cookbook
  // editor's color picker controls this panel's background via --cover.
  const label = h('div.cookbook-label');
  label.appendChild(h('h3.cookbook-cover-title', cb.name));
  if (cb.description) label.appendChild(h('p.cookbook-cover-desc', cb.description));
  const meta = h('div.cookbook-cover-meta');
  meta.innerHTML = `${icon('bookmark')}<span>${cb.recipeCount} recipe${cb.recipeCount === 1 ? '' : 's'}</span>`;
  label.appendChild(meta);
  content.appendChild(label);

  // The icon fills the remaining vertical space below the label. Renders on
  // every cover — including image covers — so a photo of the user's bakes
  // can still carry a category glyph. Drop-shadow keeps the icon legible
  // against busy photos. The sentinel 'none' keeps a clean label-only cover.
  if (cb.coverIcon && cb.coverIcon !== 'none') {
    const iconWrap = h('div.cookbook-cover-icon');
    iconWrap.innerHTML = icon(cb.coverIcon);
    content.appendChild(iconWrap);
  }

  card.appendChild(content);

  // Tabs sticking out the right edge of the book — small color chips
  // showing each section. If the tab has an icon assigned in the tab
  // editor we render that glyph; otherwise we fall back to the tab's text
  // name. Capped at 4 so a busy cookbook doesn't overflow.
  if (Array.isArray(cb.tabs) && cb.tabs.length) {
    const tabsWrap = h('div.cookbook-card-tabs', { 'aria-hidden': 'true' });
    cb.tabs.slice(0, 4).forEach(t => {
      const tab = h('span.cookbook-card-tab', { title: t.name });
      tab.style.background = t.color;
      tab.style.color = darken(t.color);
      if (t.icon) {
        tab.classList.add('cookbook-card-tab-icon');
        tab.innerHTML = icon(t.icon);
      } else {
        tab.textContent = t.name;
      }
      tabsWrap.appendChild(tab);
    });
    if (cb.tabs.length > 4) {
      tabsWrap.appendChild(h('span.cookbook-card-tab.cookbook-card-tab-more', `+${cb.tabs.length - 4}`));
    }
    card.appendChild(tabsWrap);
  }

  card.addEventListener('click', () => navigate(`/cookbook/${cb.id}`));
  return card;
}

// Returns a darker version of a hex color, used for legible label text on
// pastel-colored tab chips. Same math as the cookbook detail view.
function darken(hex) {
  if (!hex?.startsWith('#') || hex.length !== 7) return 'currentColor';
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * 0.55);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * 0.55);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * 0.55);
  return `rgb(${r}, ${g}, ${b})`;
}

function recipeCard(r) {
  const card = h('button.recipe-card', { type: 'button' });
  const imgWrap = h('div.recipe-card-image');
  if (r.heroImage) {
    imgWrap.appendChild(h('img', { src: r.heroImage, alt: r.title, loading: 'lazy' }));
  } else {
    const ph = h('div.placeholder');
    ph.innerHTML = icon('image');
    imgWrap.appendChild(ph);
  }
  card.appendChild(imgWrap);

  const content = h('div.recipe-card-content');
  content.appendChild(h('h4', r.title));
  const metaRow = h('div.recipe-card-meta');
  const parts = [];
  if (r.totalMinutes) {
    const span = h('span');
    span.innerHTML = `${icon('clock')}<span style="margin-left:4px">${formatMinutes(r.totalMinutes)}</span>`;
    parts.push(span);
  }
  if (r.userRating || r.externalRating) {
    parts.push(StarRating(r.userRating ?? r.externalRating, null, { size: '0.95em' }));
  }
  parts.forEach((p, i) => {
    if (i > 0) metaRow.appendChild(h('span.dot', '·'));
    metaRow.appendChild(p);
  });
  content.appendChild(metaRow);
  card.appendChild(content);
  card.addEventListener('click', () => navigate(`/saved/${r.id}`));
  return card;
}

function viewedCard(v) {
  // Recently-viewed entries come from localStorage. Saved ones link to their
  // detail page; parsed ones replay the URL through the parser. When the
  // saved id no longer resolves on the server (e.g. another machine, or the
  // recipe was deleted) we still pass the source URL along as ?fallback=,
  // and SavedRecipeView replays it through the parser on 404 instead of
  // dead-ending on a "Recipe not found" page.
  const card = h('div.recipe-card.recipe-card-clickable', { tabindex: '0', role: 'button', 'aria-label': v.title });
  const imgWrap = h('div.recipe-card-image');
  if (v.heroImage) {
    imgWrap.appendChild(h('img', { src: v.heroImage, alt: v.title, loading: 'lazy' }));
  } else {
    const ph = h('div.placeholder');
    ph.innerHTML = icon('image');
    imgWrap.appendChild(ph);
  }
  // Small badge in the corner so users can tell at a glance whether a card
  // is in their cookbook or just a quick parse-and-go.
  if (v.kind === 'saved') {
    const badge = h('span.recipe-card-tab', { style: { background: 'var(--pink-400)' } }, 'Saved');
    imgWrap.appendChild(badge);
  }
  card.appendChild(imgWrap);

  const content = h('div.recipe-card-content');
  content.appendChild(h('h4', v.title));
  const metaRow = h('div.recipe-card-meta');
  const parts = [];
  if (v.totalMinutes) {
    const span = h('span');
    span.innerHTML = `${icon('clock')}<span style="margin-left:4px">${formatMinutes(v.totalMinutes)}</span>`;
    parts.push(span);
  }
  if (v.externalRating) {
    parts.push(StarRating(v.externalRating, null, { size: '0.95em' }));
  }
  parts.forEach((p, i) => {
    if (i > 0) metaRow.appendChild(h('span.dot', '·'));
    metaRow.appendChild(p);
  });
  // "Original" link tucks into the bottom-right of the card. stopPropagation
  // so clicking it opens the source in a new tab without also triggering
  // the card's main navigation.
  if (v.url) {
    const ext = h('a.recipe-card-source', {
      href: v.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: 'Open the original recipe page',
      'aria-label': 'Open the original recipe page in a new tab',
    });
    ext.innerHTML = `${icon('external')}<span>Original</span>`;
    ext.addEventListener('click', (e) => e.stopPropagation());
    metaRow.appendChild(h('span.spacer'));
    metaRow.appendChild(ext);
  }
  content.appendChild(metaRow);
  card.appendChild(content);

  const open = () => {
    if (v.kind === 'saved' && v.id != null) {
      const qs = v.url ? '?' + new URLSearchParams({ fallback: v.url }) : '';
      navigate(`/saved/${v.id}${qs}`);
    } else if (v.url) {
      navigate('/recipe?' + new URLSearchParams({ url: v.url }));
    }
  };
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  return card;
}

function formatMinutes(m) {
  if (!m || m <= 0) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h}h ${r}m`;
}
