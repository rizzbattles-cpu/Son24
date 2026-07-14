import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { CardPalette, CardFonts, Spacing } from '@/constants/theme';
import { EventSource, SourceLean } from '@/types/event';
import { trackLinkClick } from '@/services/analytics';

// Grouped by political lean so the reader immediately sees "kim ne dedi".
// Order below is the display order: institutional first (most authoritative),
// then the political spectrum, then agencies as verification signal.
const GROUP_ORDER: SourceLean[] = ['devlet_kurumu', 'iktidar', 'muhalefet', 'yabanci', 'ajans'];
const GROUP_LABEL: Record<SourceLean, string> = {
  devlet_kurumu: 'DEVLET KURUMU',
  iktidar: 'İKTİDAR',
  muhalefet: 'MUHALEFET',
  yabanci: 'ULUSLARARASI',
  ajans: 'AJANSLAR',
};

const MAX_TOTAL = 8; // the list lives in a scrollable box — show plenty

export function SourceList({ sources, eventId }: { sources: EventSource[]; eventId?: string }) {
  // bucket by lean; fall back to "yabanci" if missing
  const buckets = new Map<SourceLean, EventSource[]>();
  sources.forEach((s) => {
    const key: SourceLean = (s.lean as SourceLean | undefined) ?? 'yabanci';
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  });

  // Flatten in canonical order, capping the total so nothing overflows.
  const shown: { group: SourceLean; source: EventSource; first: boolean }[] = [];
  for (const g of GROUP_ORDER) {
    const arr = buckets.get(g) ?? [];
    arr.forEach((s, i) => {
      if (shown.length < MAX_TOTAL) shown.push({ group: g, source: s, first: i === 0 });
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>KİM NE DEDİ</Text>
      {shown.map(({ group, source: s }, idx) => (
        <View key={s.id}>
          <View style={styles.item}>
            <View style={styles.authorRow}>
              <View style={[styles.badge, leanBg(group)]}>
                <Text style={styles.badgeText}>{GROUP_LABEL[group]}</Text>
              </View>
              <Text style={styles.author}>{s.author}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.time}>{s.timestamp}</Text>
            </View>
            {/* Real quote → italic in quotation marks; otherwise the item's
                headline, plain (source + time above already give context). */}
            {s.quote ? (
              <Text style={styles.body}>“{s.quote}”</Text>
            ) : (
              <Text style={styles.headline}>{s.body}</Text>
            )}
            {s.url && (
              <Pressable
                onPress={() => {
                  trackLinkClick({ eventId, url: s.url!, sourceName: s.author });
                  Linking.openURL(s.url!);
                }}
                hitSlop={6}
                style={styles.linkWrap}>
                <Text style={styles.link}>{s.linkLabel ?? 'HABERE GİT →'}</Text>
              </Pressable>
            )}
          </View>
          {idx < shown.length - 1 && <View style={styles.gapRule} />}
        </View>
      ))}
    </View>
  );
}

function leanBg(lean: SourceLean) {
  switch (lean) {
    case 'iktidar':
      return { backgroundColor: '#8b2b1f' }; // kırmızı
    case 'muhalefet':
      return { backgroundColor: '#2b4d8b' }; // mavi
    case 'devlet_kurumu':
      return { backgroundColor: '#3a3122' }; // koyu — taraf üstü
    case 'yabanci':
      return { backgroundColor: '#4a5548' }; // yeşil-gri
    default:
      return { backgroundColor: '#5a4d30' }; // ajans
  }
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  hint: {
    color: CardPalette.textDim,
    fontFamily: CardFonts.sansBold,
    fontSize: 9,
    letterSpacing: 3,
    marginBottom: Spacing.two,
  },
  item: { marginBottom: 2 },
  authorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 3 },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#f0e6cf',
    fontFamily: CardFonts.sansBold,
    fontSize: 8,
    letterSpacing: 1,
  },
  author: {
    flexShrink: 1,
    color: CardPalette.text,
    fontFamily: CardFonts.head,
    fontSize: 14,
    lineHeight: 18,
  },
  body: {
    color: CardPalette.textMuted,
    fontFamily: CardFonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 2,
  },
  headline: {
    color: CardPalette.text,
    fontFamily: CardFonts.sansMed,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  time: {
    color: CardPalette.textDim,
    fontFamily: CardFonts.sansMed,
    fontSize: 10,
    marginLeft: 6,
  },
  linkWrap: { marginTop: 3, alignSelf: 'flex-start' },
  link: {
    color: CardPalette.kicker,
    fontFamily: CardFonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    textDecorationLine: 'underline',
  },
  gapRule: {
    marginTop: 6,
    borderTopWidth: 1,
    borderColor: CardPalette.ruleFaint,
  },
});
