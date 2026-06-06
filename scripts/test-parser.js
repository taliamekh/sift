import { fetchAndParse } from '../server/parser/index.js';

const urls = [
  'https://www.cookingclassy.com/cookies-n-cream-cheesecake/',
  'https://joyfoodsunshine.com/the-most-amazing-chocolate-chip-cookies/',
  'https://www.allrecipes.com/recipe/223234/macaron-french-macaroon/',
];

for (const url of urls) {
  console.log('\n' + '='.repeat(80));
  console.log('URL:', url);
  console.log('='.repeat(80));
  try {
    const recipe = await fetchAndParse(url);
    console.log('Source:', recipe.parseSource);
    console.log('Title:', recipe.title);
    console.log('Servings:', recipe.servings, '/ yieldText:', recipe.yieldText);
    console.log('Times — prep:', recipe.prepMinutes, 'cook:', recipe.cookMinutes, 'total:', recipe.totalMinutes);
    console.log('Rating:', recipe.rating);
    console.log('Hero image:', recipe.heroImage?.slice(0, 100));
    console.log('Ingredients (' + recipe.ingredients.length + '):');
    for (const i of recipe.ingredients.slice(0, 6)) {
      console.log('  -', JSON.stringify({ q: i.quantity, u: i.unit, n: i.name?.slice(0, 50), text: i.text?.slice(0, 70) }));
    }
    if (recipe.ingredients.length > 6) console.log(`  ... and ${recipe.ingredients.length - 6} more`);
    console.log('Instructions (' + recipe.instructions.length + '):');
    for (const s of recipe.instructions.slice(0, 3)) {
      console.log('  ' + (s.index + 1) + '.', s.text?.slice(0, 100));
    }
    if (recipe.instructions.length > 3) console.log(`  ... and ${recipe.instructions.length - 3} more`);
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}
