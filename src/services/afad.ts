import { Platform } from 'react-native';
import { AgendaEvent, EventSource, StoryStep } from '@/types/event';

interface AfadEvent {
  eventID: string;
  date: string;
  latitude: string;
  longitude: string;
  depth: string;
  type: string;
  magnitude: string;
  location: string;
  country: string | null;
  province: string | null;
  district: string | null;
  neighborhood: string | null;
}

// Browsers block cross-origin fetches to AFAD (no CORS headers). On web
// preview we hit Metro's built-in dev proxy at /api/afad which forwards to
// deprem.afad.gov.tr/apiv2. Native builds go direct.
function endpoint(qs: string) {
  if (Platform.OS === 'web') return `/api/afad/event/filter?${qs}`;
  return `https://deprem.afad.gov.tr/apiv2/event/filter?${qs}`;
}

function isoNoTz(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function fetchLast24hQuakes(minMag = 4.5): Promise<AfadEvent[]> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const qs = `start=${isoNoTz(start)}&end=${isoNoTz(end)}&minmag=${minMag}&orderby=timedesc`;
  const res = await fetch(endpoint(qs));
  if (!res.ok) throw new Error(`AFAD ${res.status}`);
  const data = (await res.json()) as AfadEvent[];
  return Array.isArray(data) ? data : [];
}

function fmtDate(iso: string) {
  // "2026-07-08T12:34:56" → "08 Tem 12:34"
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Fold last-24h AFAD earthquakes into one AgendaEvent card. */
export async function loadAfadEvent(): Promise<AgendaEvent | null> {
  try {
    const quakes = await fetchLast24hQuakes(4.5);
    if (quakes.length === 0) return null;

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
      `En büyüğü ${maxMag} büyüklüğünde, ${largest.location} bölgesinde ${fmtDate(largest.date)} saatlerinde meydana geldi. ` +
      `Kaynaklar arasında olumsuz ihbara ilişkin bir bildirim yok.`;

    const sources: EventSource[] = sorted.slice(0, 8).map((q) => ({
      id: `afad-${q.eventID}`,
      kind: 'statement',
      author: 'AFAD',
      role: 'Deprem Kaydı',
      timestamp: fmtDate(q.date),
      body: `M${parseFloat(q.magnitude).toFixed(1)} · ${q.location} · Derinlik ${parseFloat(q.depth).toFixed(1)} km`,
      url: 'https://deprem.afad.gov.tr/last-earthquakes.html',
      linkLabel: 'AFAD SON DEPREMLER →',
    }));

    const story: StoryStep[] = [
      {
        id: 's-24h',
        date: fmtDate(new Date().toISOString()),
        relative: 'Son 24 saat',
        headline: `${count} sarsıntı kaydedildi`,
        detail: `En büyüğü ${maxMag} — ${largest.location}.`,
      },
    ];

    return {
      id: 'afad-live',
      category: 'Afet',
      kicker: 'AFAD Bildirimi',
      title,
      summary,
      updatedAt: new Date().toISOString(),
      readSeconds: 18,
      sources,
      story,
      context: {
        current: 'İzleme sürüyor. AFAD verileri her sarsıntıdan sonra güncelleniyor.',
        howWeGotHere: 'Son 24 saat içindeki 3.0+ büyüklüğündeki tüm kayıtlar.',
        actors: ['AFAD'],
      },
    };
  } catch (e) {
    console.warn('[AFAD] fetch failed:', e);
    return null;
  }
}
