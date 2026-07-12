// Shared helpers for party press-page scrapers. Each party site has its own
// URL structure but they all boil down to: (title, url, dateGuess). We keep
// the ingest shape identical so the pipeline can treat them uniformly.

export function cleanTitle(raw) {
  return String(raw ?? '')
    .replace(/&#x[0-9a-f]+;/gi, (m) => {
      try { return String.fromCodePoint(parseInt(m.slice(3, -1), 16)); } catch { return m; }
    })
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // normalise curly quotes / stray decorative marks
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[‘’]{2}|['"]{2,}/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Turkish-safe casing. JS's toLowerCase/toUpperCase mangle İ/I/ı — always use
// the tr-TR locale variants.
const trLower = (s) => s.toLocaleLowerCase('tr-TR');
const trUpper = (s) => s.toLocaleUpperCase('tr-TR');

/**
 * Produce a clean, readable headline:
 *  - decode entities, fix quotes
 *  - strip leading junk (stray digits / punctuation e.g. "1NATO…")
 *  - if the text is SHOUTING (mostly uppercase) → convert to Turkish sentence
 *    case so we don't display ALL CAPS or mangled title-case
 */
export function tidyTitle(raw) {
  let t = cleanTitle(raw);
  // Strip a leading stray digit/punctuation that isn't part of a real number
  // (e.g. Sputnik's "1NATO Zirvesi…" → "NATO Zirvesi…"). Keep "36. NATO".
  t = t.replace(/^\s*\d(?=[A-ZÇĞİÖŞÜ])/, '').trim();
  t = t.replace(/^[^0-9A-Za-zÇĞİÖŞÜçğıöşü"]+/, '').trim();

  const letters = t.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  const uppers = t.replace(/[^A-ZÇĞİÖŞÜ]/g, '');
  const mostlyUpper = letters.length > 0 && uppers.length / letters.length > 0.6;

  if (mostlyUpper) {
    t = trLower(t);
    // Capitalise the FIRST letter of the string even if it's behind a quote,
    // and the first letter after a sentence ender.
    t = t.replace(/^([^A-Za-zÇĞİÖŞÜçğıöşü]*)([a-zçğıöşü])/, (m, lead, c) => lead + trUpper(c));
    t = t.replace(/([.!?:]\s+)([a-zçğıöşü])/g, (m, p1, c) => p1 + trUpper(c));
    // Restore common proper nouns that sentence-casing flattened.
    t = recapitalizeProperNouns(t);
  }
  return t.trim();
}

// A curated set of proper nouns / acronyms so ALL-CAPS→sentence-case titles
// don't read "türkiye" / "nato". Word-boundary, Turkish-aware.
const PROPER = [
  'Türkiye', 'Türk', 'Türkler', 'Türklük', 'Ankara', 'İstanbul', 'İzmir',
  'Avrupa', 'Rusya', 'Ukrayna', 'İran', 'İsrail', 'Suriye', 'ABD', 'Almanya',
  'Fransa', 'Yunanistan', 'Azerbaycan', 'Kıbrıs', 'Filistin', 'Gazze',
  'NATO', 'AB', 'BM', 'IMF', 'PKK', 'YPG', 'CHP', 'AKP', 'MHP', 'DEM',
  'Erdoğan', 'Özel', 'Kılıçdaroğlu', 'Bahçeli', 'Özdağ', 'Dervişoğlu',
  'Öcalan', 'Kurtulmuş', 'Fidan', 'Meclis', 'TBMM', 'Cumhurbaşkanı',
  'Atatürk', 'Anayasa', 'Kasım', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs',
  'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Aralık',
];
function recapitalizeProperNouns(s) {
  let out = s;
  for (const p of PROPER) {
    const low = trLower(p);
    // word-boundary-ish replace, Turkish letters included
    const re = new RegExp(`(^|[^0-9A-Za-zÇĞİÖŞÜçğıöşü])(${escapeRe(low)})(?=$|[^0-9A-Za-zÇĞİÖŞÜçğıöşü])`, 'g');
    out = out.replace(re, (m, pre) => pre + p);
  }
  return out;
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// External_id from the article URL slug so re-runs don't create duplicates.
export function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    return parts[parts.length - 1] || u.pathname;
  } catch {
    return url;
  }
}

const POLITICAL_HINTS = [
  'anayasa', 'yasa', 'kanun', 'komisyon', 'meclis', 'oylama', 'sandık',
  'ekonomi', 'faiz', 'enflasyon', 'zam', 'bütçe',
  'zirve', 'görüşme', 'diplomasi', 'nato', 'ab ', 'avrupa',
  'operasyon', 'saldırı', 'güvenlik', 'terör',
  'iktidar', 'muhalefet', 'kabine', 'seçim',
  'işçi', 'emekli', 'asgari',
];
const NOISE_HINTS = [
  'kongre kutlama', 'ziyaret makam', 'atanan başkan', 'partililere',
  'nikah', 'başsağlığı', 'geçmiş olsun',
];

// Very light filter — we want to keep party press releases broadly, but skip
// pure ceremonial / internal-party items that carry no gündem signal.
export function isPolitical(text) {
  const t = text.toLowerCase();
  if (NOISE_HINTS.some((k) => t.includes(k))) return false;
  if (POLITICAL_HINTS.some((k) => t.includes(k))) return true;
  // Fallback: keep it if the title is fairly substantive (long enough to be
  // more than a photo-op line).
  return t.length >= 40;
}

export function guessCategoryFromTitle(text) {
  const t = text.toLowerCase();
  if (/faiz|enflasyon|kur|bütçe|ekonomi|zamm|piyasa|asgari|emekli|işçi|banka/.test(t)) return 'Ekonomi';
  if (/nato|ab |avrupa birliği|dışişleri|zirve|diplomasi|yabancı ülke|görüşme|ziyaret dış/.test(t)) return 'Dış Politika';
  if (/operasyon|saldırı|güvenlik|terör|pkk|şehit/.test(t)) return 'Güvenlik';
  return 'Siyaset';
}
