// Supabase-backed API layer — drop-in replacement for the original
// express/sqlite layer. The public interface (`api.xxx`) is identical so the
// existing views and components keep working unchanged. Every read/write
// goes through Supabase Postgres with row-level security scoping rows to the
// signed-in user, and photos go through a public Storage bucket with
// per-user-path RLS on writes.
//
// All mutating methods call `requireUser()` so views see a consistent
// `NOT_AUTHENTICATED` error if the visitor is signed out. Reads also require
// auth — RLS would return empty results either way, and erroring earlier
// gives a cleaner UX than silently rendering "no cookbooks".

import { supabase, requireUser } from './supabase.js';
import { PHOTO_BUCKET, COVER_PRESETS } from './config.js';

/* ─── shape adapters ──────────────────────────────────────────────────────
   Postgres returns snake_case; the original sqlite-backed routes responded
   in camelCase. We reshape at the boundary so views stay unchanged. */

function cookbookRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    coverColor: row.cover_color,
    coverIcon: row.cover_icon,
    coverImage: row.cover_image,
    coverTextColor: row.cover_text_color || '#FFFFFF',
    description: row.description,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tabRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    cookbookId: row.cookbook_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    position: row.position,
  };
}

function recipeListRow(row) {
  return {
    id: row.id,
    cookbookId: row.cookbook_id,
    tabId: row.tab_id,
    title: row.title,
    heroImage: row.hero_image,
    totalMinutes: row.total_minutes,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    externalRating: row.external_rating,
    externalRatingCount: row.external_rating_count,
    userRating: row.user_rating,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
  };
}

function recipeFullRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    cookbookId: row.cookbook_id,
    tabId: row.tab_id,
    sourceUrl: row.source_url,
    title: row.title,
    description: row.description,
    heroImage: row.hero_image,
    author: row.author,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    totalMinutes: row.total_minutes,
    servings: row.servings,
    yieldText: row.yield_text,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    instructions: Array.isArray(row.instructions) ? row.instructions : [],
    externalRating: row.external_rating,
    externalRatingCount: row.external_rating_count,
    userRating: row.user_rating,
    userNotes: row.user_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function photoRow(row) {
  if (!row) return null;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(row.storage_path);
  return {
    id: row.id,
    recipeId: row.recipe_id,
    url: data.publicUrl,
    storagePath: row.storage_path,
    caption: row.caption,
    position: row.position,
    createdAt: row.created_at,
  };
}

/* ─── error helper ──────────────────────────────────────────────────────── */

function wrap(error, fallbackMessage) {
  if (!error) return null;
  const err = new Error(error.message || fallbackMessage);
  if (error.code) err.code = error.code;
  err.status = error.status || 500;
  return err;
}

/* ─── storage helpers ───────────────────────────────────────────────────── */

function randomSuffix(len = 10) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}

function fileExt(file) {
  const m = String(file.name || '').match(/\.([a-z0-9]+)$/i);
  const ext = m ? m[1].toLowerCase() : 'jpg';
  return /^(jpe?g|png|gif|webp|avif|heic)$/.test(ext) ? ext : 'jpg';
}

