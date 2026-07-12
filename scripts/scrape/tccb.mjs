// Cumhurbaşkanlığı press releases scraper.
// Source: https://www.tccb.gov.tr/haberler
// Category: Siyaset. Tier: primary_gov, lean: iktidar.

import * as cheerio from 'cheerio';
import { fetchHtml, fetchOgImage, ingest } from './lib/shared.mjs';

const SOURCE_ID = 'cumhurbaskanligi';
const LIST_URL = 'https://www.tccb.gov.tr/haberler';
const HREF_RE = /^\/basin-aciklamalari\/365\/(\d+)\/[^/]+$/;

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);

  const items = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const m = href.match(HREF_RE);
    if (!m) return;
    const id = m[1];
    const title = $(a).text().trim().replace(/\s+/g, ' ');
    if (!title || items.some((it) => it.external_id === id)) return;
    // Date usually sits in a sibling <span> just above the anchor.
    let dateText = $(a).prev('span').text().trim();
    if (!dateText) dateText = $(a).parent().find('span').first().text().trim();
    const [d, mo, y] = (dateText.match(/(\d{2})\.(\d{2})\.(\d{4})/) ?? []).slice(1);
    const publishedAt = d
      ? new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).toISOString()
      : new Date().toISOString();

    items.push({
      external_id: id,
      title,
      body: title, // no article body fetch in MVP — title alone is factual
      url: `https://www.tccb.gov.tr${href}`,
      published_at: publishedAt,
      category: 'Siyaset',
      kicker: 'Cumhurbaşkanlığı',
      actor: 'Cumhurbaşkanlığı',
      actors: ['Cumhurbaşkanlığı'],
      entities: ['cumhurbaşkanlığı', 'cumhurbaşkanı'],
      keywords: ['basın açıklaması'],
    });
  });

  console.log(`[${SOURCE_ID}] parsed ${items.length} press releases`);
  const latest = items.slice(0, 20);
  // Fetch og:image per item (each is a separate detail page)
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
