import { View, Text, StyleSheet, Pressable, Linking, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { CardPalette, CardFonts, Spacing } from '@/constants/theme';

const PAPER_TEXTURE = require('../../assets/images/crumpled-paper.png');

export interface AdData {
  id: string;
  brand: string;
  title: string;
  body: string;
  imageUrl: string;
  cta: string;
  url: string;
}

// Single mock ad reused throughout the feed until real ad placement lands.
export const MOCK_AD: AdData = {
  id: 'ad-mock-1',
  brand: 'DEMİRTAŞ KAHVE',
  title: 'Evinizde barista lezzeti',
  body:
    'El yakımı çekirdekler, taze öğütülmüş kahve. İlk siparişinizde %20 indirim ve ücretsiz kargo fırsatını kaçırmayın.',
  imageUrl: 'https://picsum.photos/seed/gundemcoffee/600/320',
  cta: 'ÜRÜNE GİT',
  url: 'https://example.com',
};

export function AdCard({ ad, width, height }: { ad: AdData; width: number; height: number }) {
  return (
    <View style={[styles.card, { width, height }]}>
      <RNImage source={PAPER_TEXTURE} style={styles.texture} resizeMode="cover" />
      <View style={styles.tint} pointerEvents="none" />

      <Text style={styles.reklam}>REKLAM</Text>

      <View style={styles.body}>
        <Text style={styles.brand}>{ad.brand.toUpperCase()}</Text>
        <Text style={styles.title}>{ad.title}</Text>
        <Text style={styles.text}>{ad.body}</Text>

        <Image source={{ uri: ad.imageUrl }} style={styles.image} contentFit="cover" transition={120} />
      </View>

      <Pressable
        onPress={() => Linking.openURL(ad.url)}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
        <Text style={styles.ctaText}>{ad.cta} →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CardPalette.bg,
    borderWidth: 1.5,
    borderColor: CardPalette.border,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.75,
    shadowRadius: 30,
    elevation: 24,
  },
  texture: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CardPalette.bg,
    opacity: 0.3,
  },
  reklam: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 5,
    color: CardPalette.textMuted,
    fontFamily: CardFonts.sansBold,
    fontSize: 9,
    letterSpacing: 3,
    borderWidth: 1,
    borderColor: CardPalette.rule,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: 44,
    justifyContent: 'center',
  },
  brand: {
    color: CardPalette.kicker,
    fontFamily: CardFonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: Spacing.two,
  },
  title: {
    color: CardPalette.text,
    fontFamily: CardFonts.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: Spacing.three,
  },
  text: {
    color: CardPalette.text,
    fontFamily: CardFonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
  image: {
    width: '100%',
    height: 150,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: CardPalette.rule,
    backgroundColor: CardPalette.bgAlt,
  },
  cta: {
    margin: Spacing.three,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: CardPalette.text,
    borderRadius: 3,
  },
  ctaPressed: { opacity: 0.8 },
  ctaText: {
    color: CardPalette.bg,
    fontFamily: CardFonts.sansBold,
    fontSize: 13,
    letterSpacing: 2,
  },
});
