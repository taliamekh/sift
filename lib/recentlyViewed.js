// Tracks the last ~24 recipes the user opened in this browser, regardless
// of whether they saved them. The list lives in localStorage so it survives
// reloads without needing a server table — it's intentionally local-only,
// because "what did I look at on this machine" is a different question from
// "what's in my cookbooks."
//
// Each entry is one of:
//   { kind: 'parsed', url, title, heroImage, totalMinutes, externalRating, viewedAt }
//   { kind: 'saved',  id, url?, title, heroImage, totalMinutes, externalRating, viewedAt }
//
// Dedup rules: a saved recipe and a parsed entry with the same source URL
// collapse to a single (saved) entry; same id or same url across entries
// also collapses. New views float to the front.

const KEY = 'sift.recentlyViewed';
const MAX = 24;

export function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(entry) {
  if (!entry || !entry.title) return;
  const list = getRecentlyViewed();
  const next = { ...entry, viewedAt: Date.now() };
  const filtered = list.filter(it => !isSameRecipe(it, next));
  filtered.unshift(next);
  while (filtered.length > MAX) filtered.pop();
  try { localStorage.setItem(KEY, JSON.stringify(filtered)); } catch { /* quota */ }
}

export function removeRecentlyViewed(predicate) {
  const next = getRecentlyViewed().filter(it => !predicate(it));
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function clearRecentlyViewed() {
  try { localStorage.removeItem(KEY); } catch {}
}

function isSameRecipe(a, b) {
  if (!a || !b) return false;
  if (a.kind === 'saved' && b.kind === 'saved' && a.id != null && a.id === b.id) return true;
  if (a.url && b.url && a.url === b.url) return true;
  return false;
}
