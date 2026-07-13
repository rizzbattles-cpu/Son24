import { View, Text, StyleSheet } from 'react-native';
import { CardPalette, CardFonts, Spacing } from '@/constants/theme';
import { AgendaEvent, StoryStep } from '@/types/event';

// The timeline lives inside the card's scrollable text box, so EVERY step is
// shown with its FULL text — no clamping, no "show more", no half sentences.
// Cards act as living summaries that keep growing as stories update.

function TimelineStep({ step, isLast }: { step: StoryStep; isLast: boolean }) {
  return (
    <View style={styles.step}>
      <View style={styles.dotCol}>
        <View style={[styles.dot, isLast && styles.dotNow]} />
        {!isLast && <View style={styles.line} />}
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.relative}>{step.relative.toUpperCase()}</Text>
        <Text style={styles.headline}>{step.headline}</Text>
        <Text style={styles.detail}>{step.detail}</Text>
      </View>
    </View>
  );
}

export function StoryTimeline({ event }: { event: AgendaEvent; compact?: boolean }) {
  const steps = event.story;
  const now = event.context.current ?? '';

  return (
    <View style={styles.wrap}>
      <View style={styles.contextBox}>
        <Text style={styles.ctxLabel}>ŞU AN</Text>
        <Text style={styles.ctxBody}>{now}</Text>
      </View>

      <Text style={styles.section}>OLAYIN AKIŞI</Text>

      <View style={styles.timeline}>
        {steps.map((step, i) => (
          <TimelineStep key={step.id} step={step} isLast={i === steps.length - 1} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  section: {
    color: CardPalette.textDim,
    fontFamily: CardFonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginVertical: Spacing.two,
  },
  contextBox: {
    borderWidth: 1,
    borderColor: CardPalette.rule,
    padding: Spacing.two,
    backgroundColor: CardPalette.bgAlt,
  },
  ctxLabel: {
    color: CardPalette.kicker,
    fontFamily: CardFonts.sansBold,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  ctxBody: {
    color: CardPalette.text,
    fontFamily: CardFonts.body,
    fontSize: 12.5,
    lineHeight: 19,
  },
  timeline: { paddingLeft: 4 },
  step: { flexDirection: 'row', marginBottom: 8 },
  dotCol: { alignItems: 'center', width: 22 },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: CardPalette.textMuted,
    backgroundColor: CardPalette.bg,
    marginTop: 5,
  },
  dotNow: {
    borderColor: CardPalette.kicker,
    backgroundColor: CardPalette.kicker,
  },
  line: {
    width: 1,
    flex: 1,
    backgroundColor: CardPalette.ruleFaint,
    marginTop: 2,
  },
  stepBody: { flex: 1, paddingLeft: Spacing.two },
  relative: {
    color: CardPalette.textMuted,
    fontFamily: CardFonts.sansBold,
    fontSize: 9.5,
    letterSpacing: 1,
    marginBottom: 1,
  },
  headline: {
    color: CardPalette.text,
    fontFamily: CardFonts.head,
    fontSize: 13.5,
    lineHeight: 18,
    marginBottom: 2,
  },
  detail: {
    color: CardPalette.textMuted,
    fontFamily: CardFonts.body,
    fontSize: 12.5,
    lineHeight: 19,
  },
});
