import { supabase } from '@/lib/supabase';
import { AgendaEvent, Category, EventSource, SourceKind } from '@/types/event';

interface RawItemJoined {
  id: number;
  title: string;
  body: string | null;
  url: string | null;
  published_at: string;
  image_url: string | null;
  sources: {
    id: string;
    name: string;
    tier: string;
    lean: string;
  };
}

interface EventSourceJoined {
  event_id: string;
  role_in_event: string | null;
  ordering: number;
  raw_items: RawItemJoined;
}

interface StoryStepRow {
  relative: string;
  headline: string;
  detail: string;
}

interface EventRow {
  id: string;
  title: string;
  summary: string;
  category: string;
  kicker: string | null;
  first_seen_at: string;
  last_updated_at: string;
  read_seconds: number;
  actors: string[] | null;
  current_status: string | null;
  how_we_got_here: string | null;
  next_date: string | null;
  story: StoryStepRow[] | null;
  /** LLM-extracted verbatim quotes keyed by raw_item id (migration 0006). */
  source_quotes?: Record<string, string> | null;
}

// Archive since launch: every event from 8 Temmuz 2026 onward stays browsable
// (date tabs + "Açık Konular" load-more). The swipe deck is still dominated by
// fresh items because the importance score decays with age.
const LAUNCH_DATE = '2026-07-08T00:00:00Z';
// Pull the newest N as the working set — keeps the payload light no matter how
// large the archive grows (older days simply require nothing extra to store).
const FETCH_LIMIT = 300;
const DECK_SIZE = 20; // the swipe deck — per-source cap applies only here
const MAX_PER_SOURCE = 8; // keep one outlet from dominating the deck

// Core categories dominate the 20 cards; the rest only break in on a genuinely
// big story (their low weight means high importance is needed to rank).
const CATEGORY_WEIGHT: Record<string, number> = {
  Siyaset: 1.3,
  Ekonomi: 1.3,
  'Dış Politika': 1.3,
  Afet: 1.1,
  Güvenlik: 1.0,
  Sağlık: 0.35,
  Çevre: 0.3,
  Eğitim: 0.3,
  Teknoloji: 0.3,
  Spor: 0.15,
  'Resmî Gazete': 0.0,
};
const TIER_WEIGHT: Record<string, number> = {
  primary_gov: 1.0,
  primary_party: 1.0,
  international: 0.9,
  agency: 0.6,
};

interface Scored {
  event: EventRow;
  sources: EventSourceJoined[];
  importance: number;
  dominantSource: string;
}

// Ceremonial / low-substance leader content (anma, taziye, kutlama…) must not
// occupy the top cards unless nothing else is happening.
const CEREMONIAL_RX =
  /anma|andı|anıyoruz|taziye|cenaze|tören|kutlad|kutlam|tebrik|çelenk|yıl ?dönümü|100\. yıl|rahmetle|vefatının|ziyaret etti|kabul etti|ağırladı|bir araya geldi/i;

// Hard-hitting national/international substance: war updates, defence industry,
// diplomacy, sanctions, economy shocks, disasters — these lead the deck.
const HIGH_IMPACT_RX =
  /savaş|çatışma|saldırı|operasyon|harek[âa]t|tezkere|füze|siha|iha|f-16|f-35|kaan|savunma sanayi|aselsan|baykar|roketsan|nato|zirve|ambargo|yaptırım|anlaşma|mutabakat|müzakere|kriz|gerilim|sınır|rusya|ukrayna|israil|iran|abd|amerika|yunanistan|suriye|irak|azerbaycan|ermenistan|kıbrıs|ege|akdeniz|avrupa birliği|birleşmiş milletler|enflasyon|faiz|asgari ücret|zam|devalüasyon|deprem|patlama|şehit/i;

/**
 * Importance ≈ how much this deserves one of the 20 slots.
 *   category × top-tier × recency × multi-source × opposition-clash × content
 * "Content" pushes hard news (war/defence/diplomacy/economy) up and pushes
 * ceremonial leader statements (anma/taziye/kutlama) far down; a foreign
 * outlet talking about Türkiye gets an extra lift.
 */
function scoreEvent(e: EventRow, srcs: EventSourceJoined[]): number {
  const distinctSources = new Set(srcs.map((s) => s.raw_items.sources.id));
  const leans = new Set(srcs.map((s) => s.raw_items.sources.lean));
  const topTier = srcs
    .map((s) => TIER_WEIGHT[s.raw_items.sources.tier] ?? 0.4)
    .reduce((a, b) => Math.max(a, b), 0.4);

  const catW = CATEGORY_WEIGHT[e.category] ?? 0.5;
  const hoursOld = (Date.now() - new Date(e.first_seen_at).getTime()) / 3600000;
  const recency = Math.exp(-Math.max(hoursOld, 0) / 36);
  const multi = 1 + 0.6 * Math.log(1 + distinctSources.size);
  const clash = leans.has('iktidar') && leans.has('muhalefet') ? 1.8 : 1;

  const text = `${e.title} ${e.summary}`.toLocaleLowerCase('tr-TR');
  let content = 1;
  if (HIGH_IMPACT_RX.test(text)) content *= 1.6;
  if (CEREMONIAL_RX.test(text)) content *= 0.3;
  const foreignAboutTr =
    srcs.some((s) => s.raw_items.sources.tier === 'international') &&
    /türkiye|turkey|ankara/.test(text);
  if (foreignAboutTr) content *= 1.5;

  return catW * topTier * recency * multi * clash * content;
}

