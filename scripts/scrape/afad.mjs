// AFAD scraper — pulls last 24h earthquakes into raw_items and refreshes a
// single roll-up event so the app shows one "Son 24 saat depremler" card
// with each quake as a source.
//
// Usage:
//   node --env-file=.env scripts/scrape/afad.mjs    (Node ≥ 20)
//   or:  node -r dotenv/config scripts/scrape/afad.mjs
//   or:  loaded programmatically from an orchestrator.

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env: EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const SOURCE_ID = 'afad';
const AFAD_ENDPOINT = 'https://deprem.afad.gov.tr/apiv2/event/filter';

function isoNoTz(d) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function fetchQuakes({ hours = 24, minMag = 4.5 } = {}) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  const qs = new URLSearchParams({
    start: isoNoTz(start),
    end: isoNoTz(end),
    minmag: String(minMag),
    orderby: 'timedesc',
  }).toString();
  const url = `${AFAD_ENDPOINT}?${qs}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`AFAD ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function toRawItem(q) {
  const mag = parseFloat(q.magnitude);
  const depth = parseFloat(q.depth);
  const entities = [q.province, q.district, q.country, q.location]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return {
    source_id: SOURCE_ID,
    external_id: String(q.eventID),
    title: `M${mag.toFixed(1)} ${q.location}`,
    body: `M${mag.toFixed(1)} · ${q.location} · Derinlik ${depth.toFixed(1)} km`,
    url: 'https://deprem.afad.gov.tr/last-earthquakes.html',
    published_at: new Date(q.date + '+03:00').toISOString(),
    category: 'Afet',
    entities,
    keywords: ['deprem', 'sarsıntı', 'afad'],
    raw_payload: q,
  };
}

async function run() {
  const hours = Number(process.env.AFAD_HOURS ?? 24);
  const minMag = Number(process.env.AFAD_MINMAG ?? 4.5);
  console.log(`[afad] fetching last ${hours}h, minmag=${minMag}…`);
  const quakes = await fetchQuakes({ hours, minMag });
  console.log(`[afad] fetched ${quakes.length} quakes`);
  if (quakes.length === 0) return;

  const rows = quakes.map(toRawItem);
  const { error: rawErr } = await supabase
    .from('raw_items')
    .upsert(rows, { onConflict: 'source_id,external_id', ignoreDuplicates: false });
  if (rawErr) throw rawErr;
  console.log(`[afad] upserted ${rows.length} raw_items`);

  const { data: inserted, error: readErr } = await supabase
    .from('raw_items')
    .select('id, external_id, published_at, body')
    .eq('source_id', SOURCE_ID)
    .in('external_id', quakes.map((q) => String(q.eventID)));
  if (readErr) throw readErr;

  const sorted = [...quakes].sort((a, b) => parseFloat(b.magnitude) - parseFloat(a.magnitude));
  const largest = sorted[0];
  const maxMag = parseFloat(largest.magnitude).toFixed(1);
  const count = quakes.length;

  const title =
    parseFloat(largest.magnitude) >= 4.5
      ? `${largest.location}: ${maxMag} büyüklüğünde deprem`
      : `Son 24 saatte ${count} deprem kaydedildi`;

  const summary =
    `AFAD son 24 saat içinde Türkiye ve çevresinde ${count} sarsıntı kaydetti. ` +
    `En büyüğü ${maxMag} büyüklüğünde, ${largest.location} bölgesinde meydana geldi. ` +
    `Olumsuz bir ihbara ilişkin bildirim yok.`;

  const now = new Date();
  const dateBucket = now.toISOString().slice(0, 10);
  const eventKicker = `AFAD 24 Saatlik Özet · ${dateBucket}`;

  // Roll-up event: delete today's bucket then re-insert. Sources are also
  // rewritten. raw_items persist independently.
  const { error: delErr } = await supabase.from('events').delete().eq('kicker', eventKicker);
  if (delErr) throw delErr;

  // Event time = the latest quake's time (not scrape time), so the freshness
  // filter and ordering reflect when the earthquake actually happened.
  const latestQuakeTime = quakes
    .map((q) => new Date(q.date + '+03:00').getTime())
    .reduce((a, b) => Math.max(a, b), 0);
  const eventTime = new Date(latestQuakeTime || now.getTime()).toISOString();

  const { data: event, error: insErr } = await supabase
    .from('events')
    .insert({
      title,
      summary,
      category: 'Afet',
      kicker: eventKicker,
      first_seen_at: eventTime,
      last_updated_at: eventTime,
      read_seconds: 18,
      actors: ['AFAD'],
      current_status: 'İzleme sürüyor. AFAD verileri her sarsıntıdan sonra güncelleniyor.',
      how_we_got_here: 'Son 24 saat içindeki 3.0+ büyüklüğündeki tüm kayıtlar.',
    })
    .select()
    .single();
  if (insErr) throw insErr;
  console.log(`[afad] created event ${event.id}`);

  const idByExternal = new Map(inserted.map((r) => [r.external_id, r.id]));
  const links = sorted.slice(0, 10).map((q, i) => ({
    event_id: event.id,
    raw_item_id: idByExternal.get(String(q.eventID)),
    role_in_event: 'primary',
    ordering: i,
  }));

  const { error: linkErr } = await supabase.from('event_sources').insert(links);
  if (linkErr) throw linkErr;
  console.log(`[afad] linked ${links.length} sources to event`);
  console.log('[afad] done');
}

run().catch((e) => {
  console.error('[afad] failed:', e);
  process.exit(1);
});
