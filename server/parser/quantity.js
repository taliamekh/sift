// Parses and formats ingredient quantities for scaling.
// Goals: handle real-world messy strings from recipe sites without crashing,
// scale numerically, render back in pretty fractions when the result is close
// to a common cooking fraction.

const UNICODE_FRACTIONS = {
  '½': 0.5,  '⅓': 1 / 3, '⅔': 2 / 3,
  '¼': 0.25, '¾': 0.75,
  '⅕': 0.2,  '⅖': 0.4,  '⅗': 0.6,  '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const COMMON_FRACTIONS = [
  { d: 0,       s: ''     },
  { d: 0.125,   s: '⅛'    },
  { d: 0.25,    s: '¼'    },
  { d: 1 / 3,   s: '⅓'    },
  { d: 0.375,   s: '⅜'    },
  { d: 0.5,     s: '½'    },
  { d: 0.625,   s: '⅝'    },
  { d: 2 / 3,   s: '⅔'    },
  { d: 0.75,    s: '¾'    },
  { d: 0.875,   s: '⅞'    },
];

// Recognized unit words. Order matters — longer matches first via the regex
// alternation built below. Aliases all normalize to a canonical display form.
const UNITS = [
  { canonical: 'cup',        aliases: ['cups', 'cup', 'c.'] },
  { canonical: 'tablespoon', aliases: ['tablespoons', 'tablespoon', 'tbsps', 'tbsp.', 'tbsp', 'tbs', 'tbl', 'T.'] },
  { canonical: 'teaspoon',   aliases: ['teaspoons', 'teaspoon', 'tsps', 'tsp.', 'tsp', 'tspn', 't.'] },
  { canonical: 'ounce',      aliases: ['ounces', 'ounce', 'oz.', 'oz'] },
  { canonical: 'fluid ounce',aliases: ['fluid ounces', 'fluid ounce', 'fl oz', 'fl. oz.', 'fl. oz'] },
  { canonical: 'pound',      aliases: ['pounds', 'pound', 'lbs.', 'lbs', 'lb.', 'lb'] },
  { canonical: 'gram',       aliases: ['grams', 'gram', 'g.', 'g'] },
  { canonical: 'kilogram',   aliases: ['kilograms', 'kilogram', 'kgs', 'kg.', 'kg'] },
  { canonical: 'milligram',  aliases: ['milligrams', 'milligram', 'mg.', 'mg'] },
  { canonical: 'milliliter', aliases: ['milliliters', 'milliliter', 'ml.', 'ml'] },
  { canonical: 'liter',      aliases: ['liters', 'litres', 'liter', 'litre', 'l.'] },
  { canonical: 'quart',      aliases: ['quarts', 'quart', 'qts', 'qt.', 'qt'] },
  { canonical: 'pint',       aliases: ['pints', 'pint', 'pts', 'pt.', 'pt'] },
  { canonical: 'gallon',     aliases: ['gallons', 'gallon', 'gal.', 'gal'] },
  { canonical: 'pinch',      aliases: ['pinches', 'pinch'] },
  { canonical: 'dash',       aliases: ['dashes', 'dash'] },
  { canonical: 'package',    aliases: ['packages', 'package', 'pkgs', 'pkg.', 'pkg'] },
  { canonical: 'can',        aliases: ['cans', 'can'] },
  { canonical: 'stick',      aliases: ['sticks', 'stick'] },
  { canonical: 'clove',      aliases: ['cloves', 'clove'] },
  { canonical: 'slice',      aliases: ['slices', 'slice'] },
  { canonical: 'piece',      aliases: ['pieces', 'piece'] },
  { canonical: 'sprig',      aliases: ['sprigs', 'sprig'] },
  { canonical: 'bunch',      aliases: ['bunches', 'bunch'] },
];

const UNIT_LOOKUP = new Map();
for (const u of UNITS) {
  for (const a of u.aliases) UNIT_LOOKUP.set(a.toLowerCase().replace(/\.$/, ''), u.canonical);
}

const UNIT_RE_SOURCE = UNITS.flatMap(u => u.aliases)
  .sort((a, b) => b.length - a.length)
  .map(a => a.replace(/\./g, '\\.?'))
  .join('|');
const UNIT_RE = new RegExp(`^(${UNIT_RE_SOURCE})\\b`, 'i');

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  dozen: 12, half: 0.5, quarter: 0.25,
};

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

