// Node + Express proxy scraper for arctracker.io items.
// Usage: node src/proxy-server.js
// Installs: npm install express node-fetch cheerio
//
// Provides GET /lookup?name=Adrenaline%20Shot
// Returns JSON: { name: "...", slug: "...", value: 1250, url: "https://arctracker.io/items/adrenaline_shot" }

const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 4000;
const app = express();

function nameToSlug(name) {
  return name.trim().toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function extractNumberFromText(text) {
  const nums = Array.from(text.matchAll(/([0-9][0-9,\.]{0,10})/g), m => m[1].replace(/,/g, ''));
  const parsed = nums.map(s => Number(s)).filter(n => Number.isFinite(n));
  if (parsed.length === 0) return null;
  return parsed.reduce((a,b) => a>b? a:b, parsed[0]);
}

app.get('/lookup', async (req, res) => {
  const name = req.query.name || '';
  if (!name) return res.status(400).json({ error: 'missing name' });
  const slug = nameToSlug(name);
  const url = `https://arctracker.io/items/${encodeURIComponent(slug)}`;
  try {
    const r = await fetch(url, { timeout: 10000 });
    if (!r.ok) return res.status(500).json({ error: 'fetch_failed', status: r.status });
    const html = await r.text();
    const $ = cheerio.load(html);
    let found = null;
    $('*').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (!text) return;
      if (text.includes('value') || text.includes('price') || text.includes('worth')) {
        const nearby = $(el).text() + ' ' + $(el).next().text() + ' ' + $(el).parent().text();
        const n = extractNumberFromText(nearby);
        if (n && (!found || n > found)) found = n;
      }
    });
    if (!found) {
      const whole = $.root().text();
      found = extractNumberFromText(whole);
    }
    return res.json({ name, slug, value: found || null, url });
  } catch (e) {
    console.error('Lookup error', e);
    return res.status(500).json({ error: 'exception', message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy scraper listening on http://localhost:${PORT}`);
});