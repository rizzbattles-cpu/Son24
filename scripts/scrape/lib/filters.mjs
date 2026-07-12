// Türkiye + politics / hard-news relevance filters.
// Used by every AGENCY scraper before an item is ingested.

const TURKEY_TERMS = [
  'türk', 'ankara', 'i̇stanbul', 'istanbul', 'anadolu',
  'cumhurbaşkan', 'erdoğan', 'başbakan', 'yargıtay',
  'tbmm', 'meclis', 'kabine',
  'ak parti', 'akp', 'chp', 'mhp', 'iyi parti', 'i̇yi parti', 'dem parti', 'zafer partisi', 'saadet',
  'bakan', 'bakanlığı', 'valilik', 'valisi', 'büyükşehir',
  'boğaz', 'kıbrıs', 'ege', 'akdeniz', 'karadeniz',
  'terörsüz', 'pkk', 'kürt', 'kürtçe',
  'tcmb', 'faiz', 'lira',
];

// Political / hard-news signals. Item must hit at least one to count.
const POLITICAL_TERMS = [
  'siyaset', 'siyasi', 'siyasal',
  'anayasa', 'yasa', 'kanun', 'yönetmelik', 'karar',
  'seçim', 'oylama', 'oy', 'sandık', 'ittifak',
  'kabine', 'bakanlar kurulu', 'genel kurul', 'komisyon',
  'zirve', 'görüşme', 'ziyaret',
  'kriz', 'çatışma', 'operasyon', 'saldırı', 'gözaltı', 'tutukla',
  'gündem', 'diplomasi', 'ateşkes', 'mutabakat',
  'ekonomi', 'faiz', 'enflasyon', 'kur', 'bütçe', 'zamm', 'zam ', 'asgari',
  'davada', 'davası', 'mahkeme', 'yargı',
  'nato', 'ab ', 'avrupa birliği', 'bm ', 'imf', 'g7', 'g20',
];

const NOISE_TERMS = [
  'transfer olduğu', 'transfer oldu', 'imzaladı', 'imza attı', 'sözleşme uzatt',
  'kadrosuna kat', 'bonservis', 'yeni takım', 'ayrıldı takım',
  'magazin', 'dizi ', 'konser', 'ünlü ', 'oyuncu',
  'wimbledon', 'nba', 'euroleague', 'şampiyonlar ligi maçı',
  'burç yorum', 'burçlar', 'astroloji',
  'yemek tarif', 'reçet', 'diyet listesi',
];

function containsAny(text, terms) {
  const t = text.toLowerCase();
  return terms.some((term) => t.includes(term));
}

/** True if the item is about Türkiye AND touches politics/hard news. */
export function isRelevant(...texts) {
  const combined = texts.filter(Boolean).join(' ');
  if (!combined) return false;
  if (containsAny(combined, NOISE_TERMS)) return false;
  return containsAny(combined, TURKEY_TERMS) && containsAny(combined, POLITICAL_TERMS);
}

/**
 * Build a paraphrased body sentence that never reproduces the agency's own text.
 * Used for tier=agency sources so we don't republish copyrighted headlines/leads.
 */
export function paraphraseBody(sourceName, publishedAt, category) {
  const d = new Date(publishedAt);
  const pad = (n) => n.toString().padStart(2, '0');
  const timeStr = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${sourceName}, ${timeStr} itibarıyla ${category?.toLowerCase() ?? 'gündeme'} ilişkin bir haber yayımladı. Habere ulaşmak için kaynağa git.`;
}
