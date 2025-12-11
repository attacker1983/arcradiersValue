const fs = require('fs');
const path = require('path');

const TARGET_SITE = 'https://arctracker.io/items/';

function nameToSlug(name) {
  if (!name) return '';
  return name.trim()
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function normalizeNumberString(s) {
  if (!s) return null;
  const cleaned = s.replace(/,/g, '').replace(/[^\d\.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractValueFromHtml(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/\s+/g, ' ');
  const valueRegex = /(value|price|worth)[^\d\-]{0,30}([0-9][0-9,\.]{0,10})/i;
  const match = text.match(valueRegex);
  if (match && match[2]) return normalizeNumberString(match[2]);
  const nums = Array.from(text.matchAll(/([0-9][0-9,\.]{0,10})/g), x => normalizeNumberString(x[1])).filter(Boolean);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => (a > b ? a : b), nums[0]);
}

async function fetchHtmlWithFallback(url, slug) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { html: await res.text(), source: 'live' };
  } catch (e) {
    const fixturePath = path.join(__dirname, 'fixtures', `${slug}.html`);
    if (fs.existsSync(fixturePath)) {
      const html = fs.readFileSync(fixturePath, 'utf8');
      return { html, source: 'fixture', error: e.message || String(e) };
    }
    throw e;
  }
}

async function lookupItem(name) {
  const slug = nameToSlug(name);
  if (!slug) throw new Error('Item name is empty after normalization');
  const url = TARGET_SITE + encodeURIComponent(slug);
  const { html, source, error } = await fetchHtmlWithFallback(url, slug);
  const value = extractValueFromHtml(html);
  return { name, slug, url, value, source, error }; 
}

(async () => {
  const name = process.argv.slice(2).join(' ');
  if (!name) {
    console.error('Usage: node scripts/test-lookup.js "<item name>"');
    process.exit(1);
  }
  try {
    const result = await lookupItem(name);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Lookup failed:', e); // log full error for debugging
    process.exit(1);
  }
})();