async function uploadToBucket(userId, subdir, file) {
  const path = `${userId}/${subdir}/${Date.now()}-${randomSuffix()}.${fileExt(file)}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    cacheControl: '604800',  // 7d, matches the old express maxAge
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw wrap(error, 'Upload failed');
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function deleteFromBucket(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.warn('[sift storage] remove failed:', error.message);
}

/* ─── parse (recipe URL → structured recipe) ───────────────────────────── */
// Talks to the Vercel serverless function at /api/sift-parse. The endpoint
// lives at the site root, not under /sift/, so we use an absolute path.

async function parseUrl(url, signal) {
  const res = await fetch('/api/sift-parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/* ─── cookbooks + tabs ─────────────────────────────────────────────────── */

async function listCookbooks() {
  await requireUser();
  const [cb, tb, rc] = await Promise.all([
    supabase.from('cookbooks').select('*').order('position', { ascending: true }).order('id', { ascending: true }),
    supabase.from('tabs').select('*').order('cookbook_id', { ascending: true }).order('position', { ascending: true }),
    supabase.from('recipes').select('cookbook_id'),
  ]);
  if (cb.error) throw wrap(cb.error, 'Failed to load cookbooks');
  if (tb.error) throw wrap(tb.error, 'Failed to load tabs');
  if (rc.error) throw wrap(rc.error, 'Failed to load recipes');

  const tabsByBook = {};
  for (const t of tb.data) {
    (tabsByBook[t.cookbook_id] = tabsByBook[t.cookbook_id] || []).push(tabRow(t));
  }
  const countByBook = {};
  for (const r of rc.data) {
    if (r.cookbook_id != null) countByBook[r.cookbook_id] = (countByBook[r.cookbook_id] || 0) + 1;
  }
  return {
    cookbooks: cb.data.map(r => ({
      ...cookbookRow(r),
      recipeCount: countByBook[r.id] || 0,
      tabs: tabsByBook[r.id] || [],
    })),
  };
}

async function getCookbook(id) {
  await requireUser();
  const cookbookId = Number(id);
  const [bk, tb, rc] = await Promise.all([
    supabase.from('cookbooks').select('*').eq('id', cookbookId).maybeSingle(),
    supabase.from('tabs').select('*').eq('cookbook_id', cookbookId)
      .order('position', { ascending: true }).order('id', { ascending: true }),
    supabase.from('recipes').select(
      'id, cookbook_id, tab_id, title, hero_image, total_minutes, prep_minutes, cook_minutes, external_rating, external_rating_count, user_rating, source_url, created_at'
    ).eq('cookbook_id', cookbookId).order('created_at', { ascending: false }),
  ]);
  if (bk.error) throw wrap(bk.error, 'Failed to load cookbook');
  if (!bk.data) {
    const err = new Error('Cookbook not found.'); err.status = 404; throw err;
  }
  if (tb.error) throw wrap(tb.error, 'Failed to load tabs');
  if (rc.error) throw wrap(rc.error, 'Failed to load recipes');

  const tabCounts = {};
  for (const r of rc.data) {
    if (r.tab_id != null) tabCounts[r.tab_id] = (tabCounts[r.tab_id] || 0) + 1;
  }
  return {
    cookbook: cookbookRow(bk.data),
    tabs: tb.data.map(t => ({ ...tabRow(t), recipeCount: tabCounts[t.id] || 0 })),
    recipes: rc.data.map(recipeListRow),
  };
}

async function createCookbook(data) {
  const user = await requireUser();
  const name = String(data?.name || '').trim();
  if (!name) {
    const err = new Error('Cookbook name is required.'); err.status = 400; throw err;
  }
  const { data: existing } = await supabase.from('cookbooks').select('position');
  const maxPos = existing?.reduce((m, r) => Math.max(m, r.position ?? -1), -1) ?? -1;
  const row = {
    user_id: user.id,
    name,
    cover_color: data.coverColor || '#F8B4D9',
    cover_icon: data.coverIcon || 'cupcake',
    cover_image: data.coverImage || null,
    cover_text_color: data.coverTextColor || '#FFFFFF',
    description: data.description || null,
    position: maxPos + 1,
  };
  const { data: ins, error } = await supabase.from('cookbooks').insert(row).select().single();
  if (error) throw wrap(error, 'Failed to create cookbook');
  return { cookbook: cookbookRow(ins) };
}

async function updateCookbook(id, data) {
  await requireUser();
  const patch = {};
  // cover_image is explicitly nullable — `null` clears it; `undefined` leaves
  // it. Same semantics as the original express route, which used COALESCE
  // for all other columns.
  if (data.name !== undefined) patch.name = String(data.name).trim();
  if (data.coverColor !== undefined) patch.cover_color = data.coverColor;
  if (data.coverIcon !== undefined) patch.cover_icon = data.coverIcon;
  if (data.coverImage !== undefined) patch.cover_image = data.coverImage;
  if (data.coverTextColor !== undefined) patch.cover_text_color = data.coverTextColor;
  if (data.description !== undefined) patch.description = data.description;
  if (data.position !== undefined) patch.position = data.position;
  const { data: row, error } = await supabase.from('cookbooks').update(patch).eq('id', Number(id)).select().single();
  if (error) throw wrap(error, 'Failed to update cookbook');
  return { cookbook: cookbookRow(row) };
}

async function deleteCookbook(id) {
  await requireUser();
  // Photos cascade-delete via FK, but storage objects don't. Fetch the paths
  // first, then drop the cookbook (DB cascade), then sweep storage.
  const { data: photos } = await supabase
    .from('recipe_photos')
    .select('storage_path, recipes!inner(cookbook_id)')
    .eq('recipes.cookbook_id', Number(id));
  const { error } = await supabase.from('cookbooks').delete().eq('id', Number(id));
  if (error) throw wrap(error, 'Failed to delete cookbook');
  if (photos?.length) {
    await Promise.allSettled(photos.map(p => deleteFromBucket(p.storage_path)));
  }
  return null;
}

async function listCoverPresets() {
  return { presets: COVER_PRESETS };
}

async function uploadCoverImage(cookbookId, file) {
  const user = await requireUser();
  if (!file) {
    const err = new Error('No file uploaded.'); err.status = 400; throw err;
  }
  const { data: prev } = await supabase.from('cookbooks').select('cover_image').eq('id', Number(cookbookId)).maybeSingle();
  const { url, path } = await uploadToBucket(user.id, `covers/${cookbookId}`, file);
  const { data: row, error } = await supabase.from('cookbooks').update({ cover_image: url }).eq('id', Number(cookbookId)).select().single();
  if (error) throw wrap(error, 'Failed to set cover image');
  // Sweep the previous custom cover, but ONLY if it points to our storage
  // bucket (preset SVG URLs that live under /sift/assets/ should be left
  // alone — those are shipped static files, not user uploads).
  const prevUrl = prev?.cover_image || '';
  if (prevUrl && prevUrl !== url && prevUrl.includes(`/${PHOTO_BUCKET}/`)) {
    const oldPath = prevUrl.split(`/${PHOTO_BUCKET}/`)[1];
    if (oldPath) await deleteFromBucket(oldPath);
  }
  return { cookbook: cookbookRow(row), url };
}

/* ─── tabs ────────────────────────────────────────────────────────────── */

async function createTab(cookbookId, data) {
  const user = await requireUser();
  const name = String(data?.name || '').trim();
  if (!name) {
    const err = new Error('Tab name is required.'); err.status = 400; throw err;
  }
  const { data: existing } = await supabase.from('tabs').select('position').eq('cookbook_id', Number(cookbookId));
  const maxPos = existing?.reduce((m, r) => Math.max(m, r.position ?? -1), -1) ?? -1;
  const { data: ins, error } = await supabase.from('tabs').insert({
    user_id: user.id,
    cookbook_id: Number(cookbookId),
    name,
    color: data.color || '#FFD6E8',
    icon: data.icon || null,
    position: maxPos + 1,
  }).select().single();
  if (error) throw wrap(error, 'Failed to create tab');
  return { tab: tabRow(ins) };
}

async function updateTab(id, data) {
  await requireUser();
  const patch = {};
  if (data.name !== undefined) patch.name = String(data.name).trim();
  if (data.color !== undefined) patch.color = data.color;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.position !== undefined) patch.position = data.position;
  const { data: row, error } = await supabase.from('tabs').update(patch).eq('id', Number(id)).select().single();
  if (error) throw wrap(error, 'Failed to update tab');
  return { tab: tabRow(row) };
}

async function deleteTab(id) {
  await requireUser();
  const { error } = await supabase.from('tabs').delete().eq('id', Number(id));
  if (error) throw wrap(error, 'Failed to delete tab');
  return null;
}

async function reorderTabs(ids) {
  await requireUser();
  if (!Array.isArray(ids)) {
    const err = new Error('`ids` array required.'); err.status = 400; throw err;
  }
  const results = await Promise.all(
    ids.map((id, i) => supabase.from('tabs').update({ position: i }).eq('id', Number(id)))
  );
  const failure = results.find(r => r.error);
  if (failure) throw wrap(failure.error, 'Failed to reorder tabs');
  return null;
}

/* ─── recipes ─────────────────────────────────────────────────────────── */

async function listRecipes(params = {}) {
  await requireUser();
  const cols = 'id, cookbook_id, tab_id, title, hero_image, total_minutes, prep_minutes, cook_minutes, external_rating, external_rating_count, user_rating, source_url, created_at';
  let q = supabase.from('recipes').select(cols);
  if (params.cookbookId) q = q.eq('cookbook_id', Number(params.cookbookId));
  if (params.tabId) q = q.eq('tab_id', Number(params.tabId));
  q = q.order('created_at', { ascending: false }).limit(Math.min(Number(params.limit) || 50, 200));
  const { data, error } = await q;
  if (error) throw wrap(error, 'Failed to load recipes');
  return { recipes: data.map(recipeListRow) };
}

async function getRecipe(id) {
  await requireUser();
  const [r, p] = await Promise.all([
    supabase.from('recipes').select('*').eq('id', Number(id)).maybeSingle(),
    supabase.from('recipe_photos').select('*').eq('recipe_id', Number(id))
      .order('position', { ascending: true }).order('id', { ascending: true }),
  ]);
  if (r.error) throw wrap(r.error, 'Failed to load recipe');
  if (!r.data) {
    const err = new Error('Recipe not found.'); err.status = 404; throw err;
  }
  if (p.error) throw wrap(p.error, 'Failed to load photos');
  return {
    recipe: recipeFullRow(r.data),
    photos: p.data.map(photoRow),
  };
}

async function saveRecipe(payload) {
  const user = await requireUser();
  const { cookbookId, tabId, recipe } = payload || {};
  if (!recipe || typeof recipe !== 'object') {
    const err = new Error('`recipe` payload is required.'); err.status = 400; throw err;
  }
  if (!recipe.title) {
    const err = new Error('Recipe must have a title.'); err.status = 400; throw err;
  }
  const row = {
    user_id: user.id,
    cookbook_id: cookbookId ? Number(cookbookId) : null,
    tab_id: tabId ? Number(tabId) : null,
    source_url: recipe.sourceUrl || null,
    title: recipe.title,
    description: recipe.description || null,
    hero_image: recipe.heroImage || null,
    author: recipe.author || null,
    prep_minutes: recipe.prepMinutes ?? null,
    cook_minutes: recipe.cookMinutes ?? null,
    total_minutes: recipe.totalMinutes ?? null,
    servings: recipe.servings ?? null,
    yield_text: recipe.yieldText || null,
    ingredients: recipe.ingredients || [],
    instructions: recipe.instructions || [],
    external_rating: recipe.rating?.value ?? recipe.externalRating ?? null,
    external_rating_count: recipe.rating?.count ?? recipe.externalRatingCount ?? null,
    user_rating: recipe.userRating ?? null,
    user_notes: recipe.userNotes ?? null,
  };
  const { data, error } = await supabase.from('recipes').insert(row).select().single();
  if (error) throw wrap(error, 'Failed to save recipe');
  return { recipe: recipeFullRow(data) };
}

async function updateRecipe(id, data) {
  await requireUser();
  const patch = {};
  if (data.cookbookId !== undefined) patch.cookbook_id = data.cookbookId === null ? null : Number(data.cookbookId);
  // tab_id is explicitly settable to NULL (e.g. moving a recipe out of a tab)
  if (data.tabId !== undefined) patch.tab_id = data.tabId === null ? null : Number(data.tabId);
  if (data.userRating !== undefined) patch.user_rating = data.userRating;
  if (data.userNotes !== undefined) patch.user_notes = data.userNotes;
  if (data.title !== undefined) patch.title = String(data.title).trim();
  if (data.servings !== undefined) patch.servings = data.servings;
  if (data.ingredients !== undefined) patch.ingredients = data.ingredients;
  if (data.instructions !== undefined) patch.instructions = data.instructions;
  const { data: row, error } = await supabase.from('recipes').update(patch).eq('id', Number(id)).select().single();
  if (error) throw wrap(error, 'Failed to update recipe');
  return { recipe: recipeFullRow(row) };
}

async function deleteRecipe(id) {
  await requireUser();
  const { data: photos } = await supabase.from('recipe_photos').select('storage_path').eq('recipe_id', Number(id));
  const { error } = await supabase.from('recipes').delete().eq('id', Number(id));
  if (error) throw wrap(error, 'Failed to delete recipe');
  if (photos?.length) {
    await Promise.allSettled(photos.map(p => deleteFromBucket(p.storage_path)));
  }
  return null;
}

/* ─── photos ─────────────────────────────────────────────────────────── */

async function uploadPhotos(recipeId, files) {
  const user = await requireUser();
  const list = Array.from(files || []);
  if (!list.length) {
    const err = new Error('No files provided.'); err.status = 400; throw err;
  }
  const { data: existing } = await supabase.from('recipe_photos').select('position').eq('recipe_id', Number(recipeId));
  let nextPos = (existing?.reduce((m, r) => Math.max(m, r.position ?? -1), -1) ?? -1) + 1;

  const out = [];
  for (const file of list) {
    const { path } = await uploadToBucket(user.id, `recipes/${recipeId}`, file);
    const { data, error } = await supabase.from('recipe_photos').insert({
      user_id: user.id,
      recipe_id: Number(recipeId),
      storage_path: path,
      caption: null,
      position: nextPos++,
    }).select().single();
    if (error) {
      // Storage write succeeded but DB insert failed — sweep the orphan.
      await deleteFromBucket(path);
      throw wrap(error, 'Failed to save photo');
    }
    out.push(photoRow(data));
  }
  return { photos: out };
}

async function deletePhoto(id) {
  await requireUser();
  const { data: row } = await supabase.from('recipe_photos').select('storage_path').eq('id', Number(id)).maybeSingle();
  if (!row) {
    const err = new Error('Photo not found.'); err.status = 404; throw err;
  }
  const { error } = await supabase.from('recipe_photos').delete().eq('id', Number(id));
  if (error) throw wrap(error, 'Failed to delete photo');
  await deleteFromBucket(row.storage_path);
  return null;
}

/* ─── public surface — matches the original lib/api.js shape exactly ──── */

export const api = {
  parseUrl,

  // Cookbooks
  listCookbooks,
  getCookbook,
  createCookbook,
  updateCookbook,
  deleteCookbook,
  listCoverPresets,
  uploadCoverImage,

  // Tabs
  createTab,
  updateTab,
  deleteTab,
  reorderTabs,

  // Recipes
  listRecipes,
  getRecipe,
  saveRecipe,
  updateRecipe,
  deleteRecipe,

  // Photos
  uploadPhotos,
  deletePhoto,
};
