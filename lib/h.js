// Tiny hyperscript helper so views can build DOM without template-string
// markup. Inspired by mithril/snabbdom but kept very small: ~50 lines, no
// vdom — direct DOM creation, fine for our scale.

export function h(tag, props, ...children) {
  // h('div.foo#bar', {...}, ...) — allow CSS-selector-style shortcuts in tag
  let parsedTag = tag;
  let parsedClass = null;
  let parsedId = null;
  const idMatch = tag.match(/#([^.#]+)/);
  if (idMatch) { parsedId = idMatch[1]; parsedTag = parsedTag.replace(idMatch[0], ''); }
  const classMatches = [...parsedTag.matchAll(/\.([^.#]+)/g)].map(m => m[1]);
  if (classMatches.length) {
    parsedClass = classMatches.join(' ');
    parsedTag = parsedTag.replace(/\.[^.#]+/g, '');
  }
  const node = document.createElement(parsedTag || 'div');
  if (parsedId) node.id = parsedId;
  if (parsedClass) node.className = parsedClass;
  if (props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
    for (const [key, value] of Object.entries(props)) {
      if (value === false || value == null) continue;
      if (key === 'class' || key === 'className') {
        node.className = [parsedClass, value].filter(Boolean).join(' ');
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(node.style, value);
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.assign(node.dataset, value);
      } else if (key === 'html') {
        node.innerHTML = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'ref' && typeof value === 'function') {
        value(node);
      } else if (typeof value === 'boolean') {
        if (value) node.setAttribute(key, '');
        else node.removeAttribute(key);
      } else {
        node.setAttribute(key, value);
      }
    }
  } else if (props != null) {
    children.unshift(props);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
  return node;
}

// Helper for SVG content from our icon library — returns a span with the raw
// markup so it can sit alongside text in flex rows.
export function svg(html) {
  const wrap = document.createElement('span');
  wrap.className = 'icon';
  wrap.style.display = 'inline-flex';
  wrap.innerHTML = html;
  return wrap;
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(target, ...children) {
  clear(target);
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    target.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return target;
}
