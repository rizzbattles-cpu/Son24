// İYİ Parti press page scraper. Tier: primary_party. Lean: muhalefet.
// Source: https://iyiparti.org.tr/ (WordPress site, article links are
// https://iyiparti.org.tr/{slug}/ with the headline as anchor text).

import * as cheerio from 'cheerio';
import { fetchHtml, fetchOgImageOrDead, ingest } from './lib/shared.mjs';
import { tidyTitle, slugFromUrl, isPolitical, guessCategoryFromTitle } from './lib/party-common.mjs';

const SOURCE_ID = 'iyi-parti-basin';
const SOURCE_NAME = 'İYİ Parti';
const BASE = 'https://iyiparti.org.tr';

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(BASE);
  const $ = cheerio.load(html);

  const seen = new Set();
  const items = [];

  $('a[href^="https://www.iyiparti.org.tr/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    // Article slugs look like /{some-turkish-slug}/ — skip category/archive
    // and any wp-json/embed helpers.
    if (!/^https:\/\/www\.iyiparti\.org\.tr\/[a-z0-9\-]{20,}\/?$/i.test(href)) return;
    if (/\/(haberler|kategori|category|tag|wp-)/.test(href)) return;
    const slug = slugFromUrl(href);
    if (seen.has(slug)) return;

    const title = tidyTitle($(a).text());
    if (!title || title.length < 20) return;
    if (!isPolitical(title)) return;
    seen.add(slug);

    const category = guessCategoryFromTitle(title);
    items.push({
      external_id: slug,
      title: title.slice(0, 220),
      body: title.slice(0, 220), // party statements are already primary; the title IS the point
      url: href,
      published_at: new Date().toISOString(), // no date on listing page
      category,
      kicker: SOURCE_NAME,
      actor: SOURCE_NAME,
      actors: [SOURCE_NAME],
      entities: ['iyi parti'],
      keywords: ['muhalefet', 'iyi parti'],
      raw_payload: { title, url: href },
    });
  });

  console.log(`[${SOURCE_ID}] parsed ${items.length} items`);
  const latest = [];
  for (const it of items.slice(0, 20)) {
    if (latest.length >= 12) break;
    const { live, image } = await fetchOgImageOrDead(it.url);
    if (!live) { console.log(`  ✗ dead link: ${it.url}`); continue; }
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
