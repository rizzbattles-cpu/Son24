import { View, Text, StyleSheet } from 'react-native';
import { NewsprintColors, Fonts, Spacing } from '@/constants/theme';

export function SwipeHint() {
  return (
    <View style={styles.wrap}>
      <View style={styles.rule} />
      <Text style={styles.label}>OKUDUM</Text>
      <Text style={styles.arrow}>→</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  rule: { height: 1, width: 24, backgroundColor: NewsprintColors.ruleFaint },
  label: {
    color: NewsprintColors.paperMuted,
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 4,
  },
  arrow: {
    color: NewsprintColors.paperMuted,
    fontFamily: Fonts.serifDisplay,
    fontSize: 18,
    marginLeft: 2,
  },
});
