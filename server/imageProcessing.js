// Image processing helpers shared by upload routes. Uses sharp's libvips
// build (which on prebuilt npm sharp 0.33+ includes PDF/SVG/HEIF/AVIF
// support out of the box), so we can accept a PDF and render its first
// page to a PNG without shelling out to GhostScript or pulling in a
// second dependency.
import sharp from 'sharp';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { extname } from 'node:path';

/**
 * Convert the first page of a PDF (path on disk) to a PNG file at the
 * provided destination path. Returns the destination path on success.
 *
 * The cover gallery only needs the first page, so we hard-code
 * `page: 0`. The density is set to 200 DPI — high enough that screenshots
 * of book pages, recipe cards, or magazine clippings stay crisp when
 * stretched across a cookbook cover card, while keeping the resulting
 * PNG well under 2 MB for typical inputs.
 */
export async function pdfFirstPageToPng(pdfPath, pngDestPath) {
  const buffer = await readFile(pdfPath);
  const png = await sharp(buffer, { density: 200, page: 0 })
    .png({ compressionLevel: 8 })
    .toBuffer();
  await writeFile(pngDestPath, png);
  return pngDestPath;
}

/**
 * Best-effort cleanup. Used to delete a temporary upload after we've
 * converted it. Swallows errors so callers don't need to wrap.
 */
export async function safeUnlink(path) {
  try { await unlink(path); } catch { /* ignore */ }
}

/** True if the filename ends with .pdf (case-insensitive). */
export function isPdfFilename(name) {
  return /\.pdf$/i.test(extname(name || ''));
}
