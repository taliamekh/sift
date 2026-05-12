// Ingredient quantity parser/formatter for the extension popup.
// Adds to window.Sift namespace (no ES module imports — runs as a
// classic script alongside parser.js).

(function () {
  'use strict';

  const UNICODE_FRACTIONS = {
    '½': 0.5,  '⅓': 1 / 3, '⅔': 2 / 3,
    '¼': 0.25, '¾': 0.75,
    '⅕': 0.2,  '⅖': 0.4,  '⅗': 0.6,  '⅘': 0.8,
    '⅙': 1 / 6, '⅚': 5 / 6,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  };

  const COMMON_FRACTIONS = [
    { d: 0, s: '' },
    { d: 0.125, s: '⅛' }, { d: 0.25, s: '¼' }, { d: 1 / 3, s: '⅓' },
    { d: 0.375, s: '⅜' }, { d: 0.5, s: '½' }, { d: 0.625, s: '⅝' },
    { d: 2 / 3, s: '⅔' }, { d: 0.75, s: '¾' }, { d: 0.875, s: '⅞' },
  ];

  const UNITS = [
    { c: 'cup', a: ['cups', 'cup', 'c.'] },
    { c: 'tablespoon', a: ['tablespoons', 'tablespoon', 'tbsps', 'tbsp.', 'tbsp', 'tbs', 'tbl', 'T.'] },
    { c: 'teaspoon', a: ['teaspoons', 'teaspoon', 'tsps', 'tsp.', 'tsp', 'tspn', 't.'] },
    { c: 'ounce', a: ['ounces', 'ounce', 'oz.', 'oz'] },
    { c: 'fluid ounce', a: ['fluid ounces', 'fluid ounce', 'fl oz', 'fl. oz.', 'fl. oz'] },
    { c: 'pound', a: ['pounds', 'pound', 'lbs.', 'lbs', 'lb.', 'lb'] },
    { c: 'gram', a: ['grams', 'gram', 'g.', 'g'] },
    { c: 'kilogram', a: ['kilograms', 'kilogram', 'kgs', 'kg.', 'kg'] },
    { c: 'milligram', a: ['milligrams', 'milligram', 'mg.', 'mg'] },
    { c: 'milliliter', a: ['milliliters', 'milliliter', 'ml.', 'ml'] },
    { c: 'liter', a: ['liters', 'litres', 'liter', 'litre', 'l.'] },
    { c: 'quart', a: ['quarts', 'quart', 'qts', 'qt.', 'qt'] },
    { c: 'pint', a: ['pints', 'pint', 'pts', 'pt.', 'pt'] },
    { c: 'gallon', a: ['gallons', 'gallon', 'gal.', 'gal'] },
    { c: 'pinch', a: ['pinches', 'pinch'] },
    { c: 'dash', a: ['dashes', 'dash'] },
    { c: 'package', a: ['packages', 'package', 'pkgs', 'pkg.', 'pkg'] },
    { c: 'can', a: ['cans', 'can'] },
    { c: 'stick', a: ['sticks', 'stick'] },
    { c: 'clove', a: ['cloves', 'clove'] },
    { c: 'slice', a: ['slices', 'slice'] },
    { c: 'piece', a: ['pieces', 'piece'] },
  ];
  const UNIT_LOOKUP = new Map();
  for (const u of UNITS) for (const a of u.a) UNIT_LOOKUP.set(a.toLowerCase().replace(/\.$/, ''), u.c);
  const UNIT_RE = new RegExp('^(' + UNITS.flatMap(u => u.a).sort((a, b) => b.length - a.length).map(a => a.replace(/\./g, '\\.?')).join('|') + ')\\b', 'i');

  const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozen: 12, half: 0.5 };

  function parseNumericToken(token) {
    if (!token) return null;
    token = token.trim();
    if (UNICODE_FRACTIONS[token] != null) return UNICODE_FRACTIONS[token];
    if (/^\d+\/\d+$/.test(token)) {
      const [n, d] = token.split('/').map(Number);
      return d ? n / d : null;
    }
    const n = Number(token);
    return Number.isFinite(n) ? n : null;
  }

  function readLeadingQuantity(s) {
    s = s.trimStart();
    const word = s.match(/^([A-Za-z]+)\b/);
    if (word && NUMBER_WORDS[word[1].toLowerCase()] != null) {
      const after = s.slice(word[0].length).trimStart();
      if (UNIT_RE.test(after) || /^of\b/i.test(after)) {
        return { value: NUMBER_WORDS[word[1].toLowerCase()], end: word[0].length };
      }
    }
    // Fraction first so "3/4" doesn't parse as decimal-3 + stranded "/4".
    const numRe = /^(\d+\/\d+|\d+(?:[.,]\d+)?|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/;
    const first = s.match(numRe);
    if (!first) return null;
    let value = parseNumericToken(first[1].replace(',', '.'));
    if (value == null) return null;
    let consumed = first[0].length;
    const rest = s.slice(consumed);
    const tight = rest.match(/^([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
    if (tight) { value += UNICODE_FRACTIONS[tight[1]]; consumed += tight[0].length; }
    else {
      const mixed = rest.match(/^\s+(\d+\/\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?!\d)/);
      if (mixed) {
        const frac = parseNumericToken(mixed[1]);
        if (frac != null && frac < 1) { value += frac; consumed += mixed[0].length; }
      }
    }
    const tail = s.slice(consumed);
    const range = tail.match(/^\s*(?:-|–|—|to)\s*(\d+(?:[.,]\d+)?|\d+\/\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
    let rangeMax = null;
    if (range) {
      const r = parseNumericToken(range[1].replace(',', '.'));
      if (r != null) { rangeMax = r; consumed += range[0].length; }
    }
    return { value, rangeMax, end: consumed };
  }

  function parseIngredient(line) {
    if (typeof line !== 'string') return null;
    const original = line.replace(/\s+/g, ' ').trim();
    if (!original) return null;

    let working = original.replace(/^[-*•·–—]\s*/, '');
    let bracket = null;
    const bm = working.match(/^(\d+[\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞-]*)\s*(\([^)]*\))/);
    if (bm) { bracket = bm[2]; working = working.slice(0, bm[1].length) + working.slice(bm[0].length); working = working.replace(/\s+/g, ' ').trim(); }

    const qty = readLeadingQuantity(working);
    let value = qty?.value ?? null;
    let rangeMax = qty?.rangeMax ?? null;
    let rest = qty ? working.slice(qty.end).trimStart() : working;

    let unit = null;
    const um = rest.match(UNIT_RE);
    if (um) {
      unit = UNIT_LOOKUP.get(um[1].toLowerCase().replace(/\.$/, '')) || um[1];
      rest = rest.slice(um[0].length).replace(/^\.?\s*/, '');
    }
    rest = rest.replace(/^of\s+/i, '');
    return { text: original, quantity: value, rangeMax, unit, bracket, name: rest.trim() || original };
  }

  function snapToFraction(d) {
    const tol = 0.025;
    for (const f of COMMON_FRACTIONS) if (Math.abs(d - f.d) <= tol) return f.s;
    return null;
  }
  function formatQuantity(v) {
    if (v == null || !Number.isFinite(v)) return '';
    if (v === 0) return '0';
    if (v < 0) return String(v);
    const whole = Math.floor(v), frac = v - whole;
    const snap = snapToFraction(frac);
    if (snap != null) { if (snap === '') return String(whole); return whole === 0 ? snap : `${whole}${snap}`; }
    return String(Math.round(v * 100) / 100).replace(/\.?0+$/, '');
  }
  function renderIngredientParts(p, factor = 1) {
    if (!p) return { qty: '', unit: '', name: '' };
    if (p.quantity == null) return { qty: '', unit: p.unit || '', name: p.name || p.text || '' };
    const scaled = p.quantity * factor;
    const scaledMax = p.rangeMax != null ? p.rangeMax * factor : null;
    let qty = formatQuantity(scaled);
    if (scaledMax != null) qty = `${qty}–${formatQuantity(scaledMax)}`;
    if (p.bracket) qty = `${qty} ${p.bracket}`;
    return { qty, unit: p.unit || '', name: p.name || '' };
  }

  window.Sift = window.Sift || {};
  window.Sift.parseIngredient = parseIngredient;
  window.Sift.formatQuantity = formatQuantity;
  window.Sift.renderIngredientParts = renderIngredientParts;
})();
