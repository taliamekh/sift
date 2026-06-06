// ISO 8601 duration parser focused on recipe times (hours/minutes/seconds).
// Recipes never use days/months/years so we ignore those.

export function parseDuration(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.trim().match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const h = parseInt(m[1] || 0, 10);
  const min = parseInt(m[2] || 0, 10);
  const s = parseInt(m[3] || 0, 10);
  const total = h * 60 + min + Math.round(s / 60);
  return total > 0 ? total : null;
}

export function formatDuration(totalMinutes) {
  if (totalMinutes == null || totalMinutes <= 0) return null;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? `1 hour` : `${h} hours`;
  return `${h} ${h === 1 ? 'hour' : 'hours'} ${m} min`;
}
