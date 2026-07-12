// Dışişleri Bakanlığı (MFA) press releases.
// Source: https://www.mfa.gov.tr/basin-aciklamalari.tr.mfa
// Serving quirk: page defaults to EN content unless Accept-Language: tr is set.

import * as cheerio from 'cheerio';
import { fetchHtml, fetchOgImage, ingest, parseTrDate } from './lib/shared.mjs';

const SOURCE_ID = 'disisleri';
const LIST_URL = 'https://www.mfa.gov.tr/basin-aciklamalari.tr.mfa';

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(LIST_URL, { headers: { 'Accept-Language': 'tr-TR,tr;q=0.9' } });
  const $ = cheerio.load(html);

  const items = [];
  const seen = new Set();
  $('a.mfa-hotnews-link').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (!href.endsWith('.tr.mfa')) return;
    const external_id = href.replace(/^\/|\.tr\.mfa$/g, '');
    if (seen.has(external_id)) return;
    seen.add(external_id);
    const full = $(a).text().trim().replace(/\s+/g, ' ');
    if (!full) return;
    // Titles end with ", DD MonAdı YYYY, Yer" — split date from title
    const dateMatch = full.match(/(\d{1,2}(?:-\d{1,2})?\s+\w+\s+\d{4})/);
    const publishedAt = dateMatch ? parseTrDate(dateMatch[1])?.toISOString() : null;
    const title = full.replace(/, \d{1,2}(?:-\d{1,2})?\s+\w+\s+\d{4}.*$/, '').trim();
    items.push({
      external_id,
      title: title || full,
      body: full,
      url: `https://www.mfa.gov.tr${href}`,
      published_at: publishedAt ?? new Date().toISOString(),
      category: 'Dış Politika',
      kicker: 'Dışişleri Bakanlığı',
      actor: 'Dışişleri Bakanlığı',
      actors: ['Dışişleri Bakanlığı'],
      entities: ['dışişleri bakanlığı', 'türkiye'],
      keywords: ['diplomatik', 'basın açıklaması'],
    });
  });

  console.log(`[${SOURCE_ID}] parsed ${items.length} press releases`);
  const latest = items.slice(0, 20);
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
