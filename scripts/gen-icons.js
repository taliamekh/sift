// Generate the Chrome extension's PNG icons by rendering an inline SVG with
// sharp. Idempotent — re-run whenever the design changes.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = resolve(__dirname, '..', 'extension', 'icons');
mkdirSync(ICON_DIR, { recursive: true });

const SVG = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFB1CC"/>
      <stop offset="100%" stop-color="#F06292"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="32" fill="url(#g)"/>
  <!-- chef hat body -->
  <path d="M32 88 L96 88 L96 60 C 96 44 84 40 76 40 C 76 28 52 28 52 40 C 44 40 32 44 32 60 Z" fill="#FFF8F8"/>
  <!-- hat band -->
  <path d="M32 80 L96 80" stroke="#F8B4D9" stroke-width="3" stroke-linecap="round"/>
  <!-- hat puffs -->
  <ellipse cx="48" cy="52" rx="8.5" ry="7" fill="#FFF8F8" stroke="#F8B4D9" stroke-width="2.2"/>
  <ellipse cx="80" cy="52" rx="8.5" ry="7" fill="#FFF8F8" stroke="#F8B4D9" stroke-width="2.2"/>
  <ellipse cx="64" cy="40" rx="8.5" ry="7" fill="#FFF8F8" stroke="#F8B4D9" stroke-width="2.2"/>
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
