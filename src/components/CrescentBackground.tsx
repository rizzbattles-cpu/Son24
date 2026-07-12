import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { NewsprintColors } from '@/constants/theme';

// Turkish flag ay-yıldız (crescent + star) built to the official geometry:
//   - outer white circle, offset inner circle carves the crescent (opens right)
//   - 5-point star to the right, one vertex facing left into the crescent,
//     symmetric about the horizontal axis.
// Rendered as a faint white silhouette on the dark background.

const INK = NewsprintColors.ink;

// Star geometry — computed so it's perfectly regular (no lopsidedness).
function starPath(cx: number, cy: number, outer: number) {
  const inner = outer * 0.382; // regular pentagram ratio
  // One outer point faces left (180°); symmetric about horizontal axis.
  const outerAngles = [180, 108, 36, -36, -108];
  const pts: string[] = [];
  outerAngles.forEach((oa, i) => {
    const oRad = (oa * Math.PI) / 180;
    pts.push(`${(cx + outer * Math.cos(oRad)).toFixed(2)},${(cy - outer * Math.sin(oRad)).toFixed(2)}`);
    // inner vertex 36° clockwise from this outer point
    const ia = oa - 36;
    const iRad = (ia * Math.PI) / 180;
    pts.push(`${(cx + inner * Math.cos(iRad)).toFixed(2)},${(cy - inner * Math.sin(iRad)).toFixed(2)}`);
  });
  return `M${pts.join(' L')} Z`;
}

// viewBox 0 0 1200 800 (flag is 3:2). Official-ish proportions.
const OUTER = { cx: 440, cy: 400, r: 200 };
const INNER = { cx: 510, cy: 400, r: 160 };
const STAR = { cx: 730, cy: 400, r: 105 };

const FLAG_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'>
  <circle cx='${OUTER.cx}' cy='${OUTER.cy}' r='${OUTER.r}' fill='#ffffff'/>
  <circle cx='${INNER.cx}' cy='${INNER.cy}' r='${INNER.r}' fill='${INK}'/>
  <path d='${starPath(STAR.cx, STAR.cy, STAR.r)}' fill='#ffffff'/>
</svg>`;

const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(FLAG_SVG)}`;

export function CrescentBackground({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Image
        source={{ uri: dataUri }}
        style={[styles.image, { opacity }]}
        contentFit="contain"
        transition={0}
      />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '52%',
    height: '38%',
    maxWidth: 320,
  },
});
