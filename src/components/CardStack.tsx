import { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';

// react-native-web whitelists scrollSnapType/scrollSnapAlign but strips
// scrollSnapStop, so inject it as a real CSS rule once (web only). Pages carry
// data-snapstop="always" via the dataSet prop.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'son24-snapstop';
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = '[data-snapstop="always"]{scroll-snap-stop:always}';
    document.head.appendChild(el);
  }
}

import { AgendaEvent } from '@/types/event';
import { EventCard, Layer } from './EventCard';
import { AdCard, AdData } from './AdCard';

export type FeedItem =
  | { type: 'event'; event: AgendaEvent }
  | { type: 'ad'; ad: AdData };

interface Props {
  items: FeedItem[];
  activeIndex: number;
  layer: Layer;
  cardWidth: number;
  cardHeight: number;
  /** Land on this exact card index (parent sets activeIndex to it). */
  onIndex: (index: number) => void;
  onLayerChange: (l: Layer) => void;
  onClose?: () => void;
  /** Called when the user swipes UP past the last card. */
  onEndReached?: () => void;
}

/**
 * Vertical paging reader on a plain ScrollView.
 *
 * Why not FlatList + onMomentumScrollEnd: react-native-web never fires
 * momentum events and ignores snapToInterval, which is exactly why the
 * counter froze and fast flings landed misaligned. Here every platform gets:
 *  - live index tracking via onScroll (fires everywhere)
 *  - CSS scroll-snap on web + snapToInterval on native for alignment
 *  - a settle timer that force-snaps to the nearest card if the scroll
 *    stops between pages (covers any browser that ignores snap)
 *  - a trailing spacer page: swiping past the last card closes the reader
 */
export function CardStack({
  items,
  activeIndex,
  layer,
  cardWidth,
  cardHeight,
  onIndex,
  onLayerChange,
  onClose,
  onEndReached,
}: Props) {
  const page = cardHeight;
  const scrollRef = useRef<ScrollView>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReported = useRef(activeIndex);
  const closing = useRef(false);
  const didInit = useRef(false);

  // Refs so the scroll handler never holds stale callbacks/state.
  const onIndexRef = useRef(onIndex);
  const onLayerChangeRef = useRef(onLayerChange);
  const onEndReachedRef = useRef(onEndReached);
  onIndexRef.current = onIndex;
  onLayerChangeRef.current = onLayerChange;
  onEndReachedRef.current = onEndReached;

  // Jump to the opening card once the content has its size (works on web,
  // where contentOffset/initialScrollIndex are unreliable).
  const handleContentSize = useCallback(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (lastReported.current > 0) {
      scrollRef.current?.scrollTo({ y: lastReported.current * page, animated: false });
    }
  }, [page]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const raw = Math.round(y / page);
      const idx = Math.max(0, Math.min(items.length - 1, raw));

      // Swiped past the last card into the spacer → close once. Trigger only
      // after the spacer is ~2/3 in view so the snap animation completes and
      // the "finished" moment reads cleanly (no mid-gesture jump-cut).
      if (y >= (items.length - 1) * page + page * 0.65 && !closing.current) {
        closing.current = true;
        onEndReachedRef.current?.();
        return;
      }

      // Live counter / active-card update the moment we cross into a new page.
      if (idx !== lastReported.current) {
        lastReported.current = idx;
        onLayerChangeRef.current('summary');
        onIndexRef.current(idx);
      }

      // Settle-snap: when scroll events stop for a beat and we're resting
      // between pages, glide to the nearest card. (Web fallback for browsers
      // that ignore scroll-snap; a no-op when already aligned.)
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        const target = idx * page;
        if (Math.abs(y - target) > 2 && !closing.current) {
          scrollRef.current?.scrollTo({ y: target, animated: true });
        }
      }, 120);
    },
    [page, items.length]
  );

  return (
    <View style={styles.stage}>
      <View style={{ width: cardWidth, height: page, overflow: 'hidden' }}>
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={handleContentSize}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          // Native alignment (ignored on web — CSS snap below covers it).
          pagingEnabled
          snapToInterval={page}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          // Web alignment: real CSS scroll-snap on the scroll container.
          style={{ scrollSnapType: 'y mandatory' } as object}
        >
          {items.map((it, index) => {
            const isActive = index === activeIndex;
            return (
              <View
                key={index}
                // snapStop 'always' (via injected CSS): a fling can never skip
                // past a card — exactly one card per swipe (native side:
                // disableIntervalMomentum does the same).
                {...({ dataSet: { snapstop: 'always' } } as object)}
                style={[
                  styles.page,
                  { width: cardWidth, height: page },
                  { scrollSnapAlign: 'start' } as object,
                ]}>
                {it.type === 'ad' ? (
                  <AdCard ad={it.ad} width={cardWidth} height={cardHeight} />
                ) : (
                  <EventCard
                    event={it.event}
                    layer={isActive ? layer : 'summary'}
                    width={cardWidth}
                    height={cardHeight}
                    onClose={isActive ? onClose : undefined}
                    onLayerChange={isActive ? onLayerChange : undefined}
                    interactive={isActive}
                  />
                )}
              </View>
            );
          })}
          {/* Trailing spacer — landing here closes the reader. A soft
              "finished" note shows for the moment before the close fires. */}
          <View
            {...({ dataSet: { snapstop: 'always' } } as object)}
            style={[
              { width: cardWidth, height: page, alignItems: 'center', justifyContent: 'center', gap: 8 },
              { scrollSnapAlign: 'start' } as object,
            ]}>
            <Text style={styles.endCheck}>✓</Text>
            <Text style={styles.endText}>SON HABERLER OKUNDU</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  page: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCheck: { color: '#d9b44a', fontSize: 34, lineHeight: 38 },
  endText: { color: '#d9b44a', fontSize: 12, letterSpacing: 3, fontFamily: 'Rubik_700Bold' },
});
