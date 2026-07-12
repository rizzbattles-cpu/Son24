import { View, Text, StyleSheet, Pressable } from 'react-native';
import { NewsprintColors, Fonts, Spacing } from '@/constants/theme';

/** Row below the category bar: a "deck of cards" button that jumps to the
 * full list (Açık Konular). Sits between categories and the content. */
export function SonOlaylarBar({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
        <View style={styles.deckIcon}>
          <View style={[styles.deckCard, styles.deckBack]} />
          <View style={[styles.deckCard, styles.deckMid]} />
          <View style={[styles.deckCard, styles.deckFront]} />
        </View>
        <Text style={styles.label} numberOfLines={1}>SON OLAYLAR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: NewsprintColors.ink,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: NewsprintColors.paperMuted,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnPressed: {
    backgroundColor: NewsprintColors.inkSoft,
    borderColor: NewsprintColors.paper,
  },
  label: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
  },
  deckIcon: {
    width: 16,
    height: 18,
    justifyContent: 'center',
  },
  deckCard: {
    position: 'absolute',
    width: 10,
    height: 14,
    borderRadius: 1.5,
    borderWidth: 1,
    borderColor: NewsprintColors.paper,
    backgroundColor: NewsprintColors.ink,
  },
  deckBack: { left: 5, top: 0, opacity: 0.45 },
  deckMid: { left: 2.5, top: 2, opacity: 0.7 },
  deckFront: { left: 0, top: 4, backgroundColor: NewsprintColors.inkSoft },
});
