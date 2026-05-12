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
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="0.6"/>
    </filter>
  </defs>
  <rect width="128" height="128" rx="32" fill="url(#g)"/>
  <!-- cupcake silhouette -->
  <path d="M40 56h48l-6 30c-1 5-5 8-10 8H56c-5 0-9-3-10-8z" fill="#FFF7F0" opacity="0.95"/>
  <path d="M38 56c0-12 11-22 26-22s26 10 26 22z" fill="white"/>
  <!-- frosting swirl detail -->
  <path d="M48 50c4-2 8 0 10-2s4-4 8-2 6 0 8-2 8 0 10 2" stroke="#FFB1CC" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <!-- cherry -->
  <circle cx="64" cy="28" r="5.5" fill="#FFFFFF"/>
  <circle cx="64" cy="28" r="4" fill="#F06292"/>
  <path d="M64 24c0-4 6-6 6-10" stroke="#7A5547" stroke-width="2" fill="none" stroke-linecap="round"/>
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
