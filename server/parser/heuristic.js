// Last-ditch HTML scraper for sites without structured data. Targets the
// class-name patterns used by common WordPress recipe plugins (WP Recipe
// Maker, Tasty Recipes, Recipe Card Blocks, etc).

const INGREDIENT_SELECTORS = [
  '.wprm-recipe-ingredient',
  '.tasty-recipes-ingredients li',
  '.mv-create-ingredients li',
  '.recipe-ingredient',
  '.ingredient',
  'li.ingredient',
];

const INSTRUCTION_SELECTORS = [
  '.wprm-recipe-instruction-text',
  '.tasty-recipes-instructions li',
  '.mv-create-instructions li',
  '.recipe-instruction',
  '.recipe-directions__list--item',
  '.instructions li',
];

const RATING_SELECTORS = [
  '.wprm-recipe-rating-average',
  '.tasty-recipes-rating',
  '[itemprop="ratingValue"]',
];

export function extractRecipeFromHeuristics($) {
  const ingredients = [];
  for (const sel of INGREDIENT_SELECTORS) {
    $(sel).each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t) ingredients.push(t);
    });
    if (ingredients.length) break;
  }

  const instructions = [];
  for (const sel of INSTRUCTION_SELECTORS) {
    $(sel).each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t) instructions.push({ text: t });
    });
    if (instructions.length) break;
  }

  if (!ingredients.length && !instructions.length) return null;

  let rating = null;
  for (const sel of RATING_SELECTORS) {
    const t = $(sel).first().text().trim();
    const n = Number(t);
    if (Number.isFinite(n) && n > 0) { rating = { value: n, count: null }; break; }
  }

  return {
    name: $('h1').first().text().trim() || null,
    description: $('meta[name="description"]').attr('content') || null,
    image: $('meta[property="og:image"]').attr('content') || null,
    author: null,
    yield: null,
    prepTime: null,
    cookTime: null,
    totalTime: null,
    ingredients,
    instructions,
    rating,
  };
}
