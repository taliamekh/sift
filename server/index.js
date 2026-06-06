import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import parseRouter from './routes/parse.js';
import cookbooksRouter from './routes/cookbooks.js';
import recipesRouter from './routes/recipes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 4747;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// CORS for the Chrome extension. The extension's chrome-extension:// origin
// needs explicit access to the API.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use('/api', parseRouter);
app.use('/api', cookbooksRouter);
app.use('/api', recipesRouter);

// Uploaded photos
app.use('/uploads', express.static(resolve(ROOT, 'uploads'), {
  maxAge: '7d',
  fallthrough: false,
}));

// Frontend (everything else) — lives at the repo root so this same
// directory works both as the local Express-served app and as the
// subtree the website pulls into mekh.ca/sift.
app.use(express.static(ROOT, {
  index: 'index.html',
  extensions: ['html'],
}));

// SPA: anything that isn't an API/uploads call falls through to index.html
app.get(/^(?!\/(api|uploads)).+/, (req, res) => {
  res.sendFile(resolve(ROOT, 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error('[server]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`\n  Sift is live at  →  http://localhost:${PORT}\n`);
});
