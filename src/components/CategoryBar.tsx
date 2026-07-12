import { ScrollView, Text, Pressable, StyleSheet, View } from 'react-native';
import { NewsprintColors, Fonts, Spacing } from '@/constants/theme';
import { CATEGORIES, Category } from '@/types/event';

interface Props {
  active: Category | 'Tümü';
  onChange: (c: Category | 'Tümü') => void;
}

export function CategoryBar({ active, onChange }: Props) {
  const items: (Category | 'Tümü')[] = ['Tümü', ...CATEGORIES];
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {items.map((c) => {
          const on = c === active;
          return (
            <Pressable key={c} onPress={() => onChange(c)} style={styles.chip}>
              <Text style={[styles.label, on && styles.labelOn]}>{c.toUpperCase()}</Text>
              <View style={[styles.underline, on && styles.underlineOn]} />
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: NewsprintColors.ink },
  row: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.four,
  },
  chip: { alignItems: 'center', paddingBottom: 2 },
  label: {
    color: NewsprintColors.paperDim,
    fontFamily: Fonts.sansMed,
    fontSize: 11,
    letterSpacing: 2,
  },
  labelOn: { color: NewsprintColors.paper },
  underline: {
    marginTop: 4,
    height: 2,
    width: 20,
    backgroundColor: 'transparent',
  },
  underlineOn: { backgroundColor: NewsprintColors.accent },
  rule: {
    height: 1,
    backgroundColor: NewsprintColors.ruleFaint,
  },
});
