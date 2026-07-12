import { useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { NewsprintColors } from '@/constants/theme';

interface Props {
  index: number;
  total: number;
  onJump: (i: number) => void;
}

const DOT = 7;
const GAP = 6;

// Vertical page indicator pinned to the right edge (Reels-style).
export function DotBar({ index, total, onJump }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const y = Math.max(0, index * (DOT + GAP) - 90);
    scrollRef.current?.scrollTo({ y, animated: true });
  }, [index]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.col}>
        {Array.from({ length: total }).map((_, i) => {
          const active = i === index;
          return (
            <Pressable key={i} onPress={() => onJump(i)} hitSlop={6}>
              <View style={[styles.dot, active && styles.dotActive]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    maxHeight: '100%',
  },
  col: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: GAP,
    paddingVertical: 20,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1,
    borderColor: NewsprintColors.paperDim,
    backgroundColor: 'transparent',
  },
  dotActive: {
    width: DOT + 4,
    height: DOT + 4,
    borderRadius: (DOT + 4) / 2,
    backgroundColor: NewsprintColors.accent,
    borderColor: NewsprintColors.accent,
  },
});
