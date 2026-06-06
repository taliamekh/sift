import { Router } from 'express';
import multer from 'multer';
import { mkdirSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import db from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = resolve(__dirname, '..', '..', 'uploads');
const PRESET_DIR = resolve(__dirname, '..', '..', 'assets', 'covers');
mkdirSync(UPLOAD_DIR, { recursive: true });
mkdirSync(PRESET_DIR, { recursive: true });

const coverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      const safeExt = /^\.(jpg|jpeg|png|gif|webp|avif)$/i.test(ext) ? ext : '.jpg';
      cb(null, `cover-${Date.now()}-${randomBytes(5).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(/^image\//i.test(file.mimetype) ? null : new Error('Only images allowed'), true),
});

const router = Router();

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

router.get('/cookbooks', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM recipes r WHERE r.cookbook_id = c.id) AS recipe_count
    FROM cookbooks c
    ORDER BY c.position ASC, c.id ASC
  `).all();
  // Include the cookbook's tabs in the list response so the home page can
  // render them as little tabs sticking out of each book card.
  const allTabs = db.prepare('SELECT * FROM tabs ORDER BY cookbook_id, position ASC').all();
  const tabsByBook = {};
  for (const t of allTabs) {
    if (!tabsByBook[t.cookbook_id]) tabsByBook[t.cookbook_id] = [];
    tabsByBook[t.cookbook_id].push(tabRow(t));
  }
  res.json({
    cookbooks: rows.map(r => ({
      ...cookbookRow(r),
      recipeCount: r.recipe_count,
      tabs: tabsByBook[r.id] || [],
    })),
  });
});

