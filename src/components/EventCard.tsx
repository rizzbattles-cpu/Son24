import { View, Text, StyleSheet, Pressable, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { CardPalette, CardFonts, Spacing } from '@/constants/theme';
import { AgendaEvent } from '@/types/event';
import { SourceList } from './SourceList';
import { StoryTimeline } from './StoryTimeline';

const PAPER_TEXTURE = require('../../assets/images/crumpled-paper.png');
// alias so texture <Image> (RN native) doesn't collide with expo-image
const RNImageComponent = RNImage;

// Print-look palette tuned to the reference screenshot: the whole card is
// aged cream paper with a thin dark frame — no dark strip.
const PAPER = '#ece0c2'; // warm aged cream paper
const INK = '#231b0e'; // headline / body / date ink
const RED = '#96523d'; // category heading + short separator line
const RULE = '#b9a678'; // hairline / dashed rules
const FRAME = '#2a2114'; // thin dark border around the card

export type Layer = 'summary' | 'sources' | 'story';

// Scale the headline down as it gets longer so it always fits without being
// truncated — no "…", no clipped text, on any screen size.
function titleSizing(title: string) {
  const n = title.length;
  if (n <= 34) return { fontSize: 27, lineHeight: 32 };
  if (n <= 52) return { fontSize: 24, lineHeight: 29 };
  if (n <= 72) return { fontSize: 22, lineHeight: 27 };
  if (n <= 96) return { fontSize: 19, lineHeight: 24 };
  return { fontSize: 17, lineHeight: 22 };
}

const M_LONG = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
function fmtMastheadDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getDate()} ${M_LONG[d.getMonth()]} ${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Same idea for the summary body — shrink long summaries so they fit the card
// without an ellipsis. (Text is already word-capped upstream.)
function summarySizing(summary: string) {
  const n = summary.length;
  if (n <= 150) return { fontSize: 16, lineHeight: 24 };
  if (n <= 210) return { fontSize: 14.5, lineHeight: 22 };
  return { fontSize: 13, lineHeight: 20 };
}

const LAYERS: { key: Layer; label: string }[] = [
  { key: 'summary', label: 'ÖZET' },
  { key: 'story', label: 'HİKAYE' },
  { key: 'sources', label: 'KAYNAKLAR' },
];

interface Props {
  event: AgendaEvent;
  layer?: Layer;
  width: number;
  height: number;
  onClose?: () => void;
  onLayerChange?: (l: Layer) => void;
  interactive?: boolean;
  issueNumber?: number;
}

export function EventCard({
  event,
  layer = 'summary',
  width,
  height,
  onClose,
  onLayerChange,
  interactive = true,
}: Props) {
  const isSummary = layer === 'summary';
  const showPhoto = isSummary && !!event.imageUrl;
  // Photo takes a slice of the card; smaller on short/compact cards so the
  // title, summary and the bottom tabs always have room (never overlap).
  const photoH = Math.max(100, Math.min(Math.round(height * 0.27), 160));

  return (
    <View style={[styles.card, { width, height }]}>
      {/* Paper content area — whole card is paper */}
      <View style={styles.paper}>
        <RNImageComponent source={PAPER_TEXTURE} style={styles.texture} resizeMode="cover" />

        {/* Masthead on paper: red category (left) · dark date (right) */}
        <View style={styles.strip}>
          <Text style={styles.stripCat}>{event.category.toUpperCase()}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.stripDate}>{fmtMastheadDate(event.updatedAt)}</Text>
          {onClose && (
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.stripRule} />

        {/* Headline (above the photo) */}
        <View style={styles.pad}>
          <Text style={[styles.title, titleSizing(event.title)]} numberOfLines={5}>
            {event.title}
          </Text>
        </View>

        {/* Short separator line — floats between title and content, touching neither */}
        <View style={styles.sepLine} />

        {isSummary ? (
          <View style={styles.body}>
            {/* Photo immediately after the red strip */}
            {showPhoto && (
              <Image
                source={{ uri: event.imageUrl }}
                style={[styles.photo, { height: photoH }]}
                contentFit="cover"
                contentPosition="top"
                transition={0}
                cachePolicy="memory-disk"
              />
            )}
            {/* Summary under the photo — fits without overflow */}
            <View style={styles.pad}>
              <View style={styles.dashRule} />
              <Text style={[styles.summary, summarySizing(event.summary)]}>{event.summary}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.body, styles.pad, styles.layerBody]}>
            {layer === 'sources' ? (
              <SourceList sources={event.sources} eventId={event.id} />
            ) : (
              <StoryTimeline event={event} compact={height < 540} />
            )}
          </View>
        )}

        {/* Footer bar: ÖZET / HİKAYE / KAYNAKLAR tabs · share + bookmark */}
        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <View style={styles.footerRow}>
            <View style={styles.tabs}>
              {LAYERS.map((l) => {
                const on = l.key === layer;
                return (
                  <Pressable
                    key={l.key}
                    onPress={() => interactive && onLayerChange?.(l.key)}
                    disabled={!interactive}
                    style={styles.tab}>
                    <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{l.label}</Text>
                    {on && <View style={styles.tabUnderline} />}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.footerIcons}>
              <Ionicons name="share-social-outline" size={18} color={INK} />
              <Ionicons name="bookmark-outline" size={18} color={INK} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PAPER,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: FRAME,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 24,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  stripRule: { height: 1, backgroundColor: FRAME, marginHorizontal: 0 },
  stripCat: { color: RED, fontFamily: CardFonts.sansBold, fontSize: 13, letterSpacing: 2.5 },
  stripDate: { color: INK, fontFamily: CardFonts.sansMed, fontSize: 10.5, letterSpacing: 0.5 },
  closeBtn: { marginLeft: 2, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  closeX: { color: INK, fontSize: 22, lineHeight: 22, marginTop: -2 },
  paper: { flex: 1, backgroundColor: PAPER, overflow: 'hidden' },
  texture: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    width: '100%', height: '100%',
    opacity: 0.35,
  },
  pad: { paddingHorizontal: 18 },
  title: {
    color: INK,
    fontFamily: CardFonts.display,
    fontWeight: '800', // a touch bolder (web synthesizes; native uses the 700 file)
    letterSpacing: -0.2,
    paddingTop: 14,
    paddingBottom: 12,
  },
  sepLine: {
    marginLeft: 18, // align with the title's first letters
    width: 120, // ends around the middle, never touching the right edge
    height: 3,
    borderRadius: 2,
    backgroundColor: RED,
    marginTop: 2,
    marginBottom: 14,
  },
  body: { flex: 1, overflow: 'hidden' },
  layerBody: { paddingTop: 8 },
  photo: { width: '100%', backgroundColor: CardPalette.bgAlt },
  dashRule: {
    marginTop: 14,
    marginBottom: 12,
    height: 0,
    borderBottomWidth: 1,
    borderColor: RULE,
    borderStyle: 'dashed',
  },
  summary: { color: INK, fontFamily: CardFonts.serifBody, fontWeight: '600' },
  // Footer
  footer: { backgroundColor: PAPER, zIndex: 5 },
  footerRule: { height: 1, backgroundColor: RULE },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
  },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tab: { alignItems: 'center' },
  tabLabel: { color: '#6b5c3f', fontFamily: CardFonts.sansBold, fontSize: 12, letterSpacing: 2 },
  tabLabelOn: { color: INK },
  tabUnderline: { marginTop: 4, width: 16, height: 2, borderRadius: 1, backgroundColor: RED },
  footerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
