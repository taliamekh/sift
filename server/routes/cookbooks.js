import { Router } from 'express';
import db from '../db.js';

const router = Router();

function cookbookRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    coverColor: row.cover_color,
    coverIcon: row.cover_icon,
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
  res.json({
    cookbooks: rows.map(r => ({ ...cookbookRow(r), recipeCount: r.recipe_count })),
  });
});

router.post('/cookbooks', (req, res) => {
  const { name, coverColor, coverIcon, description } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Cookbook name is required.' });
  }
  const now = Date.now();
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM cookbooks').get().m;
  const info = db.prepare(`
    INSERT INTO cookbooks (name, cover_color, cover_icon, description, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    coverColor || '#F8B4D9',
    coverIcon || 'cupcake',
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
  const { name, coverColor, coverIcon, description, position } = req.body || {};
  const now = Date.now();
  db.prepare(`
    UPDATE cookbooks
    SET name = COALESCE(?, name),
        cover_color = COALESCE(?, cover_color),
        cover_icon = COALESCE(?, cover_icon),
        description = COALESCE(?, description),
        position = COALESCE(?, position),
        updated_at = ?
    WHERE id = ?
  `).run(
    name?.trim() ?? null,
    coverColor ?? null,
    coverIcon ?? null,
    description ?? null,
    position ?? null,
    now,
    id,
  );
  const row = db.prepare('SELECT * FROM cookbooks WHERE id = ?').get(id);
  res.json({ cookbook: cookbookRow(row) });
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
