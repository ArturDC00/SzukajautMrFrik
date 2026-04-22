'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const { parseLocation } = require('./scrapers/location');
const { scrapeIAAI   } = require('./scrapers/iaai');
const { scrapeCopart } = require('./scrapers/copart');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ── CORS ──────────────────────────────────────────────────────────
// TODO: dopisz tutaj pełny URL hostingu zakładki Bitrix24
const ALLOWED = [
  /\.bitrix24\.pl$/,
  /\.bitrix24\.com$/,
  /^https:\/\/135\.125\.243\.231(?::\d+)?$/,
];
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);        // same-origin / curl / server-to-server
    const ok = ALLOWED.some(p => typeof p === 'string' ? p === origin : p.test(origin));
    cb(ok ? null : new Error('CORS: origin not allowed'), ok);
  },
}));

// ── AUTH ──────────────────────────────────────────────────────────
const API_KEY = process.env.API_KEY;
if (!API_KEY) console.warn('⚠  API_KEY not set in .env — endpoint is unprotected!');

function auth(req, res, next) {
  if (!API_KEY) return next();                 // dev fallback
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── ROUTES ────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.post('/api/scrape', auth, async (req, res) => {
  const { url } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Pole url jest wymagane' });
  }

  // Validate URL format
  let parsed;
  try { parsed = new URL(url); } catch {
    return res.status(400).json({ error: 'Nieprawidłowy URL' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Tylko protokół HTTP/HTTPS' });
  }

  const host = parsed.hostname.replace(/^www\./, '');

  if (host === 'autoauction.progi.com' || host.endsWith('.autoauction.progi.com')) {
    return res.status(400).json({
      error:  'Aukcje Progi wymagają danych z przeglądarki (wtyczka).',
      needsExtension: true,
    });
  }

  let result;
  try {
    if (host === 'iaai.com' || host.endsWith('.iaai.com')) {
      if (host === 'ca.iaai.com' || host.endsWith('.ca.iaai.com')) {
        result = await scrapeIAAI(url, { region: 'CA', currency: 'CAD' });
      } else {
        result = await scrapeIAAI(url, { region: 'US', currency: 'USD' });
      }
    } else if (host === 'copart.com' || host.endsWith('copart.com') || host.endsWith('copart.ca')) {
      if (host.endsWith('copart.ca')) {
        result = await scrapeCopart(url, { region: 'CA', currency: 'CAD' });
      } else {
        result = await scrapeCopart(url, { region: 'US', currency: 'USD' });
      }
    } else {
      return res.status(400).json({
        error: `Nieobsługiwany serwis: ${host}. Obsługiwane: IAAI, Copart, Progi (tylko wtyczka).`,
      });
    }

    if (result.data && result.data.location) {
      const pl = parseLocation(result.data.location);
      result = { ...result, locationParsed: pl };
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    console.error(`[scrape] FAILED ${url}:`, err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      // hint for the frontend — show PDF fallback if blocked
      needsFallback: /cloudflare|login|blocked|protection/i.test(err.message),
    });
  }
});

// ── START ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3002', 10);
// Listen only on localhost — nginx proxies HTTPS externally
app.listen(PORT, '127.0.0.1', () => {
  console.log(`frik-scraper listening on 127.0.0.1:${PORT}`);
});
