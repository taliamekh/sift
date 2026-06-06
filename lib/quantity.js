// Client-side version — used for live ingredient scaling.
// Mirrors server/parser/quantity.js (formatQuantity logic) but only the parts
// the UI needs, since the server has already parsed the strings into
// { text, quantity, rangeMax, unit, bracket, name } shapes.

const COMMON_FRACTIONS = [
  { d: 0,     s: ''  },
  { d: 0.125, s: '⅛' },
  { d: 0.25,  s: '¼' },
  { d: 1 / 3, s: '⅓' },
  { d: 0.375, s: '⅜' },
  { d: 0.5,   s: '½' },
  { d: 0.625, s: '⅝' },
  { d: 2 / 3, s: '⅔' },
  { d: 0.75,  s: '¾' },
  { d: 0.875, s: '⅞' },
];

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
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace(/\.?0+$/, '');
}

export function scaleQuantity(value, factor) {
  if (value == null || !Number.isFinite(value)) return value;
  return value * factor;
}

// Render a parsed ingredient (potentially scaled) back to its display parts
// for use in our highlighted spans.
export function renderIngredientParts(parsed, factor = 1) {
  if (!parsed) return { qty: '', unit: '', name: '' };
  if (parsed.quantity == null) return { qty: '', unit: parsed.unit || '', name: parsed.name || parsed.text || '' };
  const scaled = parsed.quantity * factor;
  const scaledMax = parsed.rangeMax != null ? parsed.rangeMax * factor : null;
  let qty = formatQuantity(scaled);
  if (scaledMax != null) qty = `${qty}–${formatQuantity(scaledMax)}`;
  if (parsed.bracket) qty = `${qty} ${parsed.bracket}`;
  return {
    qty,
    unit: parsed.unit || '',
    name: parsed.name || '',
  };
}
