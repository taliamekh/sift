# Sugar Skip

> Skip the story, get to the recipe.

A pastel-pink baking companion built in one night. Two surfaces share the same
recipe parser:

* **Web app** at `http://localhost:4747` — paste a recipe URL, get a clean
  reading view, save it to a cookbook with tabs, notes, photos, and your own
  star rating.
* **Chrome extension** — click the toolbar icon on any recipe page; the popup
  pulls the same clean recipe view, runs entirely in your browser (so it
  bypasses bot protection that blocks server-side fetches).

Designed around the
[schema.org/Recipe](https://schema.org/Recipe) JSON-LD specification, which
~95% of major recipe sites embed. Falls back to schema.org microdata and
then to common WordPress recipe plugin selectors (WP Recipe Maker, Tasty
Recipes, MV Create) when JSON-LD is missing.

## Tested against

| Site | Result |
|---|---|
| [Cooking Classy — Cookies 'n Cream Cheesecake](https://www.cookingclassy.com/cookies-n-cream-cheesecake/) | ✓ JSON-LD, full data |
| [Joy Food Sunshine — Best Chocolate Chip Cookies](https://joyfoodsunshine.com/the-most-amazing-chocolate-chip-cookies/) | ✓ JSON-LD, full data |
| [AllRecipes — Macaron (French Macaroon)](https://www.allrecipes.com/recipe/223234/macaron-french-macaroon/) | ✓ Web app via reader-proxy fallback (their server blocks direct fetches); extension works directly |

---

## Run it

Requires Node 20+.

```bash
npm install
npm run gen-icons    # generates the extension PNG icons (one-time)
npm start            # serves the web app on http://localhost:4747
```

Open <http://localhost:4747> in your browser.

### Install the Chrome extension

1. Visit `chrome://extensions/`
2. Toggle on **Developer mode** (top right)
3. Click **Load unpacked**
4. Pick the `extension/` folder inside this project
5. Pin Sugar Skip to your toolbar
6. Click it on any baking recipe page

The extension talks to the local web app for the "Save to cookbook" feature,
but viewing recipes works whether or not the server is running.

---

## Features

### Web app

* **Paste any recipe URL** — gets parsed server-side. If the site blocks bots,
  we transparently fall back through `r.jina.ai` so you still get the recipe.
* **Interactive ingredient checklist** — tap an ingredient to cross it off.
* **Servings scaler** — adjust serving count and every quantity rescales in
  real time, snapped back to pretty fractions (`1.5 → 1½`, `0.6667 → ⅔`).
* **Numbered instructions** — tap a step to mark it done.
* **External star rating** — 5-star visual fill from the recipe site's
  aggregate rating, with review count.
* **Cookbooks** — make as many as you want; each gets its own color and icon
  (cupcake, cookie, cake, bread, donut, croissant, pie, bowl, heart, flower).
* **Tabs** — within a cookbook, organise recipes into custom tabs. Each tab
  has its own color and optional icon. Double-click a tab to rename or
  recolor it.
* **Notes** — per-recipe notes editor, auto-saves as you type.
* **Photos** — upload your own bakes to a recipe; stored locally in
  `uploads/`.
* **Your rating** — 1-5 stars per recipe, independent of the site's rating.
* **Print** — clean print stylesheet hides the chrome.

### Chrome extension

Same parser, same look, runs in-page. Click "Save to cookbook" to push the
recipe to your local app (whichever cookbook is first in your list).
"Open in app" launches the recipe in the full web app.

---

## Architecture

```
baking/
├── server/
│   ├── index.js              ← Express entry, port 4747
│   ├── db.js                 ← SQLite schema + seeding
│   ├── parser/
│   │   ├── index.js          ← fetch + parse orchestration
│   │   ├── jsonld.js         ← schema.org/Recipe JSON-LD walker
│   │   ├── microdata.js      ← schema.org microdata fallback
│   │   ├── heuristic.js      ← class-selector fallback
│   │   ├── duration.js       ← ISO 8601 → minutes
│   │   └── quantity.js       ← ingredient quantity parser
│   └── routes/
│       ├── parse.js          ← POST /api/parse
│       ├── cookbooks.js      ← cookbook + tab CRUD
│       └── recipes.js        ← recipe + photo CRUD
├── public/                   ← Web app frontend (vanilla JS, no build step)
│   ├── index.html
│   ├── styles.css            ← Pastel-pink design system
│   ├── app.js                ← Router + view dispatcher
│   ├── lib/                  ← icons, h(), api client, toast, router, modal
│   ├── components/           ← starRating, recipeView, editors
│   └── views/                ← home, recipe, cookbook, savedRecipe
├── extension/                ← Chrome Manifest V3 extension
│   ├── manifest.json
│   ├── popup.html / popup.css / popup.js
│   ├── lib/                  ← parser, quantity, icons (vendored for popup)
│   └── icons/                ← 16/32/48/64/128 PNGs
├── scripts/
│   ├── gen-icons.js          ← sharp-based PNG generation
│   └── test-parser.js        ← parser harness against the three test URLs
└── data/                     ← SQLite DB (gitignored)
└── uploads/                  ← User photos (gitignored)
```

### Stack notes

* **No build step** for the frontend. ES modules served raw. This keeps the
  setup teachable and edits feel instant.
* **better-sqlite3** for storage. Synchronous, fast, no concurrency story
  needed at this scale.
* **Cheerio** on the server for JSON-LD extraction.
* **Sharp** at build time to make Chrome extension PNGs from one inline SVG.
* **Fonts** — [Fraunces](https://fonts.google.com/specimen/Fraunces) for
  display (warm, variable-axis serif with optical sizes) and
  [Quicksand](https://fonts.google.com/specimen/Quicksand) for UI (rounded
  geometric sans). Loaded from Google Fonts; works offline once cached.

---

## Notes for the curious

* **The reader-proxy fallback** uses `r.jina.ai` — a free reader service that
  returns the page HTML, including JSON-LD. It only activates when the direct
  fetch returns 403/401/429/etc., so for sites that work directly it adds no
  latency.
* **Quantity parser** handles `1 1/2 cups`, `½`, `1½`, `2 to 3 tablespoons`,
  `(8 oz) package`, ranges, fractions, decimals, and word numbers (`one`,
  `a pinch`). Renders back to clean fractions where the snap is close
  enough (within 0.025).
* **Database resets**: delete `data/sugarskip.db` to start fresh. The server
  re-seeds a default cookbook on next boot.
* **Port choice**: 4747 avoids collisions with the usual 3000/5173/8000/8080.
* **Extension permissions**: `activeTab` and `scripting` only — no
  background scripts, no telemetry.
