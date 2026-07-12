// Zafer Partisi press page scraper. Tier: primary_party. Lean: muhalefet.
// Source: https://www.zaferpartisi.org.tr/haberler
// The article title is not in a heading — it's stored on the card image's alt attribute.

import * as cheerio from 'cheerio';
import { fetchHtml, fetchOgImageOrDead, ingest } from './lib/shared.mjs';
import { tidyTitle, slugFromUrl, isPolitical, guessCategoryFromTitle } from './lib/party-common.mjs';

const SOURCE_ID = 'zafer-basin';
const SOURCE_NAME = 'Zafer Partisi';
const BASE = 'https://www.zaferpartisi.org.tr';
const LISTING = `${BASE}/haberler`;

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(LISTING);
  const $ = cheerio.load(html);

  const seen = new Set();
  const items = [];

  $('.haber').each((_, el) => {
    const $el = $(el);
    const a = $el.find('a').first();
    const href = a.attr('href');
    if (!href) return;
    const normalized = tidyTitle($el.find('img').first().attr('alt') || '');
    if (!normalized || normalized.length < 15) return;
    if (!isPolitical(normalized)) return;
    // Zafer article URLs live under /Haberler/{slug}
    const slugPath = href.replace(/^\//, '');
    const url = href.startsWith('http')
      ? href
      : `${BASE}/Haberler/${slugPath.replace(/^Haberler\//i, '')}`;
    const slug = slugFromUrl(url);
    if (seen.has(slug)) return;
    seen.add(slug);

    const category = guessCategoryFromTitle(normalized);
    items.push({
      external_id: slug,
      title: normalized.slice(0, 220),
      body: normalized.slice(0, 220),
      url,
      published_at: new Date().toISOString(),
      category,
      kicker: SOURCE_NAME,
      actor: SOURCE_NAME,
      actors: [SOURCE_NAME],
      entities: ['zafer partisi'],
      keywords: ['muhalefet', 'zafer partisi'],
      raw_payload: { title: normalized, url },
    });
  });

  console.log(`[${SOURCE_ID}] parsed ${items.length} items`);
  // Drop dead links — if the article URL doesn't resolve, we don't show it.
  const latest = [];
  for (const it of items.slice(0, 20)) {
    if (latest.length >= 12) break;
    const { live, image } = await fetchOgImageOrDead(it.url);
    if (!live) { console.log(`  ✗ dead link, skipping: ${it.url}`); continue; }
    it.image_url = image;
    latest.push(it);
  }
  console.log(`[${SOURCE_ID}] live items: ${latest.length}, with photo: ${latest.filter((i) => i.image_url).length}`);
  await ingest(SOURCE_ID, latest);
  console.log(`[${SOURCE_ID}] done`);
}

run().catch((e) => {
  console.error(`[${SOURCE_ID}] failed:`, e);
  process.exit(1);
});
