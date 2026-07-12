// Euronews Türkçe scraper.
// Source: https://tr.euronews.com/rss  (RSS feed)
// Tier: agency. Political/Türkiye-related items only. No verbatim.

import { XMLParser } from 'fast-xml-parser';
import { fetchHtml, fetchOgImage, ingest } from './lib/shared.mjs';
import { isRelevant, paraphraseBody } from './lib/filters.mjs';

const SOURCE_ID = 'euronews-tr';
const SOURCE_NAME = 'Euronews Türkçe';
const RSS_URL = 'https://tr.euronews.com/rss';

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

function guessCategory(text) {
  const t = text.toLowerCase();
  if (/faiz|enflasyon|kur|bütçe|ekonomi|zamm|imf|piyasa/.test(t)) return 'Ekonomi';
  if (/deprem|afad|sel|yangın|kaza/.test(t)) return 'Afet';
  if (/nato|ab |avrupa birliği|dışişleri|zirve|diplomasi|görüşme|ziyaret/.test(t)) return 'Dış Politika';
  return 'Siyaset';
}

async function run() {
  console.log(`[${SOURCE_ID}] fetching…`);
  const xml = await fetchHtml(RSS_URL);
  const obj = parser.parse(xml);
  const rawItems = obj?.rss?.channel?.item;
  const rss = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  console.log(`[${SOURCE_ID}] RSS returned ${rss.length} items`);

  const items = [];
  for (const it of rss) {
    const title = String(it.title ?? '').trim();
    const desc = String(it.description ?? '').replace(/<[^>]+>/g, ' ').trim();
    if (!title) continue;
    if (!isRelevant(title, desc)) continue;
    const url = String(it.link ?? '').trim();
    if (!url) continue;
    const publishedAt = it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString();
    const category = guessCategory(`${title} ${desc}`);
    const external_id = String(it.guid ?? url).split(/[/?]/).pop() ?? url;
    const image_url = String(it.image ?? '').trim() || null;
    items.push({
      external_id,
      // Short factual article title + source attribution is fair use for news
      // reporting; body stays paraphrased.
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
      image_url,
      raw_payload: { title, description: desc, url, published_at: publishedAt },
    });
  }

  console.log(`[${SOURCE_ID}] passed filter: ${items.length}`);
  const latest = items.slice(0, 15);
  // RSS often lacks per-item <image>; fetch og:image from the article page.
  for (const it of latest) {
    if (!it.image_url) {
      it.image_url = await fetchOgImage(it.url);
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  console.log(`[${SOURCE_ID}] images: ${latest.filter((i) => i.image_url).length}/${latest.length}`);
  await ingest(SOURCE_ID, latest);
  console.log(`[${SOURCE_ID}] done`);
}

run().catch((e) => {
  console.error(`[${SOURCE_ID}] failed:`, e);
  process.exit(1);
});
