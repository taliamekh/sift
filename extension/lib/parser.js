// Browser-native recipe parser for the extension's popup.
// Lives at window.Sift.parser when loaded as a content script function.

(function () {
  'use strict';

  // ─── JSON-LD walking ─────────────────────────────────────────────────────

  function typeIncludes(node, target) {
    const t = node?.['@type'];
    if (!t) return false;
    if (Array.isArray(t)) return t.some(x => String(x).toLowerCase() === target.toLowerCase());
    return String(t).toLowerCase() === target.toLowerCase();
  }

  function* walk(node) {
    if (!node || typeof node !== 'object') return;
    yield node;
    if (Array.isArray(node)) { for (const item of node) yield* walk(item); return; }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === 'object') yield* walk(child);
    }
  }

  function decodeEntities(s) {
    if (!s || typeof s !== 'string') return s;
    return s
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  }
  function stripHtml(s) {
    if (!s || typeof s !== 'string') return s;
    return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  }

  function pickImage(image) {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) {
      for (const i of image) { const got = pickImage(i); if (got) return got; }
      return null;
    }
    if (typeof image === 'object') return image.url || image['@id'] || null;
    return null;
  }
  function pickAuthor(author) {
    if (!author) return null;
    if (typeof author === 'string') return author;
    if (Array.isArray(author)) return author.map(pickAuthor).filter(Boolean).join(', ');
    if (typeof author === 'object') return author.name || null;
    return null;
  }
  function pickYield(y) {
    if (!y) return null;
    if (typeof y === 'string') return y;
    if (typeof y === 'number') return String(y);
    if (Array.isArray(y)) {
      const s = y.find(v => typeof v === 'string' && /\D/.test(v));
      if (s) return s;
      return y[0] != null ? String(y[0]) : null;
    }
    return null;
  }
  function pickRating(r) {
    if (!r || typeof r !== 'object') return null;
    const value = Number(r.ratingValue ?? r.value);
    if (!Number.isFinite(value)) return null;
    const count = Number(r.ratingCount ?? r.reviewCount ?? r.count);
    return { value, count: Number.isFinite(count) ? count : null };
  }
  function splitInstructionText(s) {
    const c = s.replace(/\r/g, '').trim();
    if (!c) return [];
    const byNewline = c.split(/\n+/).map(t => t.trim()).filter(Boolean);
    if (byNewline.length > 1) return byNewline;
    return [c];
  }
  function flattenInstructions(instr) {
    if (!instr) return [];
    if (typeof instr === 'string') return splitInstructionText(instr).map(text => ({ text }));
    if (!Array.isArray(instr)) return [];
    const out = [];
    for (const item of instr) {
      if (typeof item === 'string') {
        for (const t of splitInstructionText(item)) out.push({ text: t });
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const t = String(item['@type'] || '').toLowerCase();
      if (t.includes('section')) {
        if (item.name) out.push({ section: item.name, isHeading: true });
        for (const c of flattenInstructions(item.itemListElement || item.itemListElements)) out.push(c);
      } else if (t.includes('step') || item.text || item.name) {
        const text = item.text || item.name || '';
        if (text) out.push({ text: String(text).trim() });
      }
    }
    return out;
  }

  function score(node) {
    let s = 0;
    if (node.name) s += 2;
    if (node.recipeIngredient?.length) s += 5;
    if (node.recipeInstructions?.length || typeof node.recipeInstructions === 'string') s += 5;
    if (node.image) s += 1;
    if (node.aggregateRating) s += 1;
    if (node.totalTime || node.cookTime) s += 1;
    return s;
  }

  function shape(node) {
    return {
      name: stripHtml(node.name) || null,
      description: stripHtml(node.description) || null,
      image: pickImage(node.image),
      author: pickAuthor(node.author),
      yield: pickYield(node.recipeYield || node.yield),
      prepTime: node.prepTime || null,
      cookTime: node.cookTime || null,
      totalTime: node.totalTime || null,
      ingredients: (Array.isArray(node.recipeIngredient) ? node.recipeIngredient
                    : Array.isArray(node.ingredients) ? node.ingredients : [])
        .map(i => (typeof i === 'string' ? i : i?.text || ''))
        .map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean),
      instructions: flattenInstructions(node.recipeInstructions).map(step => ({
        ...step, text: step.text ? stripHtml(step.text) : step.text,
      })),
      rating: pickRating(node.aggregateRating),
    };
  }

  // ─── Microdata fallback ──────────────────────────────────────────────────

  function microdata() {
    const root = document.querySelector('[itemtype*="schema.org/Recipe" i]');
    if (!root) return null;
    const ingredients = [];
    root.querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"]').forEach(el => {
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      if (t) ingredients.push(t);
    });
    const instructions = [];
    root.querySelectorAll('[itemprop="recipeInstructions"]').forEach(el => {
      const sub = el.querySelectorAll('[itemprop="text"]');
      if (sub.length) sub.forEach(s => {
        const t = s.textContent.replace(/\s+/g, ' ').trim();
        if (t) instructions.push({ text: t });
      });
      else {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        if (t) instructions.push({ text: t });
      }
    });
    const ratingValue = Number(root.querySelector('[itemprop="ratingValue"]')?.getAttribute('content')
      || root.querySelector('[itemprop="ratingValue"]')?.textContent);
    const ratingCount = Number(root.querySelector('[itemprop="ratingCount"]')?.getAttribute('content')
      || root.querySelector('[itemprop="ratingCount"]')?.textContent
      || root.querySelector('[itemprop="reviewCount"]')?.getAttribute('content')
      || root.querySelector('[itemprop="reviewCount"]')?.textContent);

    return {
      name: root.querySelector('[itemprop="name"]')?.textContent?.trim()
        || document.querySelector('h1')?.textContent?.trim() || null,
      description: root.querySelector('[itemprop="description"]')?.textContent?.trim() || null,
      image: root.querySelector('[itemprop="image"]')?.getAttribute('src')
        || root.querySelector('[itemprop="image"]')?.getAttribute('content') || null,
      author: root.querySelector('[itemprop="author"]')?.textContent?.trim() || null,
      yield: root.querySelector('[itemprop="recipeYield"]')?.textContent?.trim() || null,
      prepTime: root.querySelector('[itemprop="prepTime"]')?.getAttribute('content') || null,
      cookTime: root.querySelector('[itemprop="cookTime"]')?.getAttribute('content') || null,
      totalTime: root.querySelector('[itemprop="totalTime"]')?.getAttribute('content') || null,
      ingredients, instructions,
      rating: Number.isFinite(ratingValue) && ratingValue > 0
        ? { value: ratingValue, count: Number.isFinite(ratingCount) ? ratingCount : null }
        : null,
    };
  }

  // ─── Heuristic fallback ──────────────────────────────────────────────────

  const ING_SELECTORS = ['.wprm-recipe-ingredient', '.tasty-recipes-ingredients li', '.mv-create-ingredients li', '.recipe-ingredient', '.ingredient'];
  const INSTR_SELECTORS = ['.wprm-recipe-instruction-text', '.tasty-recipes-instructions li', '.mv-create-instructions li', '.recipe-instruction', '.recipe-directions__list--item'];

  function heuristic() {
    const ingredients = [];
    for (const sel of ING_SELECTORS) {
      document.querySelectorAll(sel).forEach(el => {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        if (t) ingredients.push(t);
      });
      if (ingredients.length) break;
    }
    const instructions = [];
    for (const sel of INSTR_SELECTORS) {
      document.querySelectorAll(sel).forEach(el => {
        const t = el.textContent.replace(/\s+/g, ' ').trim();
        if (t) instructions.push({ text: t });
      });
      if (instructions.length) break;
    }
    if (!ingredients.length && !instructions.length) return null;
    return {
      name: document.querySelector('h1')?.textContent?.trim() || null,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
      image: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
      ingredients, instructions,
    };
  }

  // ─── ISO 8601 duration ───────────────────────────────────────────────────

  function parseDuration(iso) {
    if (!iso || typeof iso !== 'string') return null;
    const m = iso.trim().match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
    if (!m) return null;
    const h = parseInt(m[1] || 0, 10), min = parseInt(m[2] || 0, 10), s = parseInt(m[3] || 0, 10);
    const total = h * 60 + min + Math.round(s / 60);
    return total > 0 ? total : null;
  }

  function parseServings(text) {
    if (!text) return null;
    if (typeof text === 'number') return text;
    const m = String(text).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  // ─── Public entry ────────────────────────────────────────────────────────

  function extractRecipe() {
    let recipe = null, source = null;

    // 1. JSON-LD
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const candidates = [];
    scripts.forEach(s => {
      try { candidates.push(JSON.parse(s.textContent)); }
      catch { /* skip */ }
    });
    const recipes = [];
    for (const c of candidates) for (const n of walk(c)) if (typeIncludes(n, 'Recipe')) recipes.push(n);
    if (recipes.length) {
      recipes.sort((a, b) => score(b) - score(a));
      recipe = shape(recipes[0]);
      source = 'json-ld';
    }

    // 2. Microdata
    if (!recipe?.ingredients?.length) {
      const m = microdata();
      if (m?.ingredients?.length || m?.instructions?.length) { recipe = m; source = 'microdata'; }
    }

    // 3. Heuristic
    if (!recipe?.ingredients?.length && !recipe?.instructions?.length) {
      const h = heuristic();
      if (h) { recipe = h; source = 'heuristic'; }
    }

    if (!recipe) {
      return {
        title: document.querySelector('h1')?.textContent?.trim() || document.title || null,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
        heroImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
        ingredients: [], instructions: [],
        parseSource: 'none',
        sourceUrl: location.href,
      };
    }

    const prepM = parseDuration(recipe.prepTime);
    const cookM = parseDuration(recipe.cookTime);
    const totalM = parseDuration(recipe.totalTime) || ((prepM || 0) + (cookM || 0) || null);

    return {
      title: recipe.name,
      description: recipe.description,
      heroImage: recipe.image,
      author: recipe.author,
      yieldText: recipe.yield,
      servings: parseServings(recipe.yield),
      prepMinutes: prepM,
      cookMinutes: cookM,
      totalMinutes: totalM,
      ingredients: (recipe.ingredients || []).map(text => {
        const p = window.Sift.parseIngredient(text);
        return p || { text, quantity: null, unit: null, name: text };
      }),
      instructions: (recipe.instructions || []).map((step, i) => ({
        index: i, section: step.section || null, isHeading: !!step.isHeading, text: step.text || '',
      })),
      rating: recipe.rating || null,
      parseSource: source,
      sourceUrl: location.href,
    };
  }

  window.Sift = window.Sift || {};
  window.Sift.extractRecipe = extractRecipe;
})();