/**
 * No 3 consecutive deck cards from the same outlet (max 2 in a row) — the
 * reader should never see "sputnik, sputnik, sputnik". Greedy pass: when a
 * triple forms, pull the next differently-sourced card forward.
 */
function breakSourceStreaks(list: Scored[]): Scored[] {
  const out = [...list];
  for (let i = 2; i < out.length; i++) {
    if (
      out[i].dominantSource === out[i - 1].dominantSource &&
      out[i].dominantSource === out[i - 2].dominantSource
    ) {
      let j = i + 1;
      while (j < out.length && out[j].dominantSource === out[i].dominantSource) j++;
      if (j < out.length) {
        const [swap] = out.splice(j, 1);
        out.splice(i, 0, swap);
      }
    }
  }
  return out;
}

// Trim a possibly-truncated string back to its last complete sentence so
// cards never show a dangling "...kelime..." fragment.
function toCompleteSentence(text: string): string {
  if (!text) return text;
  let t = text.trim();
  // Drop a trailing ellipsis / lone fragment.
  t = t.replace(/[\s.…]*\.{2,}\s*$/, '').replace(/…\s*$/, '').trim();
  if (/[.!?]$/.test(t)) return t;
  // Cut back to the last sentence-ending punctuation.
  const m = t.match(/^[\s\S]*[.!?]/);
  if (m && m[0].trim().length > 30) return m[0].trim();
  return t; // no good boundary — leave as is
}

// Keep card summaries short ("hap bilgi"): first sentences up to ~42 words,
// always ending on a full sentence. Works without any LLM re-run.
function conciseSummary(text: string, maxWords = 30): string {
  if (!text) return text;
  const clean = toCompleteSentence(text);
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  let out = '';
  let words = 0;
  for (const s of sentences) {
    const w = s.trim().split(/\s+/).length;
    if (words > 0 && words + w > maxWords) break;
    out += (out ? ' ' : '') + s.trim();
    words += w;
    if (words >= maxWords) break;
  }
  if (out) return out;
  // First sentence alone exceeds the cap — hard-clamp at a word boundary so we
  // never dangle a half word or an ellipsis.
  return clean.split(/\s+/).slice(0, maxWords).join(' ');
}

