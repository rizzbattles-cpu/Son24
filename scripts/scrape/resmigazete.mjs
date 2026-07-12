// Resmî Gazete scraper — official gazette (laws, decrees, appointments).
// Source: https://www.resmigazete.gov.tr (homepage = latest issue index)
// Tier: primary_gov. We keep only high-signal entries (laws, presidential
// decrees, international agreements, major appointments) and drop the routine
// noise (university regulations, tenders, classified ads, daily FX rates).

import * as cheerio from 'cheerio';
import { fetchHtml, ingest } from './lib/shared.mjs';

const SOURCE_ID = 'resmi-gazete';
const HOME = 'https://www.resmigazete.gov.tr';

// Entry must contain one of these to be considered newsworthy.
const INCLUDE = [
  'kanun', 'cumhurbaşkanı kararı', 'cumhurbaşkanlığı kararname', 'kararname',
  'milletlerarası', 'anlaşma', 'atama kararı', 'atama kararları', 'genelge',
  'olağanüstü hal', 'af ', 'seçim',
];
// …unless it also matches one of these (routine / niche).
const EXCLUDE = [
  'üniversite', 'ihale', 'ilân', 'ilan', 'artırma', 'eksiltme', 'çeşitli',
  'döviz kur', 'devlet iç borçlanma',
];

function categoryFor(title) {
  const t = title.toLowerCase();
  if (/tebliğ|vergi|gümrük|döviz|faiz|borçlanma|ekonomi|banka/.test(t)) return 'Ekonomi';
  if (/milletlerarası|anlaşma|uluslararası|büyükelçi/.test(t)) return 'Dış Politika';
  return 'Siyaset';
}

function isNewsworthy(title) {
  const t = title.toLowerCase();
  if (EXCLUDE.some((k) => t.includes(k))) return false;
  return INCLUDE.some((k) => t.includes(k));
}

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(HOME);
  const $ = cheerio.load(html);

  const items = [];
  const seen = new Set();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const m = href.match(/(\d{4})(\d{2})(\d{2})-(\d+)\.htm$/);
    if (!m) return;
    const [, y, mo, d, n] = m;
    const external_id = `${y}${mo}${d}-${n}`;
    if (seen.has(external_id)) return;

    const title = $(a).text().trim().replace(/^[–\-\s]+/, '').replace(/\s+/g, ' ');
    if (!title || title.length < 12) return;
    seen.add(external_id);

    const url = `${HOME}/eskiler/${y}/${mo}/${external_id}.htm`;
    const publishedAt = new Date(Date.UTC(+y, +mo - 1, +d, 6, 0, 0)).toISOString();
    // Important entries (laws, decrees, appointments) get a real topic category
    // so they flow into the main "Son 24" feed. Everything else is tagged
    // 'Resmî Gazete' → only shows in the dedicated Resmî Gazete tab.
    const category = isNewsworthy(title) ? categoryFor(title) : 'Resmî Gazete';

    items.push({
      external_id,
      title,
      body: `Resmî Gazete'de yayımlandı: ${title}`,
      url,
      published_at: publishedAt,
      category,
      kicker: 'Resmî Gazete',
      actor: 'Resmî Gazete',
      actors: ['Resmî Gazete'],
      entities: ['resmî gazete'],
      keywords: ['resmi gazete', 'mevzuat'],
    });
  });

  console.log(`[${SOURCE_ID}] entries: ${items.length}`);
  await ingest(SOURCE_ID, items.slice(0, 30));
  console.log(`[${SOURCE_ID}] done`);
}

run().catch((e) => {
  console.error(`[${SOURCE_ID}] failed:`, e);
  process.exit(1);
});
