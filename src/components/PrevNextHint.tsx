import { View, Text, StyleSheet, Pressable } from 'react-native';
import { NewsprintColors, Fonts, Spacing } from '@/constants/theme';

interface Props {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function PrevNextHint({ index, total, onPrev, onNext }: Props) {
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  return (
    <View style={styles.wrap}>
      {/* Left = swipe-left = NEXT (matches card motion) */}
      <Pressable
        onPress={onNext}
        disabled={!hasNext}
        hitSlop={10}
        style={({ pressed }) => [styles.side, pressed && styles.pressed]}>
        <Text style={[styles.arrow, !hasNext && styles.dim]}>←</Text>
        <Text style={[styles.label, !hasNext && styles.dim]}>SONRAKİ</Text>
      </Pressable>

      <View style={styles.middle}>
        <View style={styles.dot} />
        <View style={styles.rule} />
        <View style={[styles.dot, styles.dotOn]} />
        <View style={styles.rule} />
        <View style={styles.dot} />
      </View>

      {/* Right = swipe-right = PREVIOUS */}
      <Pressable
        onPress={onPrev}
        disabled={!hasPrev}
        hitSlop={10}
        style={({ pressed }) => [styles.side, styles.sideEnd, pressed && styles.pressed]}>
        <Text style={[styles.label, !hasPrev && styles.dim]}>ÖNCEKİ</Text>
        <Text style={[styles.arrow, !hasPrev && styles.dim]}>→</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  sideEnd: { justifyContent: 'flex-end' },
  pressed: { opacity: 0.5 },
  arrow: {
    color: NewsprintColors.paperMuted,
    fontFamily: Fonts.serifDisplay,
    fontSize: 18,
  },
  label: {
    color: NewsprintColors.paperMuted,
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 3,
  },
  dim: { opacity: 0.3 },
  middle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: NewsprintColors.paperMuted,
  },
  dotOn: {
    backgroundColor: NewsprintColors.accent,
    borderColor: NewsprintColors.accent,
  },
  rule: {
    width: 20,
    height: 1,
    backgroundColor: NewsprintColors.ruleFaint,
  },
});
