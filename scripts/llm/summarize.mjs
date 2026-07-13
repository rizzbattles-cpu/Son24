// LLM summarizer — Google Gemini.
//
// Reads unprocessed events (llm_processed_at IS NULL) from Supabase and, for
// each, asks Gemini to produce:
//   • an original 6-10 word headline (paraphrased, not the source's title)
//   • a 2-3 sentence factual summary in Turkish
//   • a short "how we got here" narrative (2-4 sentence lookback)
//   • 3-5 DATED timeline steps ({relative, headline, detail}) — real events,
//     not template sentences ("18 Haz: Meclis komisyonda kabul edildi" style)
//   • one verbatim short quote per source (source_quotes) for the Kaynaklar tab
//
// Background linking: before prompting, we look up OLDER events on the same
// storyline via embedding-centroid cosine similarity and feed their real dates
// + titles + summaries to the LLM as "GEÇMİŞ İLGİLİ GELİŞMELER", so the story
// timeline is anchored to real history instead of invented approximations.
// Matched ids are stored on events.related_event_ids.
//
// The article bodies we scrape are the ONLY source of truth for the new event;
// the background block is the only extra context. No hallucinated dates.

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import * as cheerio from 'cheerio';
import { fetchHtml } from '../scrape/lib/shared.mjs';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
// Free-tier quotas are PER MODEL, so we rotate through several: when one
// model's daily quota runs out (429), the next takes over — multiplying the
// free daily capacity at zero cost. Order: cheapest/fastest first.
const MODELS = (process.env.GEMINI_MODELS ??
  'gemini-2.5-flash-lite,gemini-2.0-flash-lite,gemini-2.0-flash,gemini-2.5-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const THROTTLE_MS = Number(process.env.GEMINI_THROTTLE_MS ?? 5000); // ~12 RPM cap
const MAX_RETRIES = 3; // per model; on persistent 429 we fall through to the next model

// Background-link tuning: lower than the merge threshold (0.9) because we want
// "same storyline, earlier chapter", not "same story duplicated".
const RELATED_THRESHOLD = Number(process.env.RELATED_THRESHOLD ?? 0.55);
const RELATED_WINDOW_DAYS = Number(process.env.RELATED_WINDOW_DAYS ?? 45);
const RELATED_MAX = 3;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase env');
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error('Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TR_M_ABBR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function fmtTrDate(d) {
  const dt = new Date(d);
  return `${dt.getDate()} ${TR_M_ABBR[dt.getMonth()]} ${dt.getFullYear()}`;
}

const PROMPT_TEMPLATE = `Sen, Türkiye gündemini takip edemeyen sıradan bir vatandaşa günü anlatan tarafsız bir editörsün. Amacın: kişi bu kartı okuyunca hem ne olduğunu hem de bunun KENDİ HAYATINA ne anlama geldiğini anlasın.

BUGÜNÜN TARİHİ: {today}

KURALLAR:
- Kendi cümlelerinle yaz. Kaynağın cümlelerini KOPYALAMA (tek istisna: source_quotes alanı, orada birebir alıntı istenir).
- Sadece Türkçe. Tarafsız kal, taraf tutma, abartma.
- Sade, günlük dil kullan. Teknik terimleri açıkla.
- YASAK: "X açıklama yaptı", "bir açıklamada bulundu", "değerlendirmede bulundu", "konuştu" gibi İÇİ BOŞ cümleler. Ne dediğini/ne olduğunu SOMUT anlat. Okuyucu kaynağa gitmeden olayı anlamalı: kim, ne dedi, neden, karşı taraf ne söyledi.
- Makale metnini oku; olayın ÖZÜNÜ ver. Sadece başlıktan özet çıkarma.
- "summary" KISA ve HAP BİLGİ olsun: en fazla 3 kısa cümle, toplam 45 kelimeyi geçmesin. 1) ne oldu, 2) neden önemli / sıradan insanı nasıl etkiler. Uzun paragraf YAZMA. Net, yalın, dolgu cümle yok.
- Birden fazla kaynak varsa (İKTİDAR, MUHALEFET, DEVLET KURUMU, AJANS): her tarafın söylediğini kısaca özetlemeye çalış. Kimin ne dediğini "iktidar tarafı ... derken muhalefet ..." gibi yalın olarak belirt. Tek taraflı yazma.

HİKAYE (story) — çok önemli:
- Bu olayın ARKA PLANINI ve nasıl bu noktaya geldiğini anlat. Aşağıdaki "GEÇMİŞ İLGİLİ GELİŞMELER" bölümü varsa oradaki GERÇEK tarihli olayları kullan; yoksa makaledeki bilgilerle ve konu hakkındaki genel bilginle kur.
- EN AZ 3, mümkünse 4 adım: en eski gelişmeden bugüne doğru kronolojik.
- HER ADIMDA "relative" alanına TARİH yaz: kesin biliyorsan kısa tarih ("18 Haz", "3 Tem 2026"), kesin bilmiyorsan dürüst yaklaşık ifade ("Mart başı", "Geçen hafta"). ASLA tarih uydurma.
- HER ADIMDA "detail" GERÇEK ve SOMUT bir gelişme anlatmalı: kim ne yaptı ("Meclis komisyonda kabul etti", "Bakanlık soruşturma başlattı"). Şablon/dolgu cümle ("süreç devam etti", "gündeme geldi", "ilk kayıt") YASAK.
- Son adım BUGÜNKÜ olay olmalı.
- how_we_got_here: 2-3 dolu cümle; olayın kökenini ve bugüne nasıl geldiğini açıkla.

ALINTILAR (source_quotes) — yeni:
- HER kaynak için, o kaynağın metninden BİREBİR (kelimesi kelimesine) kısa ve çarpıcı BİR cümle seç: kaynağın kendi ağzından en önemli iddiası/sözü. En fazla 140 karakter.
- Alıntı metinde GERÇEKTEN geçmeli — asla kendi cümleni alıntı diye yazma. Uygun cümle yoksa boş string "" ver.

GİRDİ:
Kaynak: {source_name}
Kategori: {category}
Yayın tarihi: {published_at}
Orijinal başlık: {original_title}
Makale metinleri (numaralı):
{article_body}
{background_block}
UZUNLUK KURALLARI (ÖNEMLİ, kesinlikle uy):
- title: 5-9 kelime, en fazla 60 karakter
- summary: 2-4 cümle, toplam 40-70 kelime
- current_status: 1-2 TAM cümle, en fazla 140 karakter
- story[].relative: kısa tarih veya dürüst yaklaşık ifade, en fazla 14 karakter
- story[].headline: 2-5 kelime, en fazla 32 karakter
- story[].detail: 1-2 TAM cümle, en fazla 160 karakter — olayı somut anlat, asla yarım cümle bırakma
- Her alan mutlaka nokta/ünlem/soru ile bitmeli, cümlenin ortasında bitmesin

CEVAP: SADECE aşağıdaki JSON formatını ver, başka açıklama yazma.
{
  "title": "5-9 kelimelik manşet",
  "summary": "2-3 kısa cümle: ne oldu ve neden önemli",
  "current_status": "Tek cümlelik güncel durum",
  "how_we_got_here": "2-3 cümlede olayın nasıl bu noktaya geldiği; bilinmiyorsa 'öncesine dair kayıt yok'",
  "story": [
    {"relative": "18 Haz", "headline": "2-4 kelime", "detail": "Somut gelişme, tek tam cümle."},
    {"relative": "Geçen hafta", "headline": "2-4 kelime", "detail": "Somut gelişme, tek tam cümle."},
    {"relative": "Bugün", "headline": "2-4 kelime", "detail": "Bugünkü olay, tek tam cümle."}
  ],
  "source_quotes": [
    {"kaynak": 1, "alinti": "kaynağın metninden birebir kısa cümle"},
    {"kaynak": 2, "alinti": ""}
  ],
  "actors": ["taraf 1", "taraf 2"]
}`;

function extractJson(text) {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  const raw = text.slice(first, last + 1);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Models whose daily quota ran out during this run — skipped until next run.
const exhaustedModels = new Set();

async function callGemini(prompt) {
  for (const model of MODELS) {
    if (exhaustedModels.has(model)) continue;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    // 2.5-series are "thinking" models: without a budget cap their reasoning
    // eats maxOutputTokens and the JSON gets truncated mid-string. Disable
    // thinking for them (2.0 models reject the field, so add conditionally).
    const generationConfig = { temperature: 0.3, maxOutputTokens: 3000 };
    if (model.startsWith('gemini-2.5')) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
      });

      if (res.status === 429) {
        // Rate/quota hit. Brief backoff in case it's just RPM; if it keeps
        // 429ing, assume the daily quota is gone and rotate to the next model.
        if (attempt < MAX_RETRIES - 1) {
          const wait = 6000 * (attempt + 1);
          console.log(`  ⏳ ${model} 429, backing off ${wait / 1000}s`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        console.log(`  ↪ ${model} kotası doldu — sıradaki modele geçiliyor`);
        exhaustedModels.add(model);
        break; // next model
      }
      if (res.status === 503) {
        const wait = 8000 * (attempt + 1);
        console.log(`  ⏳ ${model} 503, backing off ${wait / 1000}s`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (res.status === 404) {
        // Model id not available for this key/region — skip it permanently.
        console.warn(`  ↪ ${model} bulunamadı (404) — listeden çıkarılıyor`);
        exhaustedModels.add(model);
        break;
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Gemini(${model}) ${res.status}: ${t.slice(0, 160)}`);
      }

      const j = await res.json();
      const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Gemini(${model}) empty response`);
      const parsed = extractJson(text);
      if (!parsed) throw new Error(`could not parse JSON (${model}): ${text.slice(0, 160)}`);
      parsed.__model = model;
      return parsed;
    }
  }
  throw new Error(`tüm Gemini modellerinin kotası dolu (${MODELS.join(', ')})`);
}

async function extractArticleText(url) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    $('script, style, nav, header, footer, aside, .ads, .related').remove();
    const scoped = $('article, .article-body, .content-body, main').first();
    const root = scoped.length > 0 ? scoped : $('body');
    const paragraphs = root.find('p').slice(0, 15).map((_, p) => $(p).text().trim()).get();
    const text = paragraphs.filter((t) => t.length > 40).join(' ').slice(0, 3500);
    return text;
  } catch (e) {
    console.warn(`  [extract] failed for ${url}: ${e.message}`);
    return '';
  }
}

async function loadPending(limit = 30) {
  const { data: events, error } = await supabase
    .from('events')
    .select(
      'id, title, summary, category, kicker, first_seen_at, last_updated_at, event_sources(raw_items(id, title, body, url, raw_payload, sources(id, name, tier, lean)))'
    )
    .is('llm_processed_at', null)
    // Routine Resmî Gazete entries don't need an LLM summary — save quota.
    .neq('category', 'Resmî Gazete')
    .order('last_updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return events ?? [];
}

// ------------------------------------------------------------------
// Background pool: every event of the last RELATED_WINDOW_DAYS with its
// embedding centroid, so each pending event can be matched against real,
// dated history. Loaded once per run.
// ------------------------------------------------------------------
function parseVec(s) {
  if (!s || typeof s !== 'string') return null;
  const arr = s.trim().replace(/^\[/, '').replace(/\]$/, '').split(',').map(Number);
  return arr.some(Number.isNaN) ? null : arr;
}
function centroid(vecs) {
  const n = vecs[0].length;
  const out = new Array(n).fill(0);
  for (const v of vecs) for (let i = 0; i < n; i++) out[i] += v[i];
  for (let i = 0; i < n; i++) out[i] /= vecs.length;
  return out;
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Country / bloc / leader entities for hybrid background matching. When a new
// event mentions e.g. Yunanistan, past events mentioning Yunanistan are strong
// background candidates even if the embedding distance alone wouldn't qualify
// (different wording, different category — Siyaset vs Dış Politika).
const BG_ENTITIES = [
  'abd', 'amerika', 'washington', 'rusya', 'moskova', 'ukrayna', 'israil', 'iran',
  'yunanistan', 'atina', 'almanya', 'fransa', 'ingiltere', 'çin', 'azerbaycan',
  'ermenistan', 'suriye', 'irak', 'kıbrıs', 'kktc', 'ege', 'akdeniz', 'nato',
  'avrupa birliği', 'birleşmiş milletler', ' bm ', 'imf', 'katar', 'suudi',
  'mısır', 'libya', 'gürcistan', 'bulgaristan', 'pakistan', 'hindistan',
  'japonya', 'güney kore', 'kuzey kore', 'filistin', 'gazze', 'lübnan', 'yemen',
  'somali', 'balkan', 'trump', 'putin', 'zelenski', 'netanyahu', 'macron',
  'savunma sanayi', 'baykar', 'aselsan', 'roketsan', 'f-16', 'f-35', 'kaan',
];
function extractEntities(text) {
  const t = ` ${String(text).toLocaleLowerCase('tr-TR')} `;
  return new Set(BG_ENTITIES.filter((e) => t.includes(e)));
}

async function loadBackgroundPool() {
  const cutoff = new Date(Date.now() - RELATED_WINDOW_DAYS * 86400 * 1000).toISOString();
  const { data, error } = await supabase
    .from('event_sources')
    .select(
      'event_id, raw_items!inner(embedding), events!inner(id, title, summary, category, first_seen_at)'
    )
    .gte('events.first_seen_at', cutoff)
    .not('raw_items.embedding', 'is', null)
    .limit(2000);
  if (error) {
    console.warn(`[llm] background pool unavailable: ${error.message}`);
    return new Map();
  }
  const byEvent = new Map();
  for (const r of data ?? []) {
    const vec = parseVec(r.raw_items.embedding);
    if (!vec) continue;
    const cur = byEvent.get(r.event_id);
    if (cur) cur.vectors.push(vec);
    else
      byEvent.set(r.event_id, {
        id: r.event_id,
        title: r.events.title,
        summary: r.events.summary ?? '',
        category: r.events.category,
        firstSeen: new Date(r.events.first_seen_at),
        vectors: [vec],
      });
  }
  for (const e of byEvent.values()) {
    e.centroid = centroid(e.vectors);
    e.entities = extractEntities(`${e.title} ${e.summary}`);
  }
  console.log(`[llm] background pool: ${byEvent.size} events (${RELATED_WINDOW_DAYS}d window)`);
  return byEvent;
}

/**
 * Find up to RELATED_MAX older events on the same storyline. Hybrid match:
 *   (a) embedding cosine ≥ RELATED_THRESHOLD within the SAME category, OR
 *   (b) a shared country/actor entity + a looser cosine (≥ 0.38), ANY category
 *       — "Yunanistan bugün konuştu" pairs with last week's Yunanistan event
 *       even if it was filed under a different category or worded differently.
 * Ranked by cosine + entity bonus. "Older" = first seen 24h+ before.
 */
function findRelated(pool, evt, evtText = '') {
  const self = pool.get(evt.id);
  if (!self?.centroid) return [];
  const evtSeen = new Date(evt.first_seen_at ?? Date.now());
  const evtEntities = new Set([
    ...(self.entities ?? []),
    ...extractEntities(evtText),
  ]);

  const scored = [];
  for (const cand of pool.values()) {
    if (cand.id === evt.id) continue;
    if (evtSeen - cand.firstSeen < 24 * 3600 * 1000) continue; // must be genuinely older
    const sim = cosine(self.centroid, cand.centroid);
    const shared = [...(cand.entities ?? [])].filter((x) => evtEntities.has(x)).length;

    const sameCatPass = cand.category === evt.category && sim >= RELATED_THRESHOLD;
    const entityPass = shared >= 1 && sim >= 0.38;
    if (!sameCatPass && !entityPass) continue;

    scored.push({ cand, score: sim + Math.min(shared, 2) * 0.12, shared });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, RELATED_MAX).map(({ cand, score, shared }) => ({ ...cand, sim: score, shared }));
}

const LEAN_LABEL = {
  iktidar: 'İKTİDAR',
  muhalefet: 'MUHALEFET',
  devlet_kurumu: 'DEVLET KURUMU',
  ajans: 'AJANS',
  yabanci: 'YABANCI',
};

async function processOne(evt, pool) {
  const links = evt.event_sources ?? [];
  if (links.length === 0) return { skipped: true, reason: 'no sources' };

  // Fetch the FULL article text for every source so the LLM reads what
  // actually happened — not just a one-line title.
  const perSource = [];
  for (const link of links) {
    const raw = link?.raw_items;
    if (!raw) continue;
    let body = raw.raw_payload?.description ?? raw.body ?? raw.title ?? '';
    if (raw.url) {
      try {
        const fetched = await extractArticleText(raw.url);
        if (fetched.length > 180) body = fetched;
      } catch {
        // ignore, use fallback body
      }
    }
    perSource.push({
      rawItemId: raw.id,
      name: raw.sources.name,
      lean: raw.sources.lean,
      tier: raw.sources.tier,
      title: raw.raw_payload?.title ?? raw.title,
      body: body.slice(0, 1600),
    });
  }
  if (perSource.length === 0) return { skipped: true, reason: 'no fetchable sources' };

  // One block per source — numbered so source_quotes can reference [n].
  const sourcesBlock = perSource
    .map(
      (s, i) =>
        `[${i + 1}] ${s.name} (${LEAN_LABEL[s.lean] ?? s.lean?.toUpperCase() ?? ''})\n` +
        `    Başlık: ${s.title}\n    Metin: ${s.body}`
    )
    .join('\n\n');

  // Real, dated history from the embedding pool → anchors story steps.
  // Entity text includes source titles + first slice of the article bodies so
  // country/actor names buried in the text still trigger a background match.
  const entityText =
    `${evt.title} ` +
    perSource.map((s) => `${s.title} ${s.body.slice(0, 400)}`).join(' ');
  const related = findRelated(pool, evt, entityText);
  const backgroundBlock =
    related.length > 0
      ? `\nGEÇMİŞ İLGİLİ GELİŞMELER (aynı konunun önceki bölümleri — hikaye adımlarında ve how_we_got_here'da bu GERÇEK tarihleri kullan):\n` +
        related
          .map((r) => `- ${fmtTrDate(r.firstSeen)}: ${r.title} — ${String(r.summary).slice(0, 140)}`)
          .join('\n') +
        '\n'
      : '\n';

  const prompt = PROMPT_TEMPLATE
    .replace('{today}', fmtTrDate(new Date()))
    .replace('{source_name}', perSource.map((s) => s.name).join(' + '))
    .replace('{category}', evt.category)
    .replace('{published_at}', evt.last_updated_at)
    .replace('{original_title}', (perSource[0].title ?? evt.title).slice(0, 300))
    .replace('{article_body}', sourcesBlock.slice(0, 6000))
    .replace('{background_block}', backgroundBlock);

  const out = await callGemini(prompt);

  const storySteps = Array.isArray(out.story) ? out.story.slice(0, 5) : [];

  // Map "kaynak: N" quotes back to raw_item ids: { "<raw_item_id>": "..." }.
  // Only keep quotes that genuinely appear in that source's text (verbatim
  // guard — tolerant of surrounding whitespace/quotes).
  const sourceQuotes = {};
  if (Array.isArray(out.source_quotes)) {
    for (const q of out.source_quotes) {
      const idx = Number(q?.kaynak) - 1;
      const quote = String(q?.alinti ?? '').trim().replace(/^["“”']+|["“”']+$/g, '');
      if (!Number.isInteger(idx) || idx < 0 || idx >= perSource.length) continue;
      if (quote.length < 15 || quote.length > 160) continue;
      const hay = `${perSource[idx].title} ${perSource[idx].body}`.toLocaleLowerCase('tr-TR');
      if (!hay.includes(quote.toLocaleLowerCase('tr-TR'))) continue; // not verbatim → drop
      sourceQuotes[String(perSource[idx].rawItemId)] = quote;
    }
  }

  const baseUpdate = {
    title: out.title ?? evt.title,
    summary: out.summary ?? evt.summary,
    current_status: out.current_status ?? null,
    how_we_got_here: out.how_we_got_here ?? null,
    actors: Array.isArray(out.actors) ? out.actors : [],
    story: storySteps,
    llm_processed_at: new Date().toISOString(),
  };
  const fullUpdate = {
    ...baseUpdate,
    source_quotes: sourceQuotes,
    related_event_ids: related.map((r) => r.id),
  };

  // Try with the 0006 columns; if the migration isn't applied yet, degrade
  // gracefully so the pipeline keeps working.
  let { error: updErr } = await supabase.from('events').update(fullUpdate).eq('id', evt.id);
  if (updErr && /source_quotes|related_event_ids/.test(updErr.message)) {
    console.warn('  [llm] 0006 columns missing — updating without quotes/related (apply migration!)');
    ({ error: updErr } = await supabase.from('events').update(baseUpdate).eq('id', evt.id));
  }
  if (updErr) throw updErr;

  return { ok: true, title: out.title, quotes: Object.keys(sourceQuotes).length, related: related.length, model: out.__model };
}

async function run() {
  const events = await loadPending(30);
  console.log(`[llm] ${events.length} events pending`);
  if (events.length === 0) return;

  const pool = await loadBackgroundPool();

  let ok = 0, fail = 0;
  for (const evt of events) {
    try {
      const r = await processOne(evt, pool);
      if (r.ok) {
        ok++;
        console.log(`  ✓ ${evt.id} → "${r.title}" (alıntı=${r.quotes}, arka plan=${r.related}, model=${r.model})`);
      } else {
        console.log(`  ⏭  ${evt.id} skipped: ${r.reason}`);
      }
      // Free tier RPM cap (10-15 rpm depending on model). Keep well below.
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    } catch (e) {
      fail++;
      console.warn(`  ✗ ${evt.id}: ${e.message}`);
    }
  }
  console.log(`[llm] done. ok=${ok} fail=${fail}`);
}

run().catch((e) => {
  console.error('[llm] failed:', e);
  process.exit(1);
});
