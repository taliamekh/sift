// SQLite layer. better-sqlite3 is synchronous which keeps the request
// handlers linear and easy to reason about — there's no concurrency story
// to manage at this scale.
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', 'data', 'sugarskip.db');
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS cookbooks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    cover_color   TEXT NOT NULL DEFAULT '#F8B4D9',
    cover_icon    TEXT NOT NULL DEFAULT 'cupcake',
    description   TEXT,
    position      INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tabs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cookbook_id   INTEGER NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    color         TEXT NOT NULL DEFAULT '#FFD6E8',
    icon          TEXT,
    position      INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS tabs_cookbook_idx ON tabs(cookbook_id, position);

  CREATE TABLE IF NOT EXISTS recipes (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    cookbook_id           INTEGER REFERENCES cookbooks(id) ON DELETE CASCADE,
    tab_id                INTEGER REFERENCES tabs(id) ON DELETE SET NULL,
    source_url            TEXT,
    title                 TEXT NOT NULL,
    description           TEXT,
    hero_image            TEXT,
    author                TEXT,
    prep_minutes          INTEGER,
    cook_minutes          INTEGER,
    total_minutes         INTEGER,
    servings              INTEGER,
    yield_text            TEXT,
    ingredients_json      TEXT NOT NULL,
    instructions_json     TEXT NOT NULL,
    external_rating       REAL,
    external_rating_count INTEGER,
    user_rating           INTEGER,
    user_notes            TEXT,
    created_at            INTEGER NOT NULL,
    updated_at            INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS recipes_cookbook_idx ON recipes(cookbook_id, tab_id);

  CREATE TABLE IF NOT EXISTS recipe_photos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    filename      TEXT NOT NULL,
    caption       TEXT,
    position      INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS photos_recipe_idx ON recipe_photos(recipe_id, position);
`);

// Seed a default cookbook on first run so the UI is never empty.
const cookbookCount = db.prepare('SELECT COUNT(*) AS c FROM cookbooks').get().c;
if (cookbookCount === 0) {
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO cookbooks (name, cover_color, cover_icon, description, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('My First Cookbook', '#F8B4D9', 'cupcake', 'Recipes you want to come back to.', 0, now, now);

  const cookbookId = result.lastInsertRowid;
  const tabs = [
    { name: 'Sweet',  color: '#FFC2D6', icon: 'cake'   },
    { name: 'Bread',  color: '#FFE0B5', icon: 'bread'  },
    { name: 'Cookies', color: '#FFD8B4', icon: 'cookie' },
  ];
  const insertTab = db.prepare(`
    INSERT INTO tabs (cookbook_id, name, color, icon, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  tabs.forEach((t, i) => insertTab.run(cookbookId, t.name, t.color, t.icon, i, now, now));
}

export default db;
