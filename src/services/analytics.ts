import { supabase } from '@/lib/supabase';

/**
 * Fire-and-forget click tracking for "HABERE GİT" links.
 * Writes to the append-only link_clicks table (anon INSERT-only via RLS).
 * Never throws and never blocks the UI — analytics must not break reading.
 */
export function trackLinkClick(params: { eventId?: string; url: string; sourceName?: string }) {
  try {
    void supabase
      .from('link_clicks')
      .insert({
        event_id: params.eventId ?? null,
        url: params.url,
        source_name: params.sourceName ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn('[analytics] link click not recorded:', error.message);
      });
  } catch {
    // analytics is best-effort only
  }
}
