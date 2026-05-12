import { h, $, mount } from './h.js';
import { icon } from './icons.js';

let host = null;
function ensureHost() {
  if (host && document.body.contains(host)) return host;
  host = $('.toast-host') || h('div.toast-host', { 'aria-live': 'polite' });
  document.body.appendChild(host);
  return host;
}

export function toast(message, { type = 'default', duration = 2400 } = {}) {
  const root = ensureHost();
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'close' : 'sparkle';
  const node = h(`div.toast.${type}`, { role: 'status' });
  node.innerHTML = `${icon(iconName)}<span>${escapeHtml(message)}</span>`;
  root.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity 220ms, transform 220ms';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 240);
  }, duration);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export const success = (m, opts) => toast(m, { ...opts, type: 'success' });
export const error   = (m, opts) => toast(m, { ...opts, type: 'error' });
