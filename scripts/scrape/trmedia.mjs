// Multi-outlet RSS scraper: BBC Türkçe, Independent Türkçe, Haber Global,
// CGTN Türk. Tier: agency. Türkiye+politics items only; bodies paraphrased
// (no verbatim republication). Each outlet's sources row is upserted here, so
// no SQL migration is needed to onboard one.

import { XMLParser } from 'fast-xml-parser';
import { fetchHtml, fetchOgImage, ingest, supabase, decodeEntities } from './lib/shared.mjs';
import { isRelevant, paraphraseBody } from './lib/filters.mjs';

const OUTLETS = [
  {
    id: 'bbc-turkce',
    name: 'BBC Türkçe',
    rss: 'https://feeds.bbci.co.uk/turkce/rss.xml',
    base: 'https://www.bbc.com/turkce',
    lean: 'yabanci',
  },
  {
    id: 'independent-tr',
    name: 'Independent Türkçe',
    rss: 'https://www.indyturk.com/rss.xml',
    base: 'https://www.indyturk.com',
    lean: 'yabanci',
  },
  {
    id: 'haber-global',
    name: 'Haber Global',
    rss: 'https://haberglobal.com.tr/rss',
    base: 'https://haberglobal.com.tr',
    lean: 'ajans',
  },
  {
    id: 'cgtn-turk',
    name: 'CGTN Türk',
    rss: 'https://www.cgtnturk.com/rss',
    base: 'https://www.cgtnturk.com',
    lean: 'yabanci',
  },
];

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function guessCategory(text) {
  const t = text.toLowerCase();
  if (/yapay zeka|chatgpt|openai|yazılım|siber|robot|uzay araştırma|nasa|spacex|akıllı telefon|teknoloji/.test(t)) return 'Teknoloji';
  if (/faiz|enflasyon|kur |bütçe|ekonomi|zamm|zam |imf|piyasa|borsa|asgari/.test(t)) return 'Ekonomi';
  if (/deprem|afad|\bsel\b|yangın|\bkaza|fırtına|heyelan|enkaz/.test(t)) return 'Afet';
  if (/operasyon|gözaltı|tutukla|terör|şehit|saldırı|polis|jandarma/.test(t)) return 'Güvenlik';
  if (/nato|ab |avrupa birliği|dışişleri|zirve|diplomasi|büyükelçi|rusya|ukrayna|israil|iran|abd |yunanistan|çin /.test(t)) return 'Dış Politika';
  return 'Siyaset';
}

// RSS <enclosure url> / <media:content url> / <media:thumbnail url> if present.
function rssImage(it) {
  const cands = [
    it.enclosure?.['@_url'],
    it['media:content']?.['@_url'],
    it['media:thumbnail']?.['@_url'],
    it.image,
  ];
  for (const c of cands) {
    const s = String(c ?? '').trim();
    if (s.startsWith('http')) return s;
  }
  return null;
}

async function ensureSource(outlet) {
  const { error } = await supabase.from('sources').upsert(
    {
      id: outlet.id,
      name: outlet.name,
      tier: 'agency',
      lean: outlet.lean,
      base_url: outlet.base,
      fetch_url: outlet.rss,
      fetch_kind: 'rss',
      notes: 'Only Türkiye+politics items are kept; body is paraphrased, no verbatim.',
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(`sources upsert (${outlet.id}): ${error.message}`);
}

async function runOutlet(outlet) {
  console.log(`[${outlet.id}] fetching…`);
  await ensureSource(outlet);

  const xml = await fetchHtml(outlet.rss);
  const obj = parser.parse(xml);
  const rawItems = obj?.rss?.channel?.item;
  const rss = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  console.log(`[${outlet.id}] RSS returned ${rss.length} items`);

  const items = [];
  for (const it of rss) {
    const title = decodeEntities(String(it.title ?? '')).trim();
    const desc = decodeEntities(String(it.description ?? '').replace(/<[^>]+>/g, ' ')).trim();
    if (!title) continue;
    if (!isRelevant(title, desc)) continue;
    const url = String(typeof it.link === 'object' ? it.link?.['#text'] ?? '' : it.link ?? '').trim();
    if (!url.startsWith('http')) continue;
    const publishedAt = it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString();
    const category = guessCategory(`${title} ${desc}`);
    // Prefer a stable numeric node/article id when the URL carries one
    // (Drupal /node/779908/... etc.); otherwise fall back to the last slug.
    const nodeId = url.match(/\/node\/(\d+)\b/)?.[1] ?? url.match(/[-/](\d{5,})(?:[/?#]|$)/)?.[1];
    const external_id =
      nodeId ?? String(it.guid?.['#text'] ?? it.guid ?? url).split(/[/?#]/).filter(Boolean).pop() ?? url;
    if (items.some((x) => x.external_id === external_id)) continue; // batch-level dedupe
    items.push({
      external_id,
      title: title.slice(0, 200),
      body: paraphraseBody(outlet.name, publishedAt, category),
      url,
      published_at: publishedAt,
      category,
      kicker: outlet.name,
      actor: outlet.name,
      actors: [outlet.name],
      entities: [],
      keywords: [],
      image_url: rssImage(it),
      raw_payload: { title, description: desc, url, published_at: publishedAt },
    });
  }

  console.log(`[${outlet.id}] passed filter: ${items.length}`);
  const latest = items.slice(0, 12);
  for (const it of latest) {
    if (!it.image_url) {
      it.image_url = await fetchOgImage(it.url);
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  console.log(`[${outlet.id}] images: ${latest.filter((i) => i.image_url).length}/${latest.length}`);
  await ingest(outlet.id, latest);
  console.log(`[${outlet.id}] done`);
}

async function run() {
  for (const outlet of OUTLETS) {
    try {
      await runOutlet(outlet);
    } catch (e) {
      console.error(`[${outlet.id}] failed:`, e.message);
    }
  }
}

run().catch((e) => {
  console.error('[trmedia] failed:', e);
  process.exit(1);
});
