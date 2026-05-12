# Sift

> Skip the story, get to the recipe.

A pastel-pink recipe reader. Two surfaces share one parser:

* **Web app** at `http://localhost:4747` — paste a recipe URL, get a clean
  reading view, save it to a cookbook with custom tabs, your own notes,
  photos, and personal rating. Works for baking, cooking, prep — any
  recipe site that uses schema.org.
* **Chrome extension** — click the toolbar icon on any recipe page; the
  popup shows the same clean recipe view in your browser, so it gets
  through sites that block server-side scrapers (e.g. AllRecipes).

Designed around the [schema.org/Recipe](https://schema.org/Recipe) JSON-LD
specification, which ~95% of major recipe sites embed. Falls back to
schema.org microdata and then to common WordPress recipe plugin selectors
(WP Recipe Maker, Tasty Recipes, MV Create) when JSON-LD is missing.

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
5. Pin Sift to your toolbar
6. Click it on any recipe page

The extension talks to the local web app for the "Save to cookbook" feature,
but viewing recipes works whether or not the server is running.

---

## Features

### Reading a recipe

* **Paste any recipe URL** — parsed server-side. If the site blocks bots,
  we transparently fall back through `r.jina.ai` so you still get the
  recipe.
* **Interactive ingredient checklist** — tap an ingredient to cross it off.
* **Smart batch scaler** — adjust the recipe by clean ratios (¼×, ⅓×, ½×,
  ⅔×, ¾×, 1×, 1½×, 2×, 3×, 4×) instead of awkward single-serving steps.
  Quantities snap back to pretty fractions (`1.5 → 1½`, `0.667 → ⅔`) so
  you never end up with "1.83 eggs."
* **Numbered instructions** — tap a step to mark it done.
* **External star rating** — 5-star visual fill from the recipe site's
  aggregate rating, with review count.

### Your cookbook

* **Cookbooks** — make as many as you want; each gets its own cover color
  (or a full-bleed image cover from the preset gallery or your own
  upload), an icon drawn from a deep library of cooking iconography
  (whisk, pot, mixer, rolling pin, knife, oven, kettle, mug, scale,
  herbs, cupcake, cake, bread, cookie, donut, pie, croissant, salt
  shaker…), and a text/icon colour so dark-on-pastel and light-on-photo
  looks both work. The icon overlays the photo when you've picked an
  image cover.
* **Book-style view** — cookbooks render as actual book pages with a
  visible spine and tabs sticking out the right edge like a recipe
  binder.
* **Custom tabs** — within a cookbook, organize recipes into tabs. Each
  tab has its own color and optional icon. The pencil icon on each tab
  opens the editor; from there you can rename, recolor, or delete.
* **Notes** — per-recipe notes editor that auto-saves as you type.
* **Photos** — upload your own bakes to a recipe; stored locally in
  `uploads/`.
* **Your rating** — 1-5 stars per recipe, independent of the site's
  rating.
* **Print** — clean print stylesheet hides the chrome.
* **Breadcrumbs everywhere** — you're never trapped on a sub-page.

### Chrome extension

Same parser, same look, runs in-page. Click "Save to cookbook" to push the
recipe to your local app. "Open in app" launches the recipe in the full
web app.

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
│   └── routes/               ← parse, cookbooks, recipes, photos
├── public/                   ← Web app frontend (vanilla JS, no build step)
│   ├── index.html
│   ├── styles.css            ← Pastel-pink design system
│   ├── app.js                ← Router + view dispatcher
│   ├── lib/                  ← icons, h(), api client, toast, router, modal
│   ├── components/           ← starRating, recipeView, editors, breadcrumb
│   └── views/                ← home, recipe, cookbook, savedRecipe
├── extension/                ← Chrome Manifest V3 extension
│   ├── manifest.json
│   ├── popup.html / popup.css / popup.js
│   ├── lib/                  ← parser, quantity, icons (vendored for popup)
│   └── icons/                ← 16/32/48/64/128 PNGs
├── scripts/
│   ├── gen-icons.js          ← sharp-based PNG generation
│   └── test-parser.js        ← parser harness against the three test URLs
├── data/                     ← SQLite DB (gitignored)
└── uploads/                  ← User photos (gitignored)
```

### Stack notes

* **No build step** for the frontend. ES modules served raw. Edits feel
  instant.
* **better-sqlite3** for storage. Synchronous, fast, no concurrency story
  needed at this scale.
* **Cheerio** on the server for JSON-LD extraction.
* **Sharp** at build time to make Chrome extension PNGs from one inline
  SVG.
* **Fonts** — [Fraunces](https://fonts.google.com/specimen/Fraunces) for
  display (warm, variable-axis serif with optical sizes) and
  [Quicksand](https://fonts.google.com/specimen/Quicksand) for UI
  (rounded geometric sans). Loaded from Google Fonts; works offline once
  cached.

---

## Notes for the curious

* **Reader-proxy fallback** uses `r.jina.ai` — a free reader service that
  returns page HTML, including JSON-LD. Only activates on direct fetch
  failure (403/401/429), so it adds no latency for sites that work
  directly.
* **Quantity parser** handles `1 1/2 cups`, `½`, `1½`, `2 to 3 tablespoons`,
  `(8 oz) package`, ranges, and word numbers (`one`, `a pinch`). Fractions
  are parsed before decimals so `3/4 cup` doesn't degrade to "decimal 3
  with /4 stranded."
* **Servings scaler uses ratios** rather than ±1 steps. Going from 12 to
  11 servings creates ugly fractional eggs; going from 12 to ¾× (= 9
  servings) keeps every ingredient on a clean fraction.
* **Database resets**: delete `data/sugarskip.db` to start fresh — the
  filename is the project's old name, kept stable so existing local data
  survives the rebrand. The server re-seeds a default cookbook on next
  boot.
* **Port choice**: 4747 avoids collisions with the usual 3000/5173/8000/
  8080.
* **Extension permissions**: `activeTab` and `scripting` only — no
  background scripts, no telemetry.
