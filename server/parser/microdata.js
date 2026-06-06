// Fallback when JSON-LD is missing: walk schema.org microdata attributes.
// Most modern sites have JSON-LD so this is rarely hit, but worth having for
// long-tail or older blogs.

function attrText($el, selectors) {
  for (const sel of selectors) {
    const found = $el.find(sel).first();
    if (found.length) {
      const t = (found.attr('content') || found.text() || '').trim();
      if (t) return t;
    }
  }
  return null;
}

function allText($el, selector) {
  const out = [];
  $el.find(selector).each((_, n) => {
    const t = (n.attribs?.content || '').trim() || (typeof n.children === 'object' ? null : null);
    out.push(t);
  });
  return out;
}

export function extractRecipeFromMicrodata($) {
  const root = $('[itemtype*="schema.org/Recipe" i]').first();
  if (!root.length) return null;

  const ingredients = [];
  root.find('[itemprop="recipeIngredient"], [itemprop="ingredients"]').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t) ingredients.push(t);
  });

  const instructions = [];
  root.find('[itemprop="recipeInstructions"]').each((_, el) => {
    const $el = $(el);
    // If the node contains sub-steps marked with itemprop=text, prefer those
    const steps = $el.find('[itemprop="text"], [itemprop="HowToStep"]');
    if (steps.length) {
      steps.each((_, s) => {
        const t = $(s).text().replace(/\s+/g, ' ').trim();
        if (t) instructions.push({ text: t });
      });
    } else {
      const t = $el.text().replace(/\s+/g, ' ').trim();
      if (t) instructions.push({ text: t });
    }
  });

  const ratingValue = Number(root.find('[itemprop="ratingValue"]').first().attr('content')
    || root.find('[itemprop="ratingValue"]').first().text());
  const ratingCount = Number(root.find('[itemprop="ratingCount"], [itemprop="reviewCount"]').first().attr('content')
    || root.find('[itemprop="ratingCount"], [itemprop="reviewCount"]').first().text());

  const name = attrText(root, ['[itemprop="name"]', 'h1']);
  if (!name && !ingredients.length) return null;

  return {
    name,
    description: attrText(root, ['[itemprop="description"]']),
    image: attrText(root, ['[itemprop="image"]']),
    author: attrText(root, ['[itemprop="author"]']),
    yield: attrText(root, ['[itemprop="recipeYield"]']),
    prepTime: attrText(root, ['[itemprop="prepTime"]']),
    cookTime: attrText(root, ['[itemprop="cookTime"]']),
    totalTime: attrText(root, ['[itemprop="totalTime"]']),
    ingredients,
    instructions,
    rating: Number.isFinite(ratingValue) && ratingValue > 0
      ? { value: ratingValue, count: Number.isFinite(ratingCount) ? ratingCount : null }
      : null,
  };
}
