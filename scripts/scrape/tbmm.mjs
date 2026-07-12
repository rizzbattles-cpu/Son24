// TBMM (Meclis Başkanı basın haberleri) scraper.
// Source: http://www.tbmm.gov.tr/meclis-haber/meclis-baskani
// Category: Siyaset. Tier: primary_gov, lean: devlet_kurumu.

import * as cheerio from 'cheerio';
import { fetchHtml, ingest } from './lib/shared.mjs';

const SOURCE_ID = 'tbmm';
const LIST_URL = 'http://www.tbmm.gov.tr/meclis-haber/meclis-baskani';

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);

  const items = [];
  const seen = new Set();
  $('a[href*="/Haber/Detay?Id="]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const idMatch = href.match(/Id=([a-f0-9-]+)/i);
    if (!idMatch) return;
    const external_id = idMatch[1];
    if (seen.has(external_id)) return;
    seen.add(external_id);

    const title = $(a).find('.arb').first().text().trim().replace(/\s+/g, ' ');
    const body = $(a).find('.ard').first().text().trim().replace(/\s+/g, ' ');
    const dateStr = $(a).find('.art').first().text().trim();

    if (!title) return;

    // 2026-07-05 - 20:57
    const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[^\d]+(\d{2}):(\d{2})/);
    const publishedAt = m
      ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])).toISOString()
      : new Date().toISOString();

    const image_url = $(a).find('.arh').attr('data-resim-yolu') || null;
    items.push({
      external_id,
      title,
      body,
      url: `https://www.tbmm.gov.tr${href.startsWith('/') ? href : `/${href}`}`,
      published_at: publishedAt,
      category: 'Siyaset',
      kicker: 'TBMM',
      actor: 'TBMM',
      actors: ['TBMM'],
      entities: ['tbmm', 'meclis'],
      keywords: ['meclis', 'basın'],
      image_url,
    });
  });

  console.log(`[${SOURCE_ID}] parsed ${items.length} items`);
  await ingest(SOURCE_ID, items.slice(0, 20));
  console.log(`[${SOURCE_ID}] done`);
}

run().catch((e) => {
  console.error(`[${SOURCE_ID}] failed:`, e);
  process.exit(1);
});
