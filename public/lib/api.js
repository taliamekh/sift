// Thin wrapper around fetch — same-origin, JSON in & out, throws structured
// errors so views can show the server's user-facing error message.

const headers = { 'Content-Type': 'application/json' };

async function request(method, path, body, opts = {}) {
  const init = { method, headers: { ...headers, ...(opts.headers || {}) } };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (opts.signal) init.signal = opts.signal;
  const res = await fetch(`/api${path}`, init);
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  parseUrl: (url, signal) => request('POST', '/parse', { url }, { signal }),

  // Cookbooks
  listCookbooks:  () => request('GET',    '/cookbooks'),
  getCookbook:    (id) => request('GET',    `/cookbooks/${id}`),
  createCookbook: (data) => request('POST',   '/cookbooks', data),
  updateCookbook: (id, data) => request('PATCH',  `/cookbooks/${id}`, data),
  deleteCookbook: (id) => request('DELETE', `/cookbooks/${id}`),
  listCoverPresets: () => request('GET', '/cover-presets'),
  uploadCoverPreset: async (file) => {
    const form = new FormData();
    form.append('cover', file);
    const res = await fetch('/api/cover-presets', { method: 'POST', body: form });
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.json();
  },
  deleteCoverPreset: (name) => request('DELETE', `/cover-presets/${encodeURIComponent(name)}`),
  uploadCoverImage: async (cookbookId, file) => {
    const form = new FormData();
    form.append('cover', file);
    const res = await fetch(`/api/cookbooks/${cookbookId}/cover-image`, { method: 'POST', body: form });
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.json();
  },

  // Tabs
  createTab:   (cookbookId, data) => request('POST',   `/cookbooks/${cookbookId}/tabs`, data),
  updateTab:   (id, data) => request('PATCH',  `/tabs/${id}`, data),
  deleteTab:   (id) => request('DELETE', `/tabs/${id}`),
  reorderTabs: (ids) => request('POST',   `/tabs/reorder`, { ids }),

  // Recipes
  listRecipes:  (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request('GET', `/recipes${q ? `?${q}` : ''}`);
  },
  getRecipe:    (id) => request('GET',    `/recipes/${id}`),
  saveRecipe:   (payload) => request('POST',   `/recipes`, payload),
  updateRecipe: (id, data) => request('PATCH',  `/recipes/${id}`, data),
  deleteRecipe: (id) => request('DELETE', `/recipes/${id}`),

  // Generic single image upload (returns { url }) — used to attach a hero
  // image to a manually-created recipe before the recipe row exists.
  uploadImage: async (file) => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch('/api/uploads/image', { method: 'POST', body: form });
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.json();
  },

  // Photos (special: multipart/form-data)
  uploadPhotos: async (recipeId, files) => {
    const form = new FormData();
    for (const f of files) form.append('photo', f);
    const res = await fetch(`/api/recipes/${recipeId}/photos`, { method: 'POST', body: form });
    if (!res.ok) {
      const err = new Error(`Upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  },
  deletePhoto: (id) => request('DELETE', `/photos/${id}`),
};
