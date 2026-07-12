import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { NewsprintColors, Fonts, Spacing } from '@/constants/theme';
import { AgendaEvent } from '@/types/event';

interface Props {
  topics: AgendaEvent[];
  onSelect: (index: number) => void;
}

const MONTHS_ABBR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const MONTHS_FULL = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];
function fmtTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())} ${MONTHS_ABBR[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dayKey(iso: string) {
  return new Date(iso).toDateString();
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]}`;
}

export function OpenTopicsMenu({ topics, onSelect }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      <View style={styles.headline}>
        <Text style={styles.title}>Açık Konular</Text>
        <View style={styles.doubleRule} />
      </View>

      <View style={styles.list}>
        {topics.map((t, i) => {
          // Bold date header whenever the day changes (list is newest-first).
          const showHeader = i === 0 || dayKey(t.updatedAt) !== dayKey(topics[i - 1].updatedAt);
          return (
            <View key={t.id}>
              {showHeader && (
                <View style={styles.dayHeader}>
                  <Text style={styles.dayText}>{dayLabel(t.updatedAt)}</Text>
                  <View style={styles.dayRule} />
                </View>
              )}
              <Pressable onPress={() => onSelect(i)} style={styles.item}>
                <View style={styles.itemRow}>
                  <Text style={styles.itemKicker}>{t.category.toUpperCase()}</Text>
                </View>
                <Text style={styles.itemTitle} numberOfLines={2}>{t.title}</Text>
                <Text style={styles.itemSummary} numberOfLines={2}>{t.summary}</Text>
                <View style={styles.itemFooter}>
                  <Text style={styles.itemSource} numberOfLines={1}>
                    {t.sources[0]?.author ?? 'Kaynak'}
                  </Text>
                  <Text style={styles.itemDot}>·</Text>
                  <Text style={styles.itemDate}>{fmtTime(t.updatedAt)}</Text>
                </View>
                <View style={styles.itemRule} />
              </Pressable>
              {/* Ad slot after every 5 items — empty placeholder for now */}
              {(i + 1) % 5 === 0 && i < topics.length - 1 && (
                <View style={styles.adSlot}>
                  <Text style={styles.adLabel}>REKLAM</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.three,
  },
  headline: { marginTop: 0, marginBottom: Spacing.three },
  doubleRule: {
    marginTop: Spacing.three,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: NewsprintColors.rule,
    height: 3,
  },
  title: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.serifDisplay,
    fontSize: 42,
    lineHeight: 46,
    textAlign: 'center',
  },
  list: { marginTop: Spacing.two },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
    marginBottom: Spacing.one,
  },
  dayText: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  dayRule: { flex: 1, height: 1, backgroundColor: NewsprintColors.rule },
  adSlot: {
    height: 96,
    marginVertical: Spacing.three,
    borderWidth: 1,
    borderColor: NewsprintColors.ruleFaint,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NewsprintColors.inkSoft,
  },
  adLabel: {
    color: NewsprintColors.paperDim,
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    letterSpacing: 4,
  },
  item: { paddingVertical: Spacing.three },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  itemKicker: {
    color: NewsprintColors.accentSoft,
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
  },
  itemDot: { color: NewsprintColors.paperDim, fontSize: 10 },
  itemMeta: {
    color: NewsprintColors.paperDim,
    fontFamily: Fonts.sans,
    fontSize: 10,
    letterSpacing: 2,
  },
  itemTitle: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.serifHead,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 4,
  },
  itemSummary: {
    color: NewsprintColors.paperMuted,
    fontFamily: Fonts.serifBody,
    fontSize: 13,
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  itemSource: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1,
    flexShrink: 1,
  },
  itemDate: {
    color: NewsprintColors.paperDim,
    fontFamily: Fonts.sans,
    fontSize: 10,
    letterSpacing: 1,
  },
  itemRule: {
    marginTop: Spacing.three,
    height: 1,
    backgroundColor: NewsprintColors.ruleFaint,
  },
});
