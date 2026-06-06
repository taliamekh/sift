// Hash-based router. Routes are simple patterns with `:param` placeholders.

const routes = [];

export function route(pattern, handler) {
  const paramNames = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:[A-Za-z]+/g, m => { paramNames.push(m.slice(1)); return '([^/]+)'; }) + '$'
  );
  routes.push({ pattern, regex, paramNames, handler });
}

export function navigate(path, { replace = false } = {}) {
  const hash = path.startsWith('#') ? path : `#${path}`;
  if (replace) history.replaceState(null, '', hash);
  else location.hash = hash;
  if (replace) handleRoute();
}

function handleRoute() {
  let full = location.hash.slice(1) || '/';
  if (!full.startsWith('/')) full = '/' + full;
  const [path, queryString] = full.split('?', 2);
  const query = new URLSearchParams(queryString || '');
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.paramNames.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      r.handler({ path, params, query });
      return;
    }
  }
  navigate('/', { replace: true });
}

export function startRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function currentPath() {
  return location.hash.slice(1) || '/';
}
