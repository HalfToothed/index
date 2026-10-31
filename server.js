// server.js
// Express server for Index.
//
//   GET /            -> static frontend (index.html, app.js, style.css)
//   GET /api/today   -> latest non-empty day's events, each flagged with history
//   POST /api/context-> Gemma summary for one ongoing story (generated on demand)
//
// Caching:
//   - The parsed portal page is cached in memory for 10 minutes (today is still
//     being edited upstream). Response carries X-Cache: HIT|MISS.
//   - Each context summary is cached by a key derived from its topic + the set
//     of earlier dates, so it is generated once per story per day.
//
// Secrets: the Gemma key is read from the environment only, never shipped to the
// browser. The browser calls /api/context; the key stays server-side.

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';

import { htmlToDOM, parseDays } from './parse.js';
import { attachContext, contextCacheKey } from './context.js';
import { generateContext } from './gemma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env (if present) into process.env without a dependency. Cloudways sets
// real env vars in its dashboard, so this is only for local development.
async function loadEnv() {
  try {
    const raw = await readFile(join(__dirname, '.env'), 'utf8');
    raw.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) process.env[key] = value;
    });
  } catch {
    // No .env file: rely on real environment variables.
  }
}
await loadEnv();

const PORT = process.env.PORT || 3000;
const WIKI_URL =
  'https://en.wikipedia.org/w/api.php' +
  '?action=parse&page=Portal:Current_events&prop=text&format=json&formatversion=2';
const USER_AGENT = 'Index/2.0 (https://github.com/HalfToothed/index; daily events reader)';
const PORTAL_TTL_MS = 10 * 60 * 1000; // 10 minutes

const app = express();
app.use(express.json());

// ---- In-memory caches -----------------------------------------------------

let portalCache = { at: 0, data: null };
const summaryCache = new Map(); // key -> summary string

// ---- Portal fetch + parse -------------------------------------------------

/**
 * Fetch and parse the portal page, caching the result. Returns the latest
 * non-empty day's sections (with context attached) plus the earlier days used
 * to build that context.
 * @returns {Promise<{ hit: boolean, payload: object }>}
 */
async function getToday() {
  const now = Date.now();
  if (portalCache.data && now - portalCache.at < PORTAL_TTL_MS) {
    return { hit: true, payload: portalCache.data };
  }

  let data;
  if (process.env.USE_FIXTURE === '1') {
    // Dev-only: read a saved copy of the portal response (for networks that
    // block the live Wikipedia TLS cert). Never set this in production.
    data = JSON.parse(await readFile(join(__dirname, 'fixture.json'), 'utf8'));
  } else {
    const res = await fetch(WIKI_URL, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`Wikipedia responded ${res.status}`);
    data = await res.json();
  }

  const html = data?.parse?.text;
  if (!html) throw new Error('Unexpected Wikipedia response shape');

  const doc = htmlToDOM(html);
  const days = parseDays(doc);

  // Choose which day to show. We want the newest day that (a) has events and
  // (b) has at least one ongoing story, so the context feature is actually
  // visible. Early in a UTC day the newest day is thin and its topics haven't
  // recurred yet; in that case we drop back to an earlier, richer day rather
  // than show a day with no context at all.
  const candidates = [];
  for (let i = 0; i < days.length; i += 1) {
    const day = days[i];
    const hasEvents = day.some((section) => section.items.length > 0);
    if (!hasEvents) continue;
    const { sections, hasAnyContext } = attachContext(day, days.slice(i + 1));
    candidates.push({ index: i, date: day.date, sections, hasAnyContext });
  }

  // Prefer the newest day that has context; otherwise the newest day with events.
  const chosen =
    candidates.find((c) => c.hasAnyContext) || candidates[0] || null;

  const payload = chosen
    ? { date: chosen.date || '', hasAnyContext: chosen.hasAnyContext, sections: chosen.sections }
    : { date: '', hasAnyContext: false, sections: [] };

  portalCache = { at: now, data: payload };
  return { hit: false, payload };
}

// ---- Routes ---------------------------------------------------------------

app.get('/api/today', async (req, res) => {
  try {
    const { hit, payload } = await getToday();
    res.set('X-Cache', hit ? 'HIT' : 'MISS');
    res.json(payload);
  } catch (err) {
    console.error('GET /api/today failed:', err);
    res.status(502).json({ error: 'Could not load current events.' });
  }
});

app.post('/api/context', async (req, res) => {
  try {
    const { topic, seedDescription, history } = req.body || {};
    if (!topic || !seedDescription || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'topic, seedDescription, and non-empty history are required.' });
    }

    const key = contextCacheKey(topic, history);
    if (summaryCache.has(key)) {
      res.set('X-Cache', 'HIT');
      return res.json({ timeline: summaryCache.get(key) });
    }

    const timeline = await generateContext(topic, seedDescription, history);
    summaryCache.set(key, timeline);
    res.set('X-Cache', 'MISS');
    res.json({ timeline });
  } catch (err) {
    console.error('POST /api/context failed:', err);
    res.status(502).json({ error: 'Could not generate context.' });
  }
});

// Static frontend. Served after the API routes so /api/* is never shadowed.
app.use(express.static(join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Index listening on http://localhost:${PORT}`);
});
