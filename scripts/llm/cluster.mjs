// Merge semantically-similar events into one so a single story doesn't create
// N separate cards (e.g. NATO Zirvesi appearing 3× from 3 outlets).
//
// Algorithm:
//   1. Load every event's raw_items + their embeddings, within a 48h window.
//   2. For each event, take the centroid (average) of its raw_item vectors.
//   3. Walk newest → oldest. For each new event, compare to older ones of the
//      SAME category. If cosine similarity ≥ THRESHOLD, merge the newer event
//      INTO the older one: re-link its raw_items, mark the older event for a
//      fresh LLM summary (llm_processed_at = null), and delete the newer.
//   4. That way older events accumulate multiple perspectives (iktidar +
//      muhalefet + kurum + ajans) under one card.

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const THRESHOLD = Number(process.env.CLUSTER_THRESHOLD ?? 0.9);
const WINDOW_HOURS = Number(process.env.CLUSTER_WINDOW_HOURS ?? 48);

function parseVec(s) {
  if (!s) return null;
  if (typeof s !== 'string') return null;
  const t = s.trim().replace(/^\[/, '').replace(/\]$/, '');
  const arr = t.split(',').map(Number);
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

async function run() {
  const cutoff = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from('event_sources')
    .select(
      'event_id, raw_item_id, raw_items!inner(source_id, embedding, published_at), events!inner(id, category, first_seen_at)'
    )
    .gte('raw_items.published_at', cutoff)
    .not('raw_items.embedding', 'is', null);
  if (error) throw error;

  const byEvent = new Map();
  for (const r of rows) {
    const vec = parseVec(r.raw_items.embedding);
    if (!vec) continue;
    if (!byEvent.has(r.event_id)) {
      byEvent.set(r.event_id, {
        eventId: r.event_id,
        category: r.events.category,
        firstSeen: new Date(r.events.first_seen_at),
        vectors: [vec],
        sourceIds: new Set([r.raw_items.source_id]),
      });
    } else {
      const e = byEvent.get(r.event_id);
      e.vectors.push(vec);
      e.sourceIds.add(r.raw_items.source_id);
    }
  }

  const events = [...byEvent.values()];
  console.log(`[cluster] ${events.length} events in window`);

  // Newest-first, so we merge newer arrivals into the older event that already
  // has a card, keeping URL history and event id stable.
  events.sort((a, b) => b.firstSeen - a.firstSeen);
  const merged = new Set();
  let mergeCount = 0;

  for (let i = 0; i < events.length; i++) {
    const a = events[i];
    if (merged.has(a.eventId)) continue;
    const cA = centroid(a.vectors);
    for (let j = i + 1; j < events.length; j++) {
      const b = events[j];
      if (merged.has(b.eventId)) continue;
      // Same category required for a normal merge; a near-identical embedding
      // (≥0.92) merges even across categories — the same story often gets
      // tagged Teknoloji by one outlet and Afet/Siyaset by another.
      const crossCategory = b.category !== a.category;
      // Guard against merging two items from THE SAME single source — that's
      // almost certainly two different stories from one outlet whose titles
      // just look similar (e.g. Sputnik's "Dış Politika · ..." template).
      // Only merge if at least one side brings a NEW outlet to the table.
      const sameSourceMonoculture =
        a.sourceIds.size === 1 &&
        b.sourceIds.size === 1 &&
        [...a.sourceIds][0] === [...b.sourceIds][0];
      if (sameSourceMonoculture) continue;
      const cB = centroid(b.vectors);
      const sim = cosine(cA, cB);
      if (sim < (crossCategory ? Math.max(THRESHOLD, 0.92) : THRESHOLD)) continue;

      // Merge a → b. Relink event_sources, delete a, reset b's summary.
      const { error: linkErr } = await supabase
        .from('event_sources')
        .update({ event_id: b.eventId })
        .eq('event_id', a.eventId);
      if (linkErr) {
        console.warn(`  ✗ relink ${a.eventId}: ${linkErr.message}`);
        continue;
      }
      const { error: delErr } = await supabase.from('events').delete().eq('id', a.eventId);
      if (delErr) console.warn(`  ✗ delete ${a.eventId}: ${delErr.message}`);
      // Force b to be re-summarised now that it has more sources
      await supabase.from('events').update({ llm_processed_at: null }).eq('id', b.eventId);

      merged.add(a.eventId);
      mergeCount++;
      b.vectors.push(...a.vectors);
      a.sourceIds.forEach((sid) => b.sourceIds.add(sid));
      console.log(`  ⇒ merged ${a.eventId.slice(0, 8)}… → ${b.eventId.slice(0, 8)}… (sim=${sim.toFixed(3)})`);
      break;
    }
  }
  console.log(`[cluster] done. merged=${mergeCount}`);
}

run().catch((e) => {
  console.error('[cluster] failed:', e);
  process.exit(1);
});