router.post('/cookbooks', (req, res) => {
  const { name, coverColor, coverIcon, coverImage, coverTextColor, description } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Cookbook name is required.' });
  }
  const now = Date.now();
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM cookbooks').get().m;
  const info = db.prepare(`
    INSERT INTO cookbooks (name, cover_color, cover_icon, cover_image, cover_text_color, description, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    coverColor || '#F8B4D9',
    coverIcon || 'cupcake',
    coverImage || null,
    coverTextColor || '#FFFFFF',
    description || null,
    maxPos + 1,
    now,
    now,
  );
  const row = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ cookbook: cookbookRow(row) });
});

router.patch('/cookbooks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Cookbook not found.' });
  const { name, coverColor, coverIcon, coverImage, coverTextColor, description, position } = req.body || {};
  const now = Date.now();
  // coverImage is special: a literal `null` clears it; `undefined` leaves it.
  const nextCoverImage = coverImage === undefined ? existing.cover_image : coverImage;
  db.prepare(`
    UPDATE cookbooks
    SET name = COALESCE(?, name),
        cover_color = COALESCE(?, cover_color),
        cover_icon = COALESCE(?, cover_icon),
        cover_image = ?,
        cover_text_color = COALESCE(?, cover_text_color),
        description = COALESCE(?, description),
        position = COALESCE(?, position),
        updated_at = ?
    WHERE id = ?
  `).run(
    name?.trim() ?? null,
    coverColor ?? null,
    coverIcon ?? null,
    nextCoverImage,
    coverTextColor ?? null,
    description ?? null,
    position ?? null,
    now,
    id,
  );
  const row = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(id);
  res.json({ cookbook: cookbookRow(row) });
});

// Upload a custom cover image — returns the URL path which the client then
// PATCHes onto the cookbook as coverImage.
router.post('/cookbooks/:id/cover-image', coverUpload.single('cover'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id, cover_image FROM cookbooks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Cookbook not found.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const url = `/uploads/${req.file.filename}`;
  // Sweep the previous uploaded cover (if any, and if it was an upload, not
  // a preset under /assets) so users can re-upload without leaving orphans.
  if (existing.cover_image && existing.cover_image.startsWith('/uploads/')) {
    const oldPath = join(UPLOAD_DIR, existing.cover_image.replace('/uploads/', ''));
    if (existsSync(oldPath)) { try { unlinkSync(oldPath); } catch { /* ignore */ } }
  }
  db.prepare('UPDATE cookbooks SET cover_image = ?, updated_at = ? WHERE id = ?').run(url, Date.now(), id);
  const row = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(id);
  res.status(201).json({ cookbook: cookbookRow(row), url });
});

// List the files currently sitting in assets/covers/ — these are the
// preset cover options that show in the editor. Drop any image into that
// folder and it appears as a selectable preset.
router.get('/cover-presets', (_req, res) => {
  try {
    const files = readdirSync(PRESET_DIR)
      .filter(name => /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(name))
      .filter(name => !name.startsWith('.'))
      .sort()
      .map(name => ({ name, url: `/assets/covers/${name}` }));
    res.json({ presets: files });
  } catch (err) {
    res.json({ presets: [] });
  }
});

router.delete('/cookbooks/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM cookbooks WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Cookbook not found.' });
  res.status(204).end();
});

router.get('/cookbooks/:id', (req, res) => {
  const id = Number(req.params.id);
  const book = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(id);
  if (!book) return res.status(404).json({ error: 'Cookbook not found.' });

  const tabs = db.prepare(`
    SELECT t.*,
           (SELECT COUNT(*) FROM recipes r WHERE r.tab_id = t.id) AS recipe_count
    FROM tabs t
    WHERE cookbook_id = ?
    ORDER BY position ASC, id ASC
  `).all(id);

  const recipes = db.prepare(`
    SELECT id, tab_id, title, hero_image, total_minutes, prep_minutes, cook_minutes,
           external_rating, external_rating_count, user_rating, source_url, created_at
    FROM recipes
    WHERE cookbook_id = ?
    ORDER BY created_at DESC
  `).all(id);

  res.json({
    cookbook: cookbookRow(book),
    tabs: tabs.map(t => ({ ...tabRow(t), recipeCount: t.recipe_count })),
    recipes: recipes.map(r => ({
      id: r.id,
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

// Tabs nested under a cookbook ---------------------------------------------

router.post('/cookbooks/:id/tabs', (req, res) => {
  const cookbookId = Number(req.params.id);
  const book = db.prepare('SELECT id FROM cookbooks WHERE id = ?').get(cookbookId);
  if (!book) return res.status(404).json({ error: 'Cookbook not found.' });
  const { name, color, icon } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Tab name is required.' });
  }
  const now = Date.now();
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tabs WHERE cookbook_id = ?').get(cookbookId).m;
  const info = db.prepare(`
    INSERT INTO tabs (cookbook_id, name, color, icon, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(cookbookId, name.trim(), color || '#FFD6E8', icon || null, maxPos + 1, now, now);
  const row = db.prepare('SELECT * FROM tabs WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ tab: tabRow(row) });
});

router.patch('/tabs/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tabs WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Tab not found.' });
  const { name, color, icon, position } = req.body || {};
  const now = Date.now();
  db.prepare(`
    UPDATE tabs
    SET name = COALESCE(?, name),
        color = COALESCE(?, color),
        icon = COALESCE(?, icon),
        position = COALESCE(?, position),
        updated_at = ?
    WHERE id = ?
  `).run(name?.trim() ?? null, color ?? null, icon ?? null, position ?? null, now, id);
  const row = db.prepare('SELECT * FROM tabs WHERE id = ?').get(id);
  res.json({ tab: tabRow(row) });
});

router.delete('/tabs/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM tabs WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Tab not found.' });
  res.status(204).end();
});

router.post('/tabs/reorder', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: '`ids` array required.' });
  const now = Date.now();
  const update = db.prepare('UPDATE tabs SET position = ?, updated_at = ? WHERE id = ?');
  const tx = db.transaction(() => {
    ids.forEach((id, i) => update.run(i, now, Number(id)));
  });
  tx();
  res.status(204).end();
});

export default router;
