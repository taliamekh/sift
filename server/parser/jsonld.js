// Extract Recipe data from JSON-LD scripts in a parsed HTML document.
//
// Recipe sites embed structured data per https://schema.org/Recipe.
// JSON-LD shapes vary: a single object, an array of objects, or a graph
// wrapper (`@graph: [...]`). We walk the entire tree, collect every node
// that declares `@type` containing "Recipe", and pick the first complete one.

function typeIncludes(node, target) {
  const t = node?.['@type'];
  if (!t) return false;
  if (Array.isArray(t)) return t.some(x => String(x).toLowerCase() === target.toLowerCase());
  return String(t).toLowerCase() === target.toLowerCase();
}

function* walk(node) {
  if (!node || typeof node !== 'object') return;
  yield node;
  if (Array.isArray(node)) {
    for (const item of node) yield* walk(item);
    return;
  }
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (child && typeof child === 'object') yield* walk(child);
  }
}

function pickImage(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    for (const i of image) {
      const got = pickImage(i);
      if (got) return got;
    }
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
    // Prefer the string form (e.g. "12 cookies") over a bare number
    const stringForm = y.find(v => typeof v === 'string' && /\D/.test(v));
    if (stringForm) return stringForm;
    return y[0] != null ? String(y[0]) : null;
  }
  return null;
}

function flattenInstructions(instr) {
  // Recipe instructions can be:
  //   - a single HTML/plaintext string
  //   - an array of strings
  //   - an array of HowToStep objects { text }
  //   - an array of HowToSection objects { name, itemListElement: [HowToStep] }
  if (!instr) return [];
  if (typeof instr === 'string') {
    return splitInstructionText(instr).map(text => ({ text }));
  }
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
      const sectionName = item.name || null;
      const children = flattenInstructions(item.itemListElement || item.itemListElements);
      if (sectionName) out.push({ section: sectionName, isHeading: true });
      for (const c of children) out.push(c);
    } else if (t.includes('step') || item.text || item.name) {
      const text = item.text || item.name || '';
      if (text) out.push({ text: String(text).trim() });
    }
  }
  return out;
}

function splitInstructionText(s) {
  // Some sites cram all steps into a single string separated by newlines or
  // numbered markers. Split conservatively.
  const cleaned = s.replace(/\r/g, '').trim();
  if (!cleaned) return [];
  const byNewline = cleaned.split(/\n+/).map(t => t.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  // Try numbered patterns like "1. Foo 2. Bar"
  const numbered = cleaned.split(/(?<=[.!?])\s+(?=\d+\.\s)/);
  if (numbered.length > 1) return numbered.map(t => t.trim()).filter(Boolean);
  return [cleaned];
}

function pickRating(r) {
  if (!r) return null;
  if (typeof r === 'string' || typeof r === 'number') {
    const n = Number(r);
    return Number.isFinite(n) ? { value: n, count: null } : null;
  }
  if (typeof r !== 'object') return null;
  const value = Number(r.ratingValue ?? r.value);
  if (!Number.isFinite(value)) return null;
  const count = Number(r.ratingCount ?? r.reviewCount ?? r.count);
  return { value, count: Number.isFinite(count) ? count : null };
}

function pickIngredients(node) {
  // Schema canonical is `recipeIngredient`. Older sites used `ingredients`.
  const raw = node.recipeIngredient || node.ingredients || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map(i => (typeof i === 'string' ? i : i?.text || ''))
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripHtml(str) {
  if (!str || typeof str !== 'string') return str;
  return decodeHtmlEntities(str.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// Walk a Recipe node into our flat shape. Caller has already verified
// `@type` includes "Recipe".
function shapeRecipe(node) {
  return {
    name: stripHtml(node.name) || null,
    description: stripHtml(node.description) || null,
    image: pickImage(node.image),
    author: pickAuthor(node.author),
    yield: pickYield(node.recipeYield || node.yield),
    prepTime: node.prepTime || null,
    cookTime: node.cookTime || null,
    totalTime: node.totalTime || null,
    ingredients: pickIngredients(node),
    instructions: flattenInstructions(node.recipeInstructions).map(step => ({
      ...step,
      text: step.text ? stripHtml(step.text) : step.text,
    })),
    rating: pickRating(node.aggregateRating),
    category: node.recipeCategory || null,
    cuisine: node.recipeCuisine || null,
    keywords: node.keywords || null,
  };
}

export function extractRecipeFromJsonLd($) {
  const candidates = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    // Some sites have multiple JSON objects concatenated or invalid trailing
    // commas. Try parsing as-is first, then fall back to extracting the first
    // valid JSON object via brace matching.
    try {
      const parsed = JSON.parse(raw);
      candidates.push(parsed);
    } catch {
      const objects = extractJsonObjects(raw);
      for (const obj of objects) candidates.push(obj);
    }
  });

  const recipes = [];
  for (const cand of candidates) {
    for (const node of walk(cand)) {
      if (typeIncludes(node, 'Recipe')) recipes.push(node);
    }
  }
  if (!recipes.length) return null;

  // Score recipes by completeness so we pick the richest one if there are
  // multiple variants (some sites embed both a stub and a full Recipe).
  recipes.sort((a, b) => completenessScore(b) - completenessScore(a));
  return shapeRecipe(recipes[0]);
}

function completenessScore(node) {
  let score = 0;
  if (node.name) score += 2;
  if (node.recipeIngredient?.length) score += 5;
  if (node.recipeInstructions?.length || typeof node.recipeInstructions === 'string') score += 5;
  if (node.image) score += 1;
  if (node.aggregateRating) score += 1;
  if (node.totalTime || node.cookTime) score += 1;
  return score;
}

function extractJsonObjects(raw) {
  // Returns each top-level {...} or [...] JSON value the string contains.
  const out = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (escape) { escape = false; continue; }
    if (c === '\\' && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{' || c === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0 && start !== -1) {
        const slice = raw.slice(start, i + 1);
        try { out.push(JSON.parse(slice)); } catch { /* skip */ }
        start = -1;
      }
    }
  }
  return out;
}
