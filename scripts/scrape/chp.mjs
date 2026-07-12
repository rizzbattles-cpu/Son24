// CHP press page scraper. Tier: primary_party. Lean: muhalefet.
// Source: https://www.chp.org.tr (homepage lists /haberler/{slug} articles;
// some anchor texts start with DD.MM.YYYY which we peel off).

import * as cheerio from 'cheerio';
import { fetchHtml, fetchOgImageOrDead, ingest } from './lib/shared.mjs';
import { tidyTitle, slugFromUrl, isPolitical, guessCategoryFromTitle } from './lib/party-common.mjs';

const SOURCE_ID = 'chp-basin';
const SOURCE_NAME = 'CHP';
const BASE = 'https://www.chp.org.tr';

const DATE_PREFIX = /^(\d{2})\.(\d{2})\.(\d{4})\s+/;

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(BASE);
  const $ = cheerio.load(html);

  const seen = new Set();
  const items = [];

  $('a[href^="/haberler/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (!/^\/haberler\/[a-z0-9\-]+/.test(href)) return;
    const slug = slugFromUrl(href);
    if (seen.has(slug)) return;

    let text = tidyTitle($(a).text());
    if (!text || text.length < 20) return;

    // Some anchors are prefixed with "09.07.2026 ...". Peel that off and use
    // as the publish date; otherwise assume now.
    let published = new Date().toISOString();
    const m = text.match(DATE_PREFIX);
    if (m) {
      const [, d, mo, y] = m;
      published = new Date(`${y}-${mo}-${d}T09:00:00+03:00`).toISOString();
      text = text.replace(DATE_PREFIX, '').trim();
    }
    if (!isPolitical(text)) return;
    seen.add(slug);

    const category = guessCategoryFromTitle(text);
    const url = `${BASE}${href.startsWith('/') ? href : `/${href}`}`;

    items.push({
      external_id: slug,
      title: text.slice(0, 220),
      body: text.slice(0, 220),
      url,
      published_at: published,
      category,
      kicker: SOURCE_NAME,
      actor: SOURCE_NAME,
      actors: [SOURCE_NAME],
      entities: ['chp'],
      keywords: ['muhalefet', 'chp'],
      raw_payload: { title: text, url },
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
