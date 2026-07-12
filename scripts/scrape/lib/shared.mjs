// Shared helpers for all scrapers.

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { spawn } from 'node:child_process';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env: EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Some gov.tr firewalls (TCCB in particular) block anything that self-identifies
// as a bot, even a polite one. Use a standard browser UA. All scraped content
// is public and rate-limited (single request per source every ~15 min).
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Direct HTTPS request with IPv4 forced (undici hangs on gov.tr IPv6).
// Follows redirects up to 5 hops. Returns text body.
// Fallback via system curl. Some sites (AKP, İYİ) reject Node's TLS
// fingerprint with 403 while accepting curl. Streams stdout back as text.
function fetchWithCurl(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '-sSL', '--max-time', '25', '--compressed',
      '-A', UA,
      '-H', 'Accept: text/html,application/xhtml+xml',
      '-H', 'Accept-Language: tr,en;q=0.8',
      url,
    ];
    const child = spawn('curl', args);
    const chunks = [];
    const errs = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => errs.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
      else reject(new Error(`curl exit ${code}: ${Buffer.concat(errs).toString('utf8').slice(0, 200)}`));
    });
  });
}

export function fetchHtml(url, options = {}) {
  const { headers = {}, hop = 0, allowGzip = true } = options;
  if (hop > 5) throw new Error(`too many redirects: ${url}`);
  const u = new URL(url);
  const lib = u.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        method: 'GET',
        host: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        family: 4, // force IPv4
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml',
          // Large WordPress sites (AKP, İYİ) time out on plain transfer;
          // enable compression by default.
          'Accept-Encoding': allowGzip ? 'gzip, deflate, br' : 'identity',
          'Accept-Language': 'tr,en;q=0.8',
          Connection: 'close',
          ...headers,
        },
        timeout: 30000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          fetchHtml(next, { headers, hop: hop + 1, allowGzip }).then(resolve, reject);
          return;
        }
        if (res.statusCode >= 400) {
          res.resume();
          // Some sites return 403 to Node's TLS fingerprint but accept curl.
          if (res.statusCode === 403) {
            fetchWithCurl(url).then(resolve, reject);
            return;
          }
          reject(new Error(`${url} → HTTP ${res.statusCode}`));
          return;
        }
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        let stream = res;
        if (enc === 'gzip') stream = res.pipe(createGunzip());
        else if (enc === 'deflate') stream = res.pipe(createInflate());
        else if (enc === 'br') stream = res.pipe(createBrotliDecompress());

        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error(`timeout: ${url}`)));
    req.on('error', reject);
    req.end();
  });
}

/**
 * Quick liveness check for an article URL. Returns true only on a 2xx. Uses
 * curl (accepts sites that 403 Node's TLS). Dead links → the item is dropped.
 */
export function urlOk(url) {
  return new Promise((resolve) => {
    const child = spawn('curl', ['-sSL', '--max-time', '12', '-o', '/dev/null', '-w', '%{http_code}', '-A', UA, url]);
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('error', () => resolve(false));
    child.on('close', () => {
      const code = parseInt(out.trim().slice(-3), 10);
      resolve(code >= 200 && code < 400);
    });
  });
}

/**
 * Upsert raw items and create a 1:1 event for each new item.
 * Existing raw_items (same source_id + external_id) are updated but no
 * duplicate event is created for them.
 *
 * @param {string} sourceId
 * @param {Array<object>} items — each: {external_id, title, body, url, published_at, category, kicker, entities?, keywords?}
 * @param {object} options
 * @param {boolean} [options.signalOnly=false] — if true, raw_items are stored but no events are created
 */
