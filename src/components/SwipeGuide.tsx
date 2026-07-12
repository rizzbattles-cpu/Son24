import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

import { NewsprintColors, Fonts, Spacing } from '@/constants/theme';

/**
 * First-run onboarding overlay. Shows a hand/card sliding left ("sonraki") with
 * a hint to swipe. Dismisses on any tap. Rendered above the card stage.
 */
export function SwipeGuide({ onDismiss }: { onDismiss: () => void }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-48, { duration: 700, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [y]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Pressable style={styles.overlay} onPress={onDismiss}>
      <View style={styles.panel}>
        <Text style={styles.title}>NASIL GEZİLİR</Text>
        <View style={styles.doubleRule} />

        <View style={styles.demoCol}>
          <View style={styles.demoSide}>
            <Text style={styles.demoArrow}>↑</Text>
            <Text style={styles.demoLabel}>YUKARI KAYDIR · SONRAKİ</Text>
          </View>

          <Animated.View style={[styles.miniCard, cardStyle]}>
            <View style={styles.miniLine} />
            <View style={[styles.miniLine, { width: '60%' }]} />
            <View style={styles.miniBlock} />
          </Animated.View>

          <View style={styles.demoSide}>
            <Text style={styles.demoLabel}>AŞAĞI KAYDIR · ÖNCEKİ</Text>
            <Text style={styles.demoArrow}>↓</Text>
          </View>
        </View>

        <View style={styles.rule} />
        <Text style={styles.hint}>Kartın altındaki ÖZET · HİKAYE · KAYNAKLAR arasında dokunarak geçebilirsin.</Text>
        <Text style={styles.tapToStart}>BAŞLAMAK İÇİN DOKUN</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,5,3,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    paddingHorizontal: Spacing.four,
  },
  panel: {
    borderWidth: 1,
    borderColor: NewsprintColors.rule,
    backgroundColor: NewsprintColors.inkSoft,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  title: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.serifDisplay,
    fontSize: 26,
    letterSpacing: 2,
  },
  doubleRule: {
    height: 3,
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: NewsprintColors.rule,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  demoCol: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: Spacing.three,
  },
  demoSide: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  demoArrow: {
    color: NewsprintColors.accentSoft,
    fontFamily: Fonts.serifDisplay,
    fontSize: 30,
    marginBottom: 4,
  },
  demoLabel: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 15,
  },
  demoSub: {
    color: NewsprintColors.paperDim,
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 3,
    textAlign: 'center',
  },
  miniCard: {
    width: 70,
    height: 96,
    borderWidth: 1,
    borderColor: NewsprintColors.paperMuted,
    backgroundColor: NewsprintColors.paper,
    borderRadius: 3,
    padding: 8,
    gap: 5,
  },
  miniLine: {
    height: 4,
    width: '90%',
    backgroundColor: NewsprintColors.ink,
    opacity: 0.35,
    borderRadius: 2,
  },
  miniBlock: {
    marginTop: 4,
    flex: 1,
    backgroundColor: NewsprintColors.ink,
    opacity: 0.18,
    borderRadius: 2,
  },
  rule: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: NewsprintColors.ruleFaint,
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
  },
  hint: {
    color: NewsprintColors.paperMuted,
    fontFamily: Fonts.serifBody,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  tapToStart: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 3,
    marginTop: Spacing.three,
  },
});
