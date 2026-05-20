import { Router } from 'express';
import multer from 'multer';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import db from '../db.js';
import { parseIngredient } from '../parser/quantity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = resolve(__dirname, '..', '..', 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      const safeExt = /^\.(jpg|jpeg|png|gif|webp|heic|avif)$/i.test(ext) ? ext : '.jpg';
      cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

const router = Router();

function rowToRecipe(row) {
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
    ingredients: JSON.parse(row.ingredients_json || '[]'),
    instructions: JSON.parse(row.instructions_json || '[]'),
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
  return {
    id: row.id,
    recipeId: row.recipe_id,
    url: `/uploads/${row.filename}`,
    caption: row.caption,
    position: row.position,
    createdAt: row.created_at,
  };
}

router.get('/recipes', (req, res) => {
  const { cookbookId, tabId, limit } = req.query;
  const conditions = [];
  const params = [];
  if (cookbookId) { conditions.push('cookbook_id = ?'); params.push(Number(cookbookId)); }
  if (tabId)      { conditions.push('tab_id = ?');      params.push(Number(tabId)); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const lim = Math.min(Number(limit) || 50, 200);
  const rows = db.prepare(`
    SELECT id, cookbook_id, tab_id, title, hero_image, total_minutes, prep_minutes,
           cook_minutes, external_rating, external_rating_count, user_rating,
           source_url, created_at
    FROM recipes
    ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...params, lim);
  res.json({
    recipes: rows.map(r => ({
      id: r.id,
      cookbookId: r.cookbook_id,
      tabId: r.tab_id,
      title: r.title,
      heroImage: r.hero_image,
      totalMinutes: r.total_minutes,
      prepMinutes: r.prep_minutes,
      cookMinutes: r.cook_minutes,
      externalRating: r.external_rating,
      externalRatingCount: r.external_rating_count,
      userRating: r.user_rating,
      sourceUrl: r.source_url,
      createdAt: r.created_at,
    })),
  });
});

// Coerce client ingredients (which can be either raw strings, simple
// { text } objects, or fully-parsed { text, quantity, unit, name } objects)
// into the parsed schema the rest of the app expects. The save-from-URL
// flow already produces parsed shapes; manual entry usually only sends
// raw text, which we run through the existing parseIngredient so the
// servings stepper and print view still get quantity/unit metadata.
function normalizeIngredients(list) {
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    if (typeof item === 'string') {
      return parseIngredient(item) || { text: item, name: item };
    }
    if (item && typeof item === 'object') {
      if (item.quantity != null || item.unit) return item;
      if (item.text) return parseIngredient(item.text) || item;
    }
    return null;
  }).filter(Boolean);
}

// Mirror for instructions: clients may send strings, objects with text, or
// section-heading objects ({ isHeading: true, section: 'Preparation' }).
// Normalise into the { index, text, isHeading, section } shape the
// renderer + print stylesheet already understand.
function normalizeInstructions(list) {
  if (!Array.isArray(list)) return [];
  let idx = 0;
  return list.map(item => {
    if (typeof item === 'string') {
      return { index: idx++, text: item.trim(), isHeading: false, section: null };
    }
    if (item && typeof item === 'object') {
      if (item.isHeading) {
        return { index: idx, text: '', isHeading: true, section: (item.section || item.text || '').trim() };
      }
      const text = (item.text || '').trim();
      if (!text) return null;
      return { index: idx++, text, isHeading: false, section: null };
    }
    return null;
  }).filter(Boolean);
}

router.post('/recipes', (req, res) => {
  const { cookbookId, tabId, recipe } = req.body || {};
  if (!recipe || typeof recipe !== 'object') {
    return res.status(400).json({ error: '`recipe` payload is required.' });
  }
  if (!recipe.title) {
    return res.status(400).json({ error: 'Recipe must have a title.' });
  }
  if (cookbookId) {
    const exists = db.prepare('SELECT id FROM cookbooks WHERE id = ?').get(Number(cookbookId));
    if (!exists) return res.status(400).json({ error: 'Cookbook not found.' });
  }
  if (tabId) {
    const exists = db.prepare('SELECT id FROM tabs WHERE id = ?').get(Number(tabId));
    if (!exists) return res.status(400).json({ error: 'Tab not found.' });
  }
  const ingredients = normalizeIngredients(recipe.ingredients);
  const instructions = normalizeInstructions(recipe.instructions);
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO recipes (
      cookbook_id, tab_id, source_url, title, description, hero_image, author,
      prep_minutes, cook_minutes, total_minutes, servings, yield_text,
      ingredients_json, instructions_json, external_rating, external_rating_count,
      user_rating, user_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cookbookId ? Number(cookbookId) : null,
    tabId ? Number(tabId) : null,
    recipe.sourceUrl || null,
    recipe.title,
    recipe.description || null,
    recipe.heroImage || null,
    recipe.author || null,
    recipe.prepMinutes ?? null,
    recipe.cookMinutes ?? null,
    recipe.totalMinutes ?? null,
    recipe.servings ?? null,
    recipe.yieldText || null,
    JSON.stringify(ingredients),
    JSON.stringify(instructions),
    recipe.rating?.value ?? recipe.externalRating ?? null,
    recipe.rating?.count ?? recipe.externalRatingCount ?? null,
    recipe.userRating ?? null,
    recipe.userNotes ?? null,
    now,
    now,
  );
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ recipe: rowToRecipe(row) });
});

router.get('/recipes/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Recipe not found.' });
  const photos = db.prepare(`
    SELECT * FROM recipe_photos WHERE recipe_id = ? ORDER BY position ASC, id ASC
  `).all(id);
  res.json({
    recipe: rowToRecipe(row),
    photos: photos.map(photoRow),
  });
});

router.patch('/recipes/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Recipe not found.' });
  const {
    cookbookId, tabId, userRating, userNotes, title, servings,
    ingredients, instructions,
    // Extra fields accepted on top of the original save-flow patch surface
    // so the manual recipe editor can edit every field a user might fill
    // in. All are optional — `undefined` keeps the existing value.
    description, heroImage, author, prepMinutes, cookMinutes, totalMinutes,
    yieldText,
  } = req.body || {};
  const now = Date.now();
  const normalizedIngredients = ingredients ? normalizeIngredients(ingredients) : null;
  const normalizedInstructions = instructions ? normalizeInstructions(instructions) : null;
  db.prepare(`
    UPDATE recipes
    SET cookbook_id = COALESCE(?, cookbook_id),
        tab_id = ?,
        user_rating = COALESCE(?, user_rating),
        user_notes = COALESCE(?, user_notes),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        hero_image = COALESCE(?, hero_image),
        author = COALESCE(?, author),
        prep_minutes = COALESCE(?, prep_minutes),
        cook_minutes = COALESCE(?, cook_minutes),
        total_minutes = COALESCE(?, total_minutes),
        servings = COALESCE(?, servings),
        yield_text = COALESCE(?, yield_text),
        ingredients_json = COALESCE(?, ingredients_json),
        instructions_json = COALESCE(?, instructions_json),
        updated_at = ?
    WHERE id = ?
  `).run(
    cookbookId !== undefined ? (cookbookId === null ? null : Number(cookbookId)) : null,
    // tab_id is explicitly settable to NULL, so we always send it through
    tabId === undefined ? existing.tab_id : (tabId === null ? null : Number(tabId)),
    userRating ?? null,
    userNotes !== undefined ? userNotes : null,
    title?.trim() ?? null,
    description ?? null,
    heroImage ?? null,
    author ?? null,
    prepMinutes ?? null,
    cookMinutes ?? null,
    totalMinutes ?? null,
    servings ?? null,
    yieldText ?? null,
    normalizedIngredients ? JSON.stringify(normalizedIngredients) : null,
    normalizedInstructions ? JSON.stringify(normalizedInstructions) : null,
    now,
    id,
  );
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  res.json({ recipe: rowToRecipe(row) });
});

router.delete('/recipes/:id', (req, res) => {
  const id = Number(req.params.id);
  // Photos cascade-delete from FK, but we need to clean the files off disk.
  const photos = db.prepare('SELECT filename FROM recipe_photos WHERE recipe_id = ?').all(id);
  const info = db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Recipe not found.' });
  for (const p of photos) {
    const fp = join(UPLOAD_DIR, p.filename);
    if (existsSync(fp)) {
      try { unlinkSync(fp); } catch { /* ignore */ }
    }
  }
  res.status(204).end();
});

// Generic single-image upload. Used by the manual recipe editor to attach
// a hero image before the recipe row exists (so we can't use the photos
// endpoint, which requires a recipe id). Returns the URL the client should
// stash into the recipe's heroImage field.
router.post('/uploads/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

// Photos -------------------------------------------------------------------

router.post('/recipes/:id/photos', upload.array('photo', 8), (req, res) => {
  const recipeId = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM recipes WHERE id = ?').get(recipeId);
  if (!exists) return res.status(404).json({ error: 'Recipe not found.' });
  const now = Date.now();
  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) AS m FROM recipe_photos WHERE recipe_id = ?'
  ).get(recipeId).m;
  const insert = db.prepare(`
    INSERT INTO recipe_photos (recipe_id, filename, caption, position, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const out = [];
  (req.files || []).forEach((f, i) => {
    const info = insert.run(recipeId, f.filename, null, maxPos + 1 + i, now);
    const row = db.prepare('SELECT * FROM recipe_photos WHERE id = ?').get(info.lastInsertRowid);
    out.push(photoRow(row));
  });
  res.status(201).json({ photos: out });
});

router.patch('/photos/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM recipe_photos WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Photo not found.' });
  const { caption, position } = req.body || {};
  db.prepare(`
    UPDATE recipe_photos SET caption = COALESCE(?, caption), position = COALESCE(?, position) WHERE id = ?
  `).run(caption ?? null, position ?? null, id);
  const row = db.prepare('SELECT * FROM recipe_photos WHERE id = ?').get(id);
  res.json({ photo: photoRow(row) });
});

router.delete('/photos/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT filename FROM recipe_photos WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Photo not found.' });
  db.prepare('DELETE FROM recipe_photos WHERE id = ?').run(id);
  const fp = join(UPLOAD_DIR, row.filename);
  if (existsSync(fp)) {
    try { unlinkSync(fp); } catch { /* ignore */ }
  }
  res.status(204).end();
});

export default router;
