import { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Pressable, Modal } from 'react-native';
import { CardPalette, CardFonts, Spacing } from '@/constants/theme';
import { AgendaEvent, StoryStep } from '@/types/event';

// Cut on a character budget (not word count) so long Turkish words don't blow
// past the line width. Always ends on a sentence stop or word boundary — never
// mid-word, never with an ellipsis.
function clampChars(text: string, maxChars: number) {
  if (!text) return text;
  const t = text.trim();
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const stop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  if (stop >= Math.floor(maxChars * 0.55)) return cut.slice(0, stop + 1);
  const space = cut.lastIndexOf(' ');
  return space >= Math.floor(maxChars * 0.55) ? cut.slice(0, space) + '.' : cut + '.';
}

function pickProfile(height: number, charLen: number) {
  const perLineTight = 18;
  const perLineNormal = 22;
  const tightThreshold = Math.max(0, height - 90) / perLineTight;
  const normalThreshold = Math.max(0, height - 90) / perLineNormal;
  if (charLen < normalThreshold * 40) return { ctx: 14, head: 15, detail: 13, line: 20, gap: 4 };
  if (charLen < tightThreshold * 40) return { ctx: 13, head: 14, detail: 12, line: 18, gap: 3 };
  return { ctx: 12, head: 13, detail: 11, line: 16, gap: 2 };
}

function TimelineStep({ step, isLast, z }: { step: StoryStep; isLast: boolean; z: ReturnType<typeof pickProfile> }) {
  return (
    <View style={[styles.step, { marginBottom: z.gap }]}>
      <View style={styles.dotCol}>
        <View style={[styles.dot, isLast && styles.dotNow]} />
        {!isLast && <View style={styles.line} />}
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.relative}>{step.relative.toUpperCase()}</Text>
        <Text style={[styles.headline, { fontSize: z.head, lineHeight: z.head + 3 }]}>
          {step.headline}
        </Text>
        <Text style={[styles.detail, { fontSize: z.detail, lineHeight: z.line }]}>
          {step.detail}
        </Text>
      </View>
    </View>
  );
}

export function StoryTimeline({ event }: { event: AgendaEvent }) {
  const [availableH, setAvailableH] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const onLayout = (e: LayoutChangeEvent) => setAvailableH(e.nativeEvent.layout.height);

  // These are safety caps only — the LLM is already asked to keep headline
  // ≤25 chars and detail ≤65 chars. When it obeys, the text ships as-is.
  const rawSteps = event.story.map((s) => ({
    ...s,
    headline: clampChars(s.headline, 40),
    detail: clampChars(s.detail, 90),
  }));

  const isTight = availableH > 0 && availableH < 240;
  const visibleSteps = isTight ? rawSteps.slice(0, 1) : rawSteps.slice(0, 2);
  const hasMore = rawSteps.length > visibleSteps.length;

  const now = clampChars(event.context.current ?? '', 110);
  const charLen =
    now.length + visibleSteps.reduce((n, s) => n + s.headline.length + s.detail.length, 0);
  const z = pickProfile(availableH || 320, charLen);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={styles.contextBox}>
        <Text style={styles.ctxLabel}>ŞU AN</Text>
        <Text style={[styles.ctxBody, { fontSize: z.ctx, lineHeight: z.line }]}>
          {now}
        </Text>
      </View>

      <Text style={styles.section}>OLAYIN AKIŞI</Text>

      <View style={styles.timeline}>
        {visibleSteps.map((step, i) => (
          <TimelineStep key={step.id} step={step} isLast={i === visibleSteps.length - 1} z={z} />
        ))}
      </View>

      {hasMore && (
        <Pressable
          onPress={() => setExpanded(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.expandBtn, pressed && styles.expandBtnPressed]}>
          <Text style={styles.expandLabel}>DEVAMINI GÖSTER</Text>
          <Text style={styles.expandArrow}>▾</Text>
        </Pressable>
      )}

      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setExpanded(false)}>
          <Pressable style={styles.modalPanel} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>OLAYIN TÜM AKIŞI</Text>
              <Pressable onPress={() => setExpanded(false)} hitSlop={12} style={styles.modalClose}>
                <Text style={styles.modalCloseX}>×</Text>
              </Pressable>
            </View>

            <View style={styles.contextBox}>
              <Text style={styles.ctxLabel}>ŞU AN</Text>
              <Text style={[styles.ctxBody, { fontSize: 14, lineHeight: 20 }]}>{now}</Text>
            </View>

            <Text style={styles.section}>OLAYIN AKIŞI</Text>
            <View style={styles.timeline}>
              {rawSteps.map((step, i) => (
                <TimelineStep
                  key={step.id}
                  step={step}
                  isLast={i === rawSteps.length - 1}
                  z={{ ctx: 14, head: 15, detail: 13, line: 20, gap: 6 }}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    overflow: 'hidden',
  },
  section: {
    color: CardPalette.textDim,
    fontFamily: CardFonts.sansBold,
    fontSize: 10,
    letterSpacing: 3,
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
    letterSpacing: 2,
    marginBottom: 4,
  },
  ctxBody: {
    color: CardPalette.text,
    fontFamily: CardFonts.body,
  },
  timeline: { paddingLeft: 4 },
  step: { flexDirection: 'row' },
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
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 1,
  },
  headline: {
    color: CardPalette.text,
    fontFamily: CardFonts.head,
    marginBottom: 1,
  },
  detail: {
    color: CardPalette.textMuted,
    fontFamily: CardFonts.body,
  },
  expandBtn: {
    marginTop: 6,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: CardPalette.rule,
    borderRadius: 3,
    backgroundColor: CardPalette.bgAlt,
  },
  expandBtnPressed: { opacity: 0.6 },
  expandLabel: {
    color: CardPalette.text,
    fontFamily: CardFonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
  },
  expandArrow: {
    color: CardPalette.kicker,
    fontSize: 14,
    fontFamily: CardFonts.sansBold,
    marginTop: -1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,5,3,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
  modalPanel: {
    backgroundColor: CardPalette.bg,
    borderWidth: 1.5,
    borderColor: CardPalette.border,
    borderRadius: 6,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 480,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    color: CardPalette.text,
    fontFamily: CardFonts.sansBold,
    fontSize: 12,
    letterSpacing: 3,
  },
  modalClose: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: CardPalette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CardPalette.bgAlt,
  },
  modalCloseX: {
    color: CardPalette.text,
    fontFamily: CardFonts.display,
    fontSize: 20,
    lineHeight: 22,
    marginTop: -1,
  },
});