export async function ingest(sourceId, items, { signalOnly = false } = {}) {
  if (items.length === 0) {
    console.log(`[${sourceId}] no items`);
    return;
  }

  const rawRows = items.map((it) => ({
    source_id: sourceId,
    external_id: it.external_id,
    title: it.title,
    body: it.body ?? null,
    url: it.url ?? null,
    published_at: it.published_at,
    category: it.category ?? null,
    entities: it.entities ?? [],
    keywords: it.keywords ?? [],
    raw_payload: it.raw_payload ?? null,
    image_url: it.image_url ?? null,
  }));

  const { data: existing } = await supabase
    .from('raw_items')
    .select('id, external_id')
    .eq('source_id', sourceId)
    .in('external_id', rawRows.map((r) => r.external_id));

  const existingSet = new Set((existing ?? []).map((r) => r.external_id));

  const { error: upErr } = await supabase
    .from('raw_items')
    .upsert(rawRows, { onConflict: 'source_id,external_id' });
  if (upErr) throw upErr;
  console.log(`[${sourceId}] upserted ${rawRows.length} raw_items`);

  if (signalOnly) {
    console.log(`[${sourceId}] signal-only — no events created`);
    return;
  }

  const { data: reread } = await supabase
    .from('raw_items')
    .select('id, external_id, title, body, category, published_at, url')
    .eq('source_id', sourceId)
    .in('external_id', rawRows.map((r) => r.external_id));

  const newOnes = (reread ?? []).filter((r) => !existingSet.has(r.external_id));
  if (newOnes.length === 0) {
    console.log(`[${sourceId}] no new items → 0 events`);
    return;
  }

  const eventRows = newOnes.map((r) => {
    const item = items.find((x) => x.external_id === r.external_id);
    return {
      title: r.title,
      // MVP: paraphrase-safe display sentence built from FACTS only.
      // Full text of primary source stays in raw_items.body and is quoted
      // in the sources tab; the card shows this bland fact-only line until
      // Stage 4 LLM writes a proper original summary.
      summary: `${item?.actor ?? 'Kaynak'} bugün "${r.title}" konusunda açıklama yaptı. Ayrıntı ve kaynak alıntısı için kaynaklar sekmesine bakınız.`,
      category: r.category,
      kicker: item?.kicker ?? 'Resmi Açıklama',
      first_seen_at: r.published_at,
      last_updated_at: r.published_at,
      read_seconds: 20,
      actors: item?.actors ?? [],
    };
  });

  const { data: insertedEvents, error: eventErr } = await supabase
    .from('events')
    .insert(eventRows)
    .select();
  if (eventErr) throw eventErr;
  console.log(`[${sourceId}] created ${insertedEvents.length} events`);

  const links = insertedEvents.map((e, i) => ({
    event_id: e.id,
    raw_item_id: newOnes[i].id,
    role_in_event: 'primary',
    ordering: 0,
  }));
  const { error: linkErr } = await supabase.from('event_sources').insert(links);
  if (linkErr) throw linkErr;
  console.log(`[${sourceId}] linked ${links.length} sources`);
}

// Turkish month names for parsing dates.
export const TR_MONTHS = {
  Ocak: 0, Şubat: 1, Mart: 2, Nisan: 3, Mayıs: 4, Haziran: 5,
  Temmuz: 6, Ağustos: 7, Eylül: 8, Ekim: 9, Kasım: 10, Aralık: 11,
};

/** Parse "18 Haziran 2026" → Date */
export function parseTrDate(str) {
  const m = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!m) return null;
  const [, day, monthName, year] = m;
  const mon = TR_MONTHS[monthName];
  if (mon === undefined) return null;
  return new Date(Date.UTC(Number(year), mon, Number(day)));
}

const BAD_IMG = /logo|placeholder|default|favicon|amblem|icon|avatar|sprite|blank|banner|header|footer|pixel|1x1|spacer|\/assets\/|site_media|\/gfx\/|ataturk|bg-|print/i;

function extractOg(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og && !BAD_IMG.test(og[1])) return og[1];
  const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (tw && !BAD_IMG.test(tw[1])) return tw[1];
  return null;
}

const GOOD_IMG = /download\.aspx|\/uploads?\/|\/media\/|\/haber|\/content|\/image|cdn|\/files\/|thumbs_b_c|\.jpe?g|\.png|\.webp/i;

// Fallback: the first real content photo inside the article body. Picks the
// first <img> whose src looks like a photo (file extension OR a known photo
// endpoint like ...Image/download.aspx) and isn't a logo/icon.
function extractContentImage(html) {
  const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const src of imgs) {
    if (BAD_IMG.test(src) || /powerapps\.com|\/css\//i.test(src)) continue;
    if (GOOD_IMG.test(src)) return src;
  }
  return null;
}

/** Fetch a URL and return the og:image content (if any). Returns null on failure. */
export async function fetchOgImage(url) {
  try {
    return extractOg(await fetchHtml(url));
  } catch {
    return null;
  }
}

/**
 * One request that both validates the link and pulls its og:image.
 * Returns { live, image }. Dead links (4xx) → live:false so they're dropped.
 */
export async function fetchOgImageOrDead(url) {
  try {
    const html = await fetchHtml(url); // throws on 4xx (403 auto-retries via curl)
    // Prefer og:image; if it's a logo/missing, dig the first content photo out
    // of the article body.
    let img = extractOg(html) || extractContentImage(html);
    if (img) {
      try { img = new URL(img, url).toString(); } catch { /* keep as-is */ }
    }
    return { live: true, image: img };
  } catch {
    return { live: false, image: null };
  }
}
