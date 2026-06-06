// Generate the Chrome extension's PNG icons by rendering an inline SVG with
// sharp. Idempotent — re-run whenever the design changes.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = resolve(__dirname, '..', 'extension', 'icons');
mkdirSync(ICON_DIR, { recursive: true });

// H-1 chef hat scaled into a 128×128 canvas (source 24×24 coords × 5.33,
// translated by 4 horizontally). The continuous 3-hump wavy curve sits on
// top of a rectangular band; both rendered in solid white over the pink
// gradient panel.
const SVG = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFB1CC"/>
      <stop offset="100%" stop-color="#F06292"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="32" fill="url(#g)"/>
  <path d="M 32 76 C 27 55 32 28 42 24 C 50 12 56 24 56 40 C 56 24 66 12 76 12 C 86 12 86 24 86 40 C 86 24 96 12 102 24 C 112 28 107 55 102 76 Z" fill="#FFFFFF"/>
  <rect x="32" y="76" width="70" height="18" fill="#FFFFFF"/>
  <line x1="34" y1="76" x2="100" y2="76" stroke="#F8B4D9" stroke-width="2.4" stroke-linecap="round"/>
</svg>`);

const sizes = [16, 32, 48, 64, 128];
for (const size of sizes) {
  const out = resolve(ICON_DIR, `icon-${size}.png`);
  await sharp(SVG(size)).resize(size, size).png().toFile(out);
  console.log('wrote', out);
}

// Also a 32px favicon for the web app (sits next to the SVG one for browsers
// that don't support SVG favicons)
const faviconOut = resolve(__dirname, '..', 'public', 'favicon-32.png');
await sharp(SVG(32)).resize(32, 32).png().toFile(faviconOut);
console.log('wrote', faviconOut);
