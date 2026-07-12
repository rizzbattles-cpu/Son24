/**
 * ⚠️ LEGAL / CONTENT POLICY
 *
 * Anadolu Ajansı content (title, description, images) is COPYRIGHT AA.
 * We are not licensed to redistribute it, and "Kaynak: AA" attribution
 * doesn't grant that right.
 *
 * From this point on, AA is used ONLY as a SIGNAL:
 *   - detect that an event happened (multiple agencies converging → real event)
 *   - trigger fetch of the PRIMARY sources (ministry statements, TBMM
 *     record, TCMB duyuru, party press release) that we ARE allowed to
 *     quote and paraphrase
 *   - Stage 4 LLM writes an ORIGINAL, neutral summary from primary sources
 *
 * That means:
 *   - No AA text is ever rendered directly on a card.
 *   - The scraper (when built) stores AA raw_items with role='signal'.
 *   - loadAAEvents below is retained for reference but its return value
 *     must NOT be surfaced to end users.
 */
import { Platform } from 'react-native';
import { XMLParser } from 'fast-xml-parser';

import { AgendaEvent, Category, EventSource } from '@/types/event';

interface AARssItem {
  guid: string | number | { '#text': string };
  link: string;
  title: string;
  description?: string;
  pubDate?: string;
  image?: string;
}

// AA feed category slug → our internal Category enum.
// MVP scope: only high-priority categories. Spor/Teknoloji/Sağlık/Eğitim
// bulk news is intentionally excluded — they'll return through a Stage 4
// importance filter, not raw feed inclusion.
const CATEGORY_MAP: { rssCat: string; category: Category; kicker: string }[] = [
  { rssCat: 'politika', category: 'Siyaset', kicker: 'Anadolu Ajansı' },
  { rssCat: 'ekonomi', category: 'Ekonomi', kicker: 'Anadolu Ajansı' },
  { rssCat: 'dunya', category: 'Dış Politika', kicker: 'Anadolu Ajansı' },
];

const PER_CATEGORY = 4;

// Turkey-relevance keywords. An item must contain at least one.
const TURKEY_KEYWORDS = [
  'türk', 'ankara', 'i̇stanbul', 'istanbul', 'cumhurbaşkan', 'erdoğan',
  'tbmm', 'ak parti', 'akp', 'chp', 'iyi parti', 'iyi̇p', 'dem parti', 'mhp',
  'bakan', 'bakanlık', 'valisi', 'belediye', 'anadolu',
  'boğaz', 'kıbrıs', 'ege', 'akdeniz', 'karadeniz',
];

// Sports transfers, contract news, box-office listings — low-signal noise
// that shouldn't reach the top 24 unless there's a much better ranker.
const NOISE_KEYWORDS = [
  'transfer', 'imzaladı', 'imza attı', 'sözleşme uzatt', 'kadrosuna kat',
  'yeni takım', 'ayrıldı', 'ayrılığı', 'bonservis',
  'gişe', 'kişilik kadro',
];

function endpoint(cat: string) {
  if (Platform.OS === 'web') return `/api/aa/rss/default?cat=${cat}`;
  return `https://www.aa.com.tr/tr/rss/default?cat=${cat}`;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
});

function stripHtml(s: string) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guidStr(g: AARssItem['guid']): string {
  if (typeof g === 'string') return g;
  if (typeof g === 'number') return String(g);
  if (g && typeof g === 'object' && '#text' in g) return String(g['#text']);
  return String(Math.random()).slice(2);
}

function readSecondsFor(s: string) {
  return Math.max(15, Math.min(60, Math.round(s.length / 18)));
}

function fmtDateTr(d: Date) {
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isTurkeyRelevant(text: string) {
  const t = text.toLowerCase();
  return TURKEY_KEYWORDS.some((k) => t.includes(k));
}

function isNoise(text: string) {
  const t = text.toLowerCase();
  return NOISE_KEYWORDS.some((k) => t.includes(k));
}

async function fetchCategory(rssCat: string, category: Category, kicker: string) {
  const res = await fetch(endpoint(rssCat));
  if (!res.ok) throw new Error(`AA ${rssCat} ${res.status}`);
  const xml = await res.text();
  const obj = parser.parse(xml);
  const rawItems = obj?.rss?.channel?.item;
  const items: AARssItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const filtered = items.filter((it) => {
    const combined = `${it.title ?? ''} ${it.description ?? ''}`;
    if (isNoise(combined)) return false;
    // Dünya feed: only keep items that mention Türkiye or Turkish entities.
    if (category === 'Dış Politika' && !isTurkeyRelevant(combined)) return false;
    return true;
  });

  return filtered.slice(0, PER_CATEGORY).map<AgendaEvent>((it) => {
    const desc = stripHtml(it.description ?? '');
    const title = stripHtml(String(it.title ?? ''));
    const pub = it.pubDate ? new Date(it.pubDate) : new Date();
    const id = `aa-${guidStr(it.guid)}`;
    const source: EventSource = {
      id: `${id}-src`,
      kind: 'press',
      author: 'Anadolu Ajansı',
      role: 'Haber Bülteni',
      timestamp: fmtDateTr(pub),
      body: desc || title,
      url: it.link,
      linkLabel: 'HABERE GİT →',
    };
    return {
      id,
      category,
      kicker,
      title,
      summary: desc || title,
      updatedAt: pub.toISOString(),
      readSeconds: readSecondsFor(desc || title),
      sources: [source],
      story: [
        {
          id: `${id}-step`,
          date: fmtDateTr(pub),
          relative: 'Bugün',
          headline: 'Anadolu Ajansı bültenledi',
          detail: title,
        },
      ],
      context: {
        current: 'Anadolu Ajansı bülteni. Ek kaynaklar toplanmayı bekliyor.',
        howWeGotHere: 'Bu başlık henüz gruplandırılmadı; ilerleyen sürümde diğer resmi kaynaklarla birleştirilecek.',
        actors: [],
      },
    };
  });
}

/** Fetch top items across politika/ekonomi/dunya/tech/spor/egitim, newest first. */
export async function loadAAEvents(): Promise<AgendaEvent[]> {
  try {
    const batches = await Promise.all(
      CATEGORY_MAP.map((c) =>
        fetchCategory(c.rssCat, c.category, c.kicker).catch((e) => {
          console.warn(`[AA] ${c.rssCat} failed:`, e);
          return [] as AgendaEvent[];
        })
      )
    );
    const flat = batches.flat();
    flat.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return flat;
  } catch (e) {
    console.warn('[AA] load failed:', e);
    return [];
  }
}
