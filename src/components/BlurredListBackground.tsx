import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { NewsprintColors, Fonts, Spacing } from '@/constants/theme';
import { AgendaEvent } from '@/types/event';

/**
 * Faint, blurred list of headlines shown BEHIND the centered card stack, so
 * the user senses the full agenda list sitting behind the focused card.
 * Non-interactive.
 */
export function BlurredListBackground({ events }: { events: AgendaEvent[] }) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.list}>
        {events.slice(0, 12).map((e) => (
          <View key={e.id} style={styles.row}>
            <Text style={styles.kicker} numberOfLines={1}>
              {e.category.toUpperCase()}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {e.title}
            </Text>
            <View style={styles.rule} />
          </View>
        ))}
      </View>
      <BlurView intensity={18} tint="dark" style={styles.blur} pointerEvents="none" />
      <View style={styles.scrim} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    opacity: 0.4,
  },
  row: { marginBottom: Spacing.three },
  kicker: {
    color: NewsprintColors.accentSoft,
    fontFamily: Fonts.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 3,
  },
  title: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.serifHead,
    fontSize: 17,
    lineHeight: 21,
  },
  rule: {
    marginTop: Spacing.three,
    height: 1,
    backgroundColor: NewsprintColors.ruleFaint,
  },
  blur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,9,6,0.35)',
  },
});
