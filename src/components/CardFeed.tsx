import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { NewsprintColors } from '@/constants/theme';
import { CardStack, FeedItem } from './CardStack';
import { Layer } from './EventCard';
import { MOCK_AD } from './AdCard';
import { AgendaEvent } from '@/types/event';

interface Props {
  events: AgendaEvent[];
  startIndex: number;
  onClose: () => void;
  /** Called when the user swipes past the LAST card (deck finished). */
  onFinished?: () => void;
}

// Height reserved for the home screen's bottom nav that stays visible under
// the overlay — the swipe hint sits just above it, on the blur.
const NAV_SPACE = 78;

// Compact reader overlaid on the Home screen: home shows through, blurred,
// above and below the card; the bottom nav stays visible (rendered above us).
export function CardFeed({ events, startIndex, onClose, onFinished }: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [layer, setLayer] = useState<Layer>('summary');

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    events.forEach((e, i) => {
      items.push({ type: 'event', event: e });
      if ((i + 1) % 5 === 0 && i < events.length - 1) items.push({ type: 'ad', ad: MOCK_AD });
    });
    return items;
  }, [events]);

  const cardWidth = Math.min(winW * 0.88, 520);
  // Compact card: ~62% of the window — a touch taller top and bottom, but the
  // blurred home still peeks through. Clamped for small screens.
  const cardHeight = Math.min(Math.max(430, Math.round(winH * 0.62)), 680);

  const handleIndex = useCallback(
    (index: number) => {
      setLayer('summary');
      setActiveIndex(Math.max(0, Math.min(feedItems.length - 1, index)));
    },
    [feedItems.length]
  );

  return (
    <View style={styles.root}>
      {/* Blurred home backdrop + dark scrim for card contrast */}
      <BlurView intensity={34} tint="dark" style={styles.fill} />
      <View style={[styles.fill, styles.scrim]} />

      <View style={[styles.topBar, { marginTop: insets.top }]}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <Text style={styles.closeX}>×</Text>
        </Pressable>
        <Text style={styles.counter}>
          {Math.min(activeIndex + 1, events.length)} / {events.length}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stage}>
        <CardStack
          items={feedItems}
          activeIndex={activeIndex}
          layer={layer}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          onIndex={handleIndex}
          onLayerChange={setLayer}
          onClose={onClose}
          onEndReached={onFinished ?? onClose}
        />
      </View>

      {/* Swipe hint — sits on the blur, just above the visible bottom nav */}
      {activeIndex < feedItems.length - 1 && (
        <View style={[styles.swipeHint, { paddingBottom: NAV_SPACE + (insets.bottom || 8) }]} pointerEvents="none">
          <Text style={styles.swipeHintArrow}>⌄</Text>
          <Text style={styles.swipeHintText}>KAYDIR</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { backgroundColor: 'rgba(6, 5, 3, 0.45)' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { color: NewsprintColors.paper, fontSize: 30, lineHeight: 32 },
  counter: {
    color: NewsprintColors.paperMuted,
    fontFamily: 'Rubik_700Bold',
    fontSize: 13,
    letterSpacing: 2,
  },
  stage: { flex: 1, overflow: 'hidden' },
  swipeHint: {
    alignItems: 'center',
    paddingTop: 6,
    gap: 2,
  },
  swipeHintArrow: {
    color: NewsprintColors.paper,
    fontSize: 20,
    lineHeight: 18,
    fontFamily: 'Rubik_700Bold',
  },
  swipeHintText: {
    color: NewsprintColors.paper,
    fontFamily: 'Rubik_700Bold',
    fontSize: 9,
    letterSpacing: 3,
  },
});
