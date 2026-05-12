import { h } from '../lib/h.js';
import { icon } from '../lib/icons.js';

// Read-only star display. `value` is 0-5 (can be fractional). `count` is the
// number of reviews; if present we show it next to the value.
export function StarRating(value, count, { size = '1em' } = {}) {
  const pct = Math.max(0, Math.min(100, (Number(value) || 0) * 20));
  const stars = h('div.stars', { style: { fontSize: size } });
  stars.innerHTML = `
    <span class="stars-track">${icon('star').repeat(5)}</span>
    <span class="stars-fill" style="--fill: ${pct}%">${icon('star').repeat(5)}</span>
  `;
  const wrap = h('div.star-rating', {}, stars);
  if (value != null) {
    wrap.appendChild(h('span.rating-text.tnum', {}, Number(value).toFixed(1)));
  }
  if (count != null && count > 0) {
    wrap.appendChild(h('span.rating-count', {}, `(${formatCount(count)})`));
  }
  return wrap;
}

function formatCount(c) {
  if (c < 1000) return String(c);
  if (c < 10000) return (c / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(c / 1000) + 'k';
}

// Interactive star input — user picks 1-5. Calls onChange(value | null).
export function StarInput(value, onChange) {
  const wrap = h('div.star-input', { role: 'radiogroup', 'aria-label': 'Your rating' });
  const buttons = [];
  for (let i = 1; i <= 5; i++) {
    const btn = h('button', {
      type: 'button',
      'aria-label': `${i} star${i > 1 ? 's' : ''}`,
      'aria-checked': value === i ? 'true' : 'false',
      role: 'radio',
      onClick: () => {
        // Toggle off if same value clicked
        const next = value === i ? null : i;
        onChange(next);
        update(next);
      },
    });
    btn.innerHTML = icon('star');
    buttons.push(btn);
    wrap.appendChild(btn);
  }
  function update(v) {
    value = v;
    buttons.forEach((b, idx) => b.classList.toggle('filled', v != null && idx + 1 <= v));
  }
  update(value);
  return wrap;
}