function fmtDate(iso: string) {
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date(iso);
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function kindFor(tier: string): SourceKind {
  if (tier === 'agency') return 'press';
  if (tier === 'primary_party') return 'statement';
  return 'statement';
}

function linkLabelFor(sourceId: string): string {
  if (sourceId === 'afad') return 'AFAD SON DEPREMLER →';
  return 'HABERE GİT →';
}

/**
 * Fetch the top-24 events + their linked sources, shaped for the card UI.
 * Returns [] on any error — caller can then decide to show a placeholder.
 */
export async function loadTop24(): Promise<AgendaEvent[]> {
  try {
    const cutoff = LAUNCH_DATE;

    // Candidate pool: everything recent. We rank + trim client-side.
    // source_quotes arrived in migration 0006 — retry without it if the
    // column doesn't exist yet so the app never breaks pre-migration.
    const evCols =
      'id, title, summary, category, kicker, first_seen_at, last_updated_at, read_seconds, actors, current_status, how_we_got_here, next_date, story';
    let evRes = (await supabase
      .from('events')
      .select(`${evCols}, source_quotes`)
      .gte('first_seen_at', cutoff)
      .order('first_seen_at', { ascending: false })
      .limit(FETCH_LIMIT)) as { data: unknown; error: { message: string } | null };
    if (evRes.error && /source_quotes/.test(evRes.error.message)) {
      console.warn('[db] source_quotes column missing, retrying without');
      evRes = (await supabase
        .from('events')
        .select(evCols)
        .gte('first_seen_at', cutoff)
        .order('first_seen_at', { ascending: false })
        .limit(FETCH_LIMIT)) as { data: unknown; error: { message: string } | null };
    }
    if (evRes.error) throw evRes.error;
    const events = evRes.data as EventRow[] | null;

    const candidateIds = (events ?? []).map((e) => e.id);
    if (candidateIds.length === 0) return [];

    // Try WITH image_url first, then fall back if the column doesn't exist yet
    // (migration 0005 might not be applied).
    const selectWithImg =
      'event_id, role_in_event, ordering, raw_items!inner(id, title, body, url, published_at, image_url, sources!inner(id, name, tier, lean))';
    const selectNoImg =
      'event_id, role_in_event, ordering, raw_items!inner(id, title, body, url, published_at, sources!inner(id, name, tier, lean))';

    let joinRes = (await supabase
      .from('event_sources')
      .select(selectWithImg)
      .in('event_id', candidateIds)) as { data: unknown; error: { message: string } | null };
    if (joinRes.error && /image_url/.test(joinRes.error.message)) {
      console.warn('[db] image_url column missing, retrying without');
      joinRes = (await supabase
        .from('event_sources')
        .select(selectNoImg)
        .in('event_id', candidateIds)) as { data: unknown; error: { message: string } | null };
    }
    if (joinRes.error) throw joinRes.error;
    const joins = joinRes.data;

    const sourcesByEvent = new Map<string, EventSourceJoined[]>();
    (joins as unknown as EventSourceJoined[])?.forEach((j) => {
      const arr = sourcesByEvent.get(j.event_id) ?? [];
      arr.push(j);
      sourcesByEvent.set(j.event_id, arr);
    });

    // Score every candidate, then pick the top MAX_CARDS with a per-source cap
    // so no single outlet dominates the feed.
    const scored: Scored[] = ((events as EventRow[]) ?? []).map((e) => {
      const srcs = (sourcesByEvent.get(e.id) ?? []).sort((a, b) => a.ordering - b.ordering);
      const dominantSource = srcs[0]?.raw_items.sources.id ?? 'none';
      return { event: e, sources: srcs, importance: scoreEvent(e, srcs), dominantSource };
    });
    scored.sort((a, b) => b.importance - a.importance);

    // Fill the swipe deck (top DECK_SIZE, per-source capped for variety), then
    // append EVERYTHING else in importance order — the archive list must show
    // every day since launch, nothing gets dropped.
    const perSource: Record<string, number> = {};
    const deck: Scored[] = [];
    const restScored: Scored[] = [];
    for (const s of scored) {
      const n = perSource[s.dominantSource] ?? 0;
      if (deck.length < DECK_SIZE && n < MAX_PER_SOURCE) {
        perSource[s.dominantSource] = n + 1;
        deck.push(s);
      } else {
        restScored.push(s);
      }
    }
    const picked = [...breakSourceStreaks(deck), ...restScored];

    return picked.map<AgendaEvent>(({ event: e, sources: eSources }) => {
      const sources: EventSource[] = eSources.map((es) => {
        const raw = es.raw_items;
        // Prefer the LLM's verbatim quote from this source's own text; fall
        // back to a concise summary of the scraped body.
        const quote = e.source_quotes?.[String(raw.id)]?.trim() || undefined;
        return {
          id: `db-src-${raw.id}`,
          kind: kindFor(raw.sources.tier),
          author: raw.sources.name,
          role: es.role_in_event === 'primary' ? 'Birincil Kaynak' : 'İlgili Açıklama',
          timestamp: fmtDate(raw.published_at),
          body: quote ?? conciseSummary(raw.body ?? raw.title, 50),
          quote,
          url: raw.url ?? undefined,
          linkLabel: raw.url ? linkLabelFor(raw.sources.id) : undefined,
          lean: raw.sources.lean as EventSource['lean'],
        };
      });

      // Photo straight from the source article (og:image). If a source has no
      // photo, the card is simply text-only — no stock pool.
      const imageUrl = eSources.map((es) => es.raw_items.image_url).find((u) => !!u) ?? undefined;
      return {
        id: e.id,
        category: (e.category as Category) ?? 'Siyaset',
        kicker: e.kicker ?? '',
        title: e.title,
        // Generous cap (sentence-aligned): the summary box scrolls, so the
        // LLM's full 35-45 word summary is never chopped mid-sentence.
        summary: conciseSummary(e.summary, 80),
        updatedAt: e.last_updated_at,
        readSeconds: e.read_seconds ?? 20,
        sources,
        imageUrl,
        // No word-capping here anymore: the card's text areas scroll, so story
        // steps and status ship FULL — never a half sentence on screen.
        story:
          Array.isArray(e.story) && e.story.length > 0
            ? e.story.map((s, i) => ({
                id: `${e.id}-step-${i}`,
                date: fmtDate(e.last_updated_at),
                relative: s.relative ?? '',
                headline: (s.headline ?? '').trim(),
                detail: toCompleteSentence(s.detail ?? ''),
              }))
            : [
                {
                  id: `${e.id}-step`,
                  date: fmtDate(e.last_updated_at),
                  relative: 'Bugün',
                  headline: 'İlk kayıt',
                  detail: toCompleteSentence(e.title),
                },
              ],
        context: {
          current: toCompleteSentence(e.current_status ?? 'İzleme sürüyor.'),
          howWeGotHere: e.how_we_got_here ?? 'Ek kaynaklar toplandıkça bu bölüm zenginleşecek.',
          actors: e.actors ?? [],
          nextDate: e.next_date ?? undefined,
        },
      };
    });
  } catch (e) {
    console.warn('[db] loadTop24 failed:', e);
    return [];
  }
}
