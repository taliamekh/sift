// Hand-drawn line-art kitchen doodles scattered behind the page.
// Inspired by the chaos-kitchen meme aesthetic the user shared — a chef's
// pan with flames, a whisk mid-spin, a pot bubbling steam — but kept light,
// sketchy, and faded so they read as background texture rather than UI.

import { h } from '../lib/h.js';

// Each doodle is its own viewBox-0-100 SVG, single-color, no fill so the
// pages underneath can show through. They live in a fixed-position layer
// behind the main content via z-index: -1.
const DOODLES = {
  whisk: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <line x1="50" y1="8" x2="50" y2="55"/>
    <path d="M30 70 C 30 86 70 86 70 70"/>
    <path d="M37 60 C 37 78 50 84 50 84 C 50 84 63 78 63 60"/>
    <path d="M44 58 C 44 75 50 84 50 84 C 50 84 56 75 56 58"/>
  </svg>`,
  pan: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 62 C 14 78 32 84 50 84 C 68 84 86 78 86 62 Z"/>
    <line x1="86" y1="62" x2="98" y2="68"/>
    <path d="M30 55 C 28 45 35 38 32 30 C 36 36 40 36 38 28 C 44 36 48 28 46 22 C 50 32 56 28 54 20 C 58 32 50 50 38 56"/>
  </svg>`,
  pot: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 50 L78 50 L72 86 C 72 90 68 92 64 92 L 36 92 C 32 92 28 90 28 86 Z"/>
    <line x1="14" y1="56" x2="22" y2="56"/>
    <line x1="78" y1="56" x2="86" y2="56"/>
    <path d="M40 42 C 42 32 48 38 50 30 C 52 38 56 32 58 42"/>
    <path d="M44 24 C 46 18 50 22 50 16"/>
  </svg>`,
  chefHat: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28 78 L72 78 L72 50 C 72 36 64 30 56 30 C 56 22 44 22 44 30 C 36 30 28 36 28 50 Z"/>
    <line x1="28" y1="72" x2="72" y2="72"/>
    <ellipse cx="40" cy="38" rx="6" ry="5"/>
    <ellipse cx="60" cy="38" rx="6" ry="5"/>
    <ellipse cx="50" cy="28" rx="6" ry="5"/>
  </svg>`,
  rollingPin: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <rect x="22" y="46" width="56" height="14" rx="6"/>
    <line x1="10" y1="49" x2="22" y2="49"/>
    <line x1="10" y1="57" x2="22" y2="57"/>
    <line x1="78" y1="49" x2="90" y2="49"/>
    <line x1="78" y1="57" x2="90" y2="57"/>
  </svg>`,
  cupcake: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 58 L70 58 L62 90 L38 90 Z"/>
    <line x1="36" y1="64" x2="62" y2="64"/>
    <path d="M22 58 C 22 38 50 32 50 32 C 50 32 78 38 78 58"/>
    <path d="M28 56 C 33 44 42 52 50 40 C 58 52 67 44 72 56"/>
    <circle cx="50" cy="24" r="4"/>
    <line x1="50" y1="28" x2="50" y2="32"/>
  </svg>`,
  bowl: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 48 L84 48 C 84 80 60 86 50 86 C 40 86 16 80 16 48 Z"/>
    <line x1="16" y1="54" x2="84" y2="54"/>
    <line x1="62" y1="42" x2="84" y2="18"/>
    <ellipse cx="66" cy="44" rx="6" ry="3.5" transform="rotate(-50 66 44)"/>
  </svg>`,
  sparkle: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 14 L 56 44 L 86 50 L 56 56 L 50 86 L 44 56 L 14 50 L 44 44 Z"/>
  </svg>`,
  flame: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 90 C 30 84 22 70 28 54 C 30 60 36 56 36 48 C 42 56 46 50 44 38 C 52 48 56 40 54 30 C 64 42 72 44 70 58 C 76 54 80 56 76 64 C 84 64 82 76 76 80 C 70 86 60 92 50 90 Z"/>
    <path d="M50 76 C 42 72 40 66 44 60 C 46 64 50 60 52 56 C 54 64 58 62 56 54 C 62 60 64 64 60 72 C 58 76 54 78 50 76 Z"/>
  </svg>`,
  spoon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="28" cy="34" rx="14" ry="10" transform="rotate(-35 28 34)"/>
    <line x1="42" y1="46" x2="84" y2="86"/>
  </svg>`,
  steam: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 80 C 30 60 50 60 50 40 C 50 20 70 20 70 0"/>
    <path d="M18 80 C 18 66 32 64 32 50"/>
    <path d="M82 80 C 82 66 68 64 68 50"/>
  </svg>`,
};

// Each entry chooses a doodle and where to place it. Coordinates are in
// viewport units so the layout adapts when the window resizes.
const PLACEMENTS = [
  { d: 'whisk',      style: { top: '8%',   left: '3%',  width: '110px', '--rot': '-12deg', '--delay': '0s' } },
  { d: 'pan',        style: { top: '14%',  right: '4%', width: '130px', '--rot': '14deg',  '--delay': '-3s' } },
  { d: 'flame',      style: { top: '6%',   right: '22%',width: '70px',  '--rot': '-6deg',  '--delay': '-1.4s' } },
  { d: 'pot',        style: { top: '45%',  left: '2%',  width: '120px', '--rot': '8deg',   '--delay': '-2.2s' } },
  { d: 'steam',      style: { top: '38%',  left: '12%', width: '60px',  '--rot': '0deg',   '--delay': '-4s' } },
  { d: 'rollingPin', style: { top: '58%',  right: '3%', width: '140px', '--rot': '-10deg', '--delay': '-5s' } },
  { d: 'cupcake',    style: { top: '76%',  left: '6%',  width: '90px',  '--rot': '6deg',   '--delay': '-2.6s' } },
  { d: 'chefHat',    style: { top: '24%',  left: '46%', width: '78px',  '--rot': '-4deg',  '--delay': '-3.4s' } },
  { d: 'bowl',       style: { top: '70%',  right: '20%',width: '100px', '--rot': '4deg',   '--delay': '-1.8s' } },
  { d: 'spoon',      style: { top: '88%',  right: '8%', width: '90px',  '--rot': '22deg',  '--delay': '-5.5s' } },
  { d: 'sparkle',    style: { top: '34%',  left: '38%', width: '36px',  '--rot': '0deg',   '--delay': '-0.8s' } },
  { d: 'sparkle',    style: { top: '52%',  right: '35%',width: '30px',  '--rot': '0deg',   '--delay': '-2.4s' } },
  { d: 'sparkle',    style: { top: '82%',  left: '40%', width: '34px',  '--rot': '0deg',   '--delay': '-3.8s' } },
];

export function renderBackgroundArt() {
  const layer = h('div.bg-art-layer', { 'aria-hidden': 'true' });
  PLACEMENTS.forEach(p => {
    const node = h('span.bg-art');
    Object.assign(node.style, p.style);
    node.innerHTML = DOODLES[p.d];
    layer.appendChild(node);
  });
  return layer;
}
