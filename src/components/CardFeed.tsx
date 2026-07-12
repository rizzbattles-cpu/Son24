import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NewsprintColors } from '@/constants/theme';
import { CardStack, FeedItem } from './CardStack';
import { Layer } from './EventCard';
import { MOCK_AD } from './AdCard';
import { AgendaEvent } from '@/types/event';

interface Props {
  events: AgendaEvent[];
  startIndex: number;
  onClose: () => void;
}

// Full-screen card-swipe reader (Reels-style), opened from the Home screen.
export function CardFeed({ events, startIndex, onClose }: Props) {
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

  const cardWidth = Math.min(winW * 0.9, 540);
  // Sized from the window, not onLayout: react-native-web's onLayout on the
  // stage proved unreliable (never fired → cards never mounted). Top bar ≈56,
  // swipe hint ≈58, breathing room 40.
  const cardHeight = Math.max(340, winH - insets.top - insets.bottom - 56 - 58 - 40);

  const handleIndex = useCallback(
    (index: number) => {
      setLayer('summary');
      setActiveIndex(Math.max(0, Math.min(feedItems.length - 1, index)));
    },
    [feedItems.length]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
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
          onEndReached={onClose}
        />
      </View>

      {activeIndex < feedItems.length - 1 && (
        <View style={styles.swipeHint} pointerEvents="none">
          <Text style={styles.swipeHintArrow}>⌄</Text>
          <Text style={styles.swipeHintText}>KAYDIR</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NewsprintColors.ink },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    paddingTop: 10,
    paddingBottom: 18,
    gap: 2,
  },
  swipeHintArrow: {
    color: NewsprintColors.paperMuted,
    fontSize: 20,
    lineHeight: 18,
    fontFamily: 'Rubik_700Bold',
  },
  swipeHintText: {
    color: NewsprintColors.paperMuted,
    fontFamily: 'Rubik_700Bold',
    fontSize: 9,
    letterSpacing: 3,
  },
});
