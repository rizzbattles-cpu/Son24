// Gemini embeddings for raw_items that don't have one yet. Feeds the clustering
// step that groups semantically-similar items into a single event.

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
// gemini-embedding-001 is the current API. Native dim is 3072; we cap at 768
// to match the raw_items.embedding column (vector(768)) and cluster faster.
const MODEL = 'gemini-embedding-001';
const OUTPUT_DIM = 768;

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
  console.error('Missing env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function embedText(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: text.slice(0, 2000) }] },
      taskType: 'SEMANTIC_SIMILARITY',
      outputDimensionality: OUTPUT_DIM,
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j?.embedding?.values;
}

async function run() {
  // Only recent items (72h) — the clustering window is 48h so anything older
  // has already been either merged or aged out. Saves quota.
  const cutoff = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
  const { data: pending, error } = await supabase
    .from('raw_items')
    .select('id, title, body, raw_payload')
    .is('embedding', null)
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  console.log(`[embed] ${pending.length} pending`);

  let ok = 0, fail = 0;
  for (const item of pending) {
    try {
      // The stored title/body may be a paraphrase placeholder for agency
      // items — always prefer the archived original from raw_payload so the
      // embedding actually reflects the story's semantics.
      const t = item.raw_payload?.title ?? item.title;
      const b = item.raw_payload?.description ?? item.body ?? '';
      const text = `${t}. ${b}`.trim();
      const values = await embedText(text);
      if (!values || values.length === 0) throw new Error('empty embedding');
      // pgvector accepts a bracketed comma-separated string.
      const embStr = `[${values.join(',')}]`;
      const { error: uErr } = await supabase.from('raw_items').update({ embedding: embStr }).eq('id', item.id);
      if (uErr) throw uErr;
      ok++;
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      fail++;
      console.warn(`\n  ✗ ${item.id}: ${e.message}`);
      if (String(e.message).includes('429')) {
        console.warn('  quota — stopping');
        break;
      }
    }
  }
  console.log(`\n[embed] done. ok=${ok} fail=${fail}`);
}

run().catch((e) => {
  console.error('[embed] failed:', e);
  process.exit(1);
});
