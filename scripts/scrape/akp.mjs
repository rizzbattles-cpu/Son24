// AKP press page scraper. Tier: primary_party. Lean: iktidar.
// Source: https://www.akparti.org.tr/haberler
// Article URLs are /haberler/{slug}-DD-MM-YYYY-HH-MM-SS/ — publish time is
// baked into the URL, which is convenient for freshness.

import * as cheerio from 'cheerio';
import { fetchHtml, fetchOgImageOrDead, ingest } from './lib/shared.mjs';
import { cleanTitle, isPolitical, guessCategoryFromTitle } from './lib/party-common.mjs';

const SOURCE_ID = 'akp-basin';
const SOURCE_NAME = 'AK Parti';
const BASE = 'https://www.akparti.org.tr';
const LISTING = `${BASE}/haberler`;

// Article URL pattern: /haberler/{slug}-DD-MM-YYYY-HH-MM-SS/
const ARTICLE_RE = /^\/haberler\/([a-z0-9\-]+)-(\d{2})-(\d{2})-(\d{4})-(\d{2})-(\d{2})-(\d{2})\/?$/i;

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const html = await fetchHtml(LISTING);
  const $ = cheerio.load(html);

  const seen = new Set();
  const items = [];

  $('a[href^="/haberler/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const m = href.match(ARTICLE_RE);
    if (!m) return;
    const [, slug, d, mo, y, hh, mm, ss] = m;
    if (seen.has(slug)) return;

    const title = cleanTitle($(a).text());
    if (!title || title.length < 20) return;
    if (!isPolitical(title)) return;
    seen.add(slug);

    // AK Parti times published in the URL — assume Türkiye time (UTC+3).
    const published = new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}+03:00`).toISOString();
    const category = guessCategoryFromTitle(title);
    const url = `${BASE}${href.startsWith('/') ? href : `/${href}`}`;

    items.push({
      external_id: slug,
      title: title.slice(0, 220),
      body: title.slice(0, 220),
      url,
      published_at: published,
      category,
      kicker: SOURCE_NAME,
      actor: SOURCE_NAME,
      actors: [SOURCE_NAME],
      entities: ['ak parti', 'akp'],
      keywords: ['iktidar', 'ak parti'],
      raw_payload: { title, url },
    });
  });

  console.log(`[${SOURCE_ID}] parsed ${items.length} items`);
  const latest = [];
  for (const it of items.slice(0, 20)) {
    if (latest.length >= 12) break;
    const { live, image } = await fetchOgImageOrDead(it.url);
    if (!live) { console.log(`  ✗ dead link: ${it.url}`); continue; }
    it.image_url = image; // photo straight from the source article
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
