import { Router } from 'express';
import { fetchAndParse } from '../parser/index.js';

const router = Router();

router.post('/parse', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A `url` field is required.' });
  }
  try {
    const recipe = await fetchAndParse(url.trim());
    if (!recipe.title) {
      return res.status(422).json({
        error: "We couldn't find a recipe on that page. Make sure the URL points directly to a recipe (not a category or homepage).",
      });
    }
    res.json({ recipe });
  } catch (err) {
    console.error('[parse]', err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;
