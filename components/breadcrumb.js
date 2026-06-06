import { h } from '../lib/h.js';
import { icon } from '../lib/icons.js';

// items: [{ label, href? }] — last item is current (no link).
export function Breadcrumb(items) {
  const wrap = h('nav.breadcrumb', { 'aria-label': 'Breadcrumb' });
  items.forEach((item, i) => {
    if (i > 0) {
      const sep = h('span.breadcrumb-sep', { 'aria-hidden': 'true' });
      sep.innerHTML = icon('chevronRight');
      wrap.appendChild(sep);
    }
    if (item.href && i < items.length - 1) {
      const a = h('a.breadcrumb-link', { href: item.href });
      if (item.icon) {
        const icn = h('span.breadcrumb-icon');
        icn.innerHTML = icon(item.icon);
        a.appendChild(icn);
      }
      a.appendChild(document.createTextNode(item.label));
      wrap.appendChild(a);
    } else {
      const span = h('span.breadcrumb-current', { 'aria-current': 'page' }, item.label);
      wrap.appendChild(span);
    }
  });
  return wrap;
}
