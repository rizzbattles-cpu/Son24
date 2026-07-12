// ARCHIVE MODE — Son 24 keeps every event since launch (8 Temmuz 2026).
// Nothing is deleted by default: the app's date tabs / "Açık Konular" browse
// the full history, and storage is effectively free (events are text-only;
// Supabase's 500MB free tier holds years of them).
//
// A safety valve remains for the future: set CLEANUP_HOURS > 0 explicitly to
// re-enable trimming (e.g. if we ever want a rolling window again).

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CLEANUP_HOURS = Number(process.env.CLEANUP_HOURS ?? 0); // 0 = archive everything

async function run() {
  if (!CLEANUP_HOURS || CLEANUP_HOURS <= 0) {
    console.log('[cleanup] archive mode — no events deleted (set CLEANUP_HOURS>0 to trim)');
    return;
  }
  const cutoff = new Date(Date.now() - CLEANUP_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('events')
    .delete()
    .lt('first_seen_at', cutoff)
    .select('id');
  if (error) throw error;
  console.log(`[cleanup] removed ${data?.length ?? 0} events older than ${CLEANUP_HOURS}h`);
}

run().catch((e) => {
  console.error('[cleanup] failed:', e);
  process.exit(1);
});