function readLeadingQuantity(str) {
  // Returns { value, end, rangeMax? } or null. Handles:
  //   "1", "1.5", "1/2", "½", "1 1/2", "1½", "1 to 2", "1-2"
  let s = str.trimStart();
  const skipped = str.length - s.length;
  if (!s) return null;

  // Word number form ("a", "one", "half", "dozen") only if followed by space/unit/letter
  const wordMatch = s.match(/^([A-Za-z]+)\b/);
  if (wordMatch && NUMBER_WORDS[wordMatch[1].toLowerCase()] != null) {
    const w = wordMatch[1].toLowerCase();
    // Only treat as quantity if next non-space is a unit or "of"
    const afterWord = s.slice(wordMatch[0].length).trimStart();
    if (UNIT_RE.test(afterWord) || /^of\b/i.test(afterWord)) {
      return {
        value: NUMBER_WORDS[w],
        end: skipped + wordMatch[0].length,
        wasWord: true,
      };
    }
  }

  // Numeric form. Fraction pattern MUST come before decimal so "3/4" parses
  // as 0.75 instead of decimal-3 leaving "/4" stranded in the ingredient name.
  const numRe = /^(\d+\/\d+|\d+(?:[.,]\d+)?|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/;
  const first = s.match(numRe);
  if (!first) return null;

  let value = parseNumericToken(first[1].replace(',', '.'));
  if (value == null) return null;
  let consumed = first[0].length;

  // Possible mixed-fraction continuation: "1 1/2", "1 ½", "1½"
  const rest = s.slice(consumed);
  // Tight unicode fraction directly attached, e.g. "1½"
  const tight = rest.match(/^([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
  if (tight) {
    value += UNICODE_FRACTIONS[tight[1]];
    consumed += tight[0].length;
  } else {
    const mixed = rest.match(/^\s+(\d+\/\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?!\d)/);
    if (mixed) {
      const frac = parseNumericToken(mixed[1]);
      if (frac != null && frac < 1) {
        value += frac;
        consumed += mixed[0].length;
      }
    }
  }

  // Range continuation: "1-2", "1 - 2", "1 to 2"
  const tail = s.slice(consumed);
  const range = tail.match(/^\s*(?:-|–|—|to)\s*(\d+(?:[.,]\d+)?|\d+\/\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/);
  let rangeMax = null;
  if (range) {
    const r = parseNumericToken(range[1].replace(',', '.'));
    if (r != null) {
      rangeMax = r;
      consumed += range[0].length;
    }
  }

  return {
    value,
    rangeMax,
    end: skipped + consumed,
  };
}

export function parseIngredient(line) {
  if (typeof line !== 'string') return null;
  const original = line.replace(/\s+/g, ' ').trim();
  if (!original) return null;

  // Strip leading bullets, asterisks, dashes
  let working = original.replace(/^[-*•·–—•]\s*/, '');

  // Save and strip a leading parenthetical like "1 (8-ounce) package …"
  // We keep the outer quantity (1) as the scaling quantity, and store the
  // bracketed text as a modifier we render verbatim.
  let bracket = null;
  const bracketMatch = working.match(/^(\d+[\d.,/\s½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞-]*)\s*(\([^)]*\))/);
  if (bracketMatch) {
    bracket = bracketMatch[2];
    working = working.slice(0, bracketMatch[1].length) + working.slice(bracketMatch[0].length);
    working = working.replace(/\s+/g, ' ').trim();
  }

  const qty = readLeadingQuantity(working);
  let value = qty?.value ?? null;
  let rangeMax = qty?.rangeMax ?? null;
  let rest = qty ? working.slice(qty.end).trimStart() : working;

  // Optional unit
  let unit = null;
  const unitMatch = rest.match(UNIT_RE);
  if (unitMatch) {
    unit = UNIT_LOOKUP.get(unitMatch[1].toLowerCase().replace(/\.$/, '')) || unitMatch[1];
    rest = rest.slice(unitMatch[0].length).replace(/^\.?\s*/, '');
  }

  // Drop a single leading "of"
  rest = rest.replace(/^of\s+/i, '');

  return {
    text: original,
    quantity: value,
    rangeMax,
    unit,
    bracket,
    name: rest.trim() || original,
  };
}

function snapToFraction(decimal) {
  const tol = 0.025;
  for (const f of COMMON_FRACTIONS) {
    if (Math.abs(decimal - f.d) <= tol) return f.s;
  }
  return null;
}

export function formatQuantity(value) {
  if (value == null || !Number.isFinite(value)) return '';
  if (value === 0) return '0';
  if (value < 0) return String(value);
  const whole = Math.floor(value);
  const frac = value - whole;
  const snapped = snapToFraction(frac);
  if (snapped != null) {
    if (snapped === '') return String(whole);
    return whole === 0 ? snapped : `${whole}${snapped}`;
  }
  // No clean fraction — render decimal, trim trailing zeros, max 2 places
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(/\.?0+$/, '');
}

export function scaleIngredient(parsed, factor) {
  if (!parsed || parsed.quantity == null) return parsed;
  const scaled = { ...parsed };
  scaled.quantity = parsed.quantity * factor;
  if (parsed.rangeMax != null) scaled.rangeMax = parsed.rangeMax * factor;
  return scaled;
}

export function renderIngredient(parsed) {
  if (!parsed) return '';
  if (parsed.quantity == null) return parsed.text || parsed.name || '';
  const parts = [];
  if (parsed.rangeMax != null) {
    parts.push(`${formatQuantity(parsed.quantity)}–${formatQuantity(parsed.rangeMax)}`);
  } else {
    parts.push(formatQuantity(parsed.quantity));
  }
  if (parsed.bracket) parts.push(parsed.bracket);
  if (parsed.unit) parts.push(parsed.unit + (parsed.quantity > 1 && !parsed.unit.endsWith('s') && /^[a-z]/i.test(parsed.unit) ? '' : ''));
  if (parsed.name) parts.push(parsed.name);
  return parts.filter(Boolean).join(' ');
}
