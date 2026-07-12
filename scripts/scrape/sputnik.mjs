// Sputnik Türkiye (Anlatılanın Ötesi) scraper.
// Source: https://anlatilaninotesi.com.tr  (HTML homepage → article listing)
// Tier: agency. Political/Türkiye-related only. No verbatim.

import * as cheerio from 'cheerio';
import { fetchHtml, fetchOgImage, ingest } from './lib/shared.mjs';
import { isRelevant, paraphraseBody } from './lib/filters.mjs';
import { tidyTitle } from './lib/party-common.mjs';

const SOURCE_ID = 'sputnik-tr';
const SOURCE_NAME = 'Sputnik Türkiye';
const HOME = 'https://anlatilaninotesi.com.tr';

function guessCategory(text) {
  const t = text.toLowerCase();
  if (/faiz|enflasyon|kur|bütçe|ekonomi|zamm|piyasa/.test(t)) return 'Ekonomi';
  if (/deprem|afad|sel|yangın|kaza|patlama/.test(t)) return 'Afet';
  if (/nato|ab |avrupa birliği|dışişleri|zirve|diplomasi|görüşme|ziyaret|rusya|ukrayna|abd|isr[aâ]il|iran/.test(t)) return 'Dış Politika';
  if (/operasyon|saldırı|güvenlik|terör|pkk/.test(t)) return 'Güvenlik';
  return 'Siyaset';
}

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(HOME);
  const $ = cheerio.load(html);

  const seen = new Set();
  const items = [];

  $('a[href*="/2026"], a[href*="/2027"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    // Match /YYYYMMDD/slug-ID.html
    if (!/^\/\d{8}\//.test(href)) return;
    const idMatch = href.match(/(\d{7,})\.html$/);
    if (!idMatch) return;
    const external_id = idMatch[1];
    if (seen.has(external_id)) return;

    const linkText = $(a).text().trim().replace(/\s+/g, ' ');
    // Sometimes anchor text is empty (image link); check nearby heading
    const rawTitle = linkText || $(a).find('h1,h2,h3,h4').text().trim() || $(a).attr('title') || '';
    const title = tidyTitle(rawTitle); // strips "1NATO…" style junk + fixes quotes
    if (!title || title.length < 15) return;
    if (!isRelevant(title)) return;

    seen.add(external_id);
    const url = `${HOME}${href}`;
    // Date from URL prefix /YYYYMMDD/
    const dateMatch = href.match(/^\/(\d{4})(\d{2})(\d{2})\//);
    const publishedAt = dateMatch
      ? new Date(Date.UTC(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3])).toISOString()
      : new Date().toISOString();

    const category = guessCategory(title);
    items.push({
      external_id,
      // Short factual article title with source attribution is fair use for
      // news reporting; we still paraphrase the body.
      title: title.slice(0, 200),
      body: paraphraseBody(SOURCE_NAME, publishedAt, category),
      url,
      published_at: publishedAt,
      category,
      kicker: SOURCE_NAME,
      actor: SOURCE_NAME,
      actors: [SOURCE_NAME],
      entities: [],
      keywords: [],
      raw_payload: { title, url, published_at: publishedAt },
    });
  });

  console.log(`[${SOURCE_ID}] passed filter: ${items.length}`);
  const latest = items.slice(0, 12);
  for (const it of latest) {
    it.image_url = await fetchOgImage(it.url);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`[${SOURCE_ID}] images fetched: ${latest.filter((i) => i.image_url).length}`);
  await ingest(SOURCE_ID, latest);
  console.log(`[${SOURCE_ID}] done`);
}

run().catch((e) => {
  console.error(`[${SOURCE_ID}] failed:`, e);
  process.exit(1);
});
