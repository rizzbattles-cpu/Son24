import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Gold } from '@/constants/theme';
import { AgendaEvent, Category } from '@/types/event';
import { loadTop24, isBreakingEvent } from '@/services/db';
import { CardFeed } from '@/components/CardFeed';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const M_ABBR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

type CatKey = Category | 'Tümü' | 'Son Dakika';

const CATEGORIES: { key: CatKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'Tümü', label: 'Tümü', icon: 'grid-outline' },
  { key: 'Son Dakika', label: 'Son Dakika', icon: 'flash-outline' },
  { key: 'Siyaset', label: 'Siyaset', icon: 'people-outline' },
  { key: 'Ekonomi', label: 'Ekonomi', icon: 'trending-up-outline' },
  { key: 'Dış Politika', label: 'Dış Politika', icon: 'globe-outline' },
  { key: 'Güvenlik', label: 'Güvenlik', icon: 'shield-outline' },
  { key: 'Afet', label: 'Afet', icon: 'warning-outline' },
  { key: 'Resmî Gazete', label: 'Resmî Gazete', icon: 'document-text-outline' },
];

const CAT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Siyaset: 'people',
  Ekonomi: 'trending-up',
  'Dış Politika': 'globe',
  Güvenlik: 'shield',
  Afet: 'warning',
  Teknoloji: 'hardware-chip',
  Sağlık: 'medkit',
  Çevre: 'leaf',
  Eğitim: 'school',
  Spor: 'football',
  'Resmî Gazete': 'document-text',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [liveEvents, setLiveEvents] = useState<AgendaEvent[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<CatKey>('Tümü');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [cardOpen, setCardOpen] = useState(false);
  const [cardStart, setCardStart] = useState(0);
  const [cardEvents, setCardEvents] = useState<AgendaEvent[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const scrollRef = useRef<ScrollView>(null);
  // Day-section nodes, measured on demand (measureLayout) — reliable everywhere,
  // unlike onLayout which some web environments never fire.
  const dayRefs = useRef<Record<string, unknown>>({});

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    try {
      const list = await loadTop24();
      setLiveEvents(list ?? []);
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allEvents = liveEvents ?? [];

  // Distinct days present in the data, newest first (for the date tabs).
  const days = useMemo(() => {
    const seen = new Map<string, Date>();
    allEvents.forEach((e) => {
      const d = new Date(e.updatedAt);
      const k = dayKey(d);
      if (!seen.has(k)) seen.set(k, d);
    });
    return [...seen.entries()]
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .map(([k, d]) => ({ key: k, date: d }));
  }, [allEvents]);

  // Category filter only — the list spans all days, grouped by date below.
  const feed = useMemo(() => {
    if (category === 'Tümü') return allEvents;
    if (category === 'Son Dakika') return allEvents.filter(isBreakingEvent);
    return allEvents.filter((e) => e.category === category);
  }, [allEvents, category]);

  // The swipe deck is the top-20 most important events (only). The Açık Konular
  // list can show more, but the "cards" are gated to 20.
  const cards = useMemo(() => feed.slice(0, 20), [feed]);
  const featured = feed[0];
  const rest = feed.slice(1);

  // Load-more: reveal the first N of the remaining, grouped by day.
  const visibleRest = rest.slice(0, visibleCount);
  const grouped = useMemo(() => {
    const map = new Map<string, { date: Date; items: AgendaEvent[] }>();
    visibleRest.forEach((e) => {
      const d = new Date(e.updatedAt);
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, { date: d, items: [] });
      map.get(k)!.items.push(e);
    });
    return [...map.entries()]
      .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
      .map(([k, v]) => ({ key: k, date: v.date, items: v.items }));
  }, [visibleRest]);

  const scrollToDay = useCallback((k: string) => {
    // Glide to the day section. On web the ref IS the DOM element, so native
    // scrollIntoView is the most reliable path; native RN uses measureLayout.
    const attempt = () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const node = dayRefs.current[k] as any;
      const sv = scrollRef.current as any;
      if (!node || !sv) return false;
      if (typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Some environments silently ignore smooth scrolling — if the section
        // hasn't moved into view shortly after, jump instantly instead.
        setTimeout(() => {
          const r = node.getBoundingClientRect?.();
          if (r && (r.top > 400 || r.top < -100)) node.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 700);
        return true;
      }
      const inner = sv.getInnerViewNode?.();
      if (!inner || typeof node.measureLayout !== 'function') return false;
      node.measureLayout(
        inner,
        (_x: number, y: number) => sv.scrollTo({ y: Math.max(0, y - 8), animated: true }),
        () => {}
      );
      return true;
      /* eslint-enable @typescript-eslint/no-explicit-any */
    };
    if (attempt()) return;
    // Day hidden behind "DAHA FAZLA GÖSTER" — reveal the whole list, then keep
    // trying until the section mounts (≤2.5s), and glide straight to it.
    setVisibleCount(Number.MAX_SAFE_INTEGER);
    let tries = 0;
    const iv = setInterval(() => {
      if (attempt() || ++tries > 25) clearInterval(iv);
    }, 100);
  }, []);

  const { headerDate, headerDay } = useMemo(() => {
    const d = new Date();
    const p = (n: number) => n.toString().padStart(2, '0');
    const DAYS = ['PAZAR', 'PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ'];
    return {
      headerDate: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`,
      headerDay: DAYS[d.getDay()],
    };
  }, []);

  const openCards = useCallback((events: AgendaEvent[], idx: number) => {
    setCardEvents(events);
    setCardStart(Math.max(0, idx));
    setCardOpen(true);
  }, []);

  // Logo / "Tümü" tap: refresh data and reset to the top of the home feed.
  const goHome = useCallback(() => {
    setCardOpen(false);
    setCategory('Tümü');
    setVisibleCount(12);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    load(true);
  }, [load]);

  // "Breathing" attention pulse for the BAŞLAMAK İÇİN DOKUN teaser.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const teaserScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.02 }],
  }));
  const teaserGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.5,
  }));

  // Search: live matches across the whole archive (title + summary).
  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLocaleLowerCase('tr-TR');
    if (q.length < 2) return [];
    return allEvents
      .filter((e) => `${e.title} ${e.summary}`.toLocaleLowerCase('tr-TR').includes(q))
      .slice(0, 30);
  }, [allEvents, searchQ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header — symmetric: SAYI (left) · SON 24 (center) · date+day (right) */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Text style={styles.headerSayi}>V1.0</Text>
        </View>
        <Pressable style={styles.brandWrap} onPress={goHome} hitSlop={8}>
          <Image source={require('../../assets/images/son24-logo.png')} style={styles.brandLogo} contentFit="contain" />
        </Pressable>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <Text style={styles.headerDateText}>{headerDate}</Text>
          <Text style={styles.headerDayText}>{headerDay}</Text>
        </View>
      </View>

      {/* Fixed menu — date tabs + categories stay put; the list scrolls under */}
      <View style={styles.fixedMenu}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
          {days.map(({ key, date }) => (
            <Pressable key={key} onPress={() => scrollToDay(key)} style={styles.dateChip}>
              <Text style={styles.dateChipText}>
                {date.getDate()} {M_ABBR[date.getMonth()]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((c, i) => {
            const on = c.key === category;
            return (
              <Pressable
                key={c.label + i}
                onPress={() => {
                  if (c.key === 'Tümü') {
                    goHome();
                    return;
                  }
                  // Category tap: open that category's card deck first; when
                  // the cards run out the reader closes into the list view.
                  setCategory(c.key);
                  setVisibleCount(12);
                  const catCards = (
                    c.key === 'Son Dakika'
                      ? allEvents.filter(isBreakingEvent)
                      : allEvents.filter((e) => e.category === c.key)
                  ).slice(0, 20);
                  if (catCards.length > 0) openCards(catCards, 0);
                }}
                style={styles.catItem}>
                <View style={[styles.catCircle, on && styles.catCircleOn]}>
                  <Ionicons name={c.icon} size={22} color={on ? Gold.bg : Gold.gold} />
                </View>
                <Text style={[styles.catLabel, on && styles.catLabelOn]} numberOfLines={1}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.menuRule} />
      </View>

      {status === 'loading' && allEvents.length === 0 ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Gold.gold} size="large" />
          <Text style={styles.centerText}>Gündem yükleniyor…</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.centerFill}>
          <Ionicons name="cloud-offline-outline" size={40} color={Gold.textMuted} />
          <Text style={styles.centerText}>Bağlantı kurulamadı.</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>TEKRAR DENE</Text>
          </Pressable>
        </View>
      ) : (
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Gold.gold} colors={[Gold.gold]} />
        }>
        {/* Blurred card deck teaser — breathing glow, tap to enter the reader */}
        {cards.length > 0 && (
          <Animated.View style={teaserScaleStyle}>
            <Pressable style={styles.teaser} onPress={() => openCards(cards, 0)}>
              <View style={styles.teaserStack}>
                <View style={[styles.teaserCard, styles.teaserCardBack]} />
                <View style={[styles.teaserCard, styles.teaserCardMid]} />
                <View style={[styles.teaserCard, styles.teaserCardFront]}>
                  <Image
                    source={require('../../assets/images/teaser-gazete.png')}
                    style={styles.teaserImgFull}
                    contentFit="cover"
                    contentPosition="top"
                  />
                </View>
              </View>
              <BlurView intensity={28} tint="dark" style={styles.teaserBlur} pointerEvents="none" />
              {/* Soft white light around the edges — pulses like a breath */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.teaserGlow,
                  { boxShadow: '0 0 26px 5px rgba(255,255,255,0.38), inset 0 0 18px rgba(255,255,255,0.22)' } as object,
                  teaserGlowStyle,
                ]}
              />
              <View style={styles.teaserOverlay} pointerEvents="none">
                <View style={styles.teaserPlay}>
                  <Ionicons name="play" size={22} color={Gold.bg} />
                </View>
                <Text style={styles.teaserText}>BAŞLAMAK İÇİN DOKUN</Text>
                <Text style={styles.teaserSub}>{cards.length} önemli olay · kaydırarak oku</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Featured */}
        {featured && (
          <>
            <Text style={styles.sectionLabel}>ÖNE ÇIKAN OLAY</Text>
            <Pressable style={styles.featured} onPress={() => openCards(cards, 0)}>
              {featured.imageUrl && (
                <Image source={{ uri: featured.imageUrl }} style={styles.featuredImg} contentFit="cover" contentPosition="top" />
              )}
              <View style={styles.featuredBody}>
                <View style={styles.featuredTagRow}>
                  <Text style={styles.featuredTag}>{featured.category.toUpperCase()}</Text>
                  <Text style={styles.featuredTime}>{fmtTime(featured.updatedAt)}</Text>
                </View>
                <Text style={styles.featuredTitle} numberOfLines={3}>{featured.title}</Text>
                <Text style={styles.featuredSub} numberOfLines={2}>{featured.summary}</Text>
                <View style={styles.featuredMeta}>
                  <Text style={styles.metaText}>{featured.readSeconds} SN OKUMA</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{featured.sources.length} KAYNAK</Text>
                  <View style={{ flex: 1 }} />
                  <Ionicons name="bookmark-outline" size={16} color={Gold.textMuted} />
                </View>
              </View>
            </Pressable>
          </>
        )}

        {/* Açık Konular — grouped by date */}
        {rest.length > 0 && <Text style={styles.sectionLabel}>AÇIK KONULAR</Text>}
        {(() => {
          let n = 0; // running item counter across all day groups (for ads)
          return grouped.map((g) => (
            <View
              key={g.key}
              ref={(r) => { dayRefs.current[g.key] = r; }}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{g.date.getDate()} {MONTHS[g.date.getMonth()]}</Text>
                <View style={styles.dayHeaderLine} />
              </View>
              {g.items.map((e) => {
                const idx = feed.findIndex((x) => x.id === e.id);
                n += 1;
                const showAd = n % 6 === 0;
                return (
                  <View key={e.id}>
                    <Pressable style={styles.row} onPress={() => openCards(feed, idx)}>
                      <View style={styles.rowThumbWrap}>
                        {e.imageUrl ? (
                          <Image source={{ uri: e.imageUrl }} style={styles.rowThumb} contentFit="cover" contentPosition="top" />
                        ) : (
                          <Ionicons name={CAT_ICON[e.category] ?? 'document-text'} size={22} color={Gold.gold} />
                        )}
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowCat}>{e.category.toUpperCase()}</Text>
                        <Text style={styles.rowTitle} numberOfLines={2}>{e.title}</Text>
                        <View style={styles.rowMeta}>
                          <Text style={styles.rowMetaText}>{fmtTime(e.updatedAt)}</Text>
                          <Text style={styles.metaDot}>·</Text>
                          <Text style={styles.rowMetaText}>{e.readSeconds} SN OKUMA</Text>
                        </View>
                      </View>
                    </Pressable>
                    {showAd && (
                      <View style={styles.adRow}>
                        <Text style={styles.adRowText}>REKLAM</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ));
        })()}

        {rest.length > visibleCount && (
          <Pressable style={styles.loadMore} onPress={() => setVisibleCount((n) => n + 12)}>
            <Text style={styles.loadMoreText}>DAHA FAZLA GÖSTER</Text>
            <Ionicons name="chevron-down" size={16} color={Gold.gold} />
          </Pressable>
        )}

        {feed.length === 0 && <Text style={styles.empty}>Bu kategoriye ait olay yok.</Text>}
      </ScrollView>
      )}

      {/* Card reader — inline overlay UNDER the bottom nav (nav stays visible).
          Home shows through blurred above/below the compact card. */}
      {cardOpen && (
        <View style={styles.readerOverlay}>
          <CardFeed events={cardEvents} startIndex={cardStart} onClose={() => setCardOpen(false)} />
        </View>
      )}

      {/* Search overlay — light blur over the app, search bar on top, live list */}
      {searchOpen && (
        <View style={styles.readerOverlay}>
          <BlurView intensity={26} tint="dark" style={styles.fillAbs} />
          <View style={[styles.fillAbs, { backgroundColor: 'rgba(5,5,4,0.45)' }]} />
          <View style={{ flex: 1, paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
            <View style={styles.searchBarRow}>
              <Ionicons name="search" size={18} color={Gold.gold} />
              <TextInput
                value={searchQ}
                onChangeText={setSearchQ}
                placeholder="Haberlerde ara..."
                placeholderTextColor={Gold.textDim}
                style={styles.searchInput}
                autoFocus
              />
              <Pressable onPress={() => { setSearchOpen(false); setSearchQ(''); }} hitSlop={10}>
                <Text style={styles.searchClose}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1, marginTop: 12 }} keyboardShouldPersistTaps="handled">
              {searchResults.map((e) => {
                const idx = feed.findIndex((x) => x.id === e.id);
                return (
                  <Pressable
                    key={e.id}
                    style={styles.searchRow}
                    onPress={() => {
                      setSearchOpen(false);
                      setSearchQ('');
                      openCards(idx >= 0 ? feed : [e], Math.max(0, idx));
                    }}>
                    <Text style={styles.rowCat}>{e.category.toUpperCase()}</Text>
                    <Text style={styles.rowTitle} numberOfLines={2}>{e.title}</Text>
                    <Text style={styles.rowMetaText}>{fmtTime(e.updatedAt)}</Text>
                  </Pressable>
                );
              })}
              {searchQ.trim().length >= 2 && searchResults.length === 0 && (
                <Text style={styles.empty}>Sonuç bulunamadı</Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Bottom nav */}
      <View style={[styles.nav, { paddingBottom: insets.bottom || 8 }]}>
        <NavItem icon="home" label="Ana Sayfa" active onPress={() => { setCardOpen(false); setSearchOpen(false); }} />
        <NavItem icon="search-outline" label="Ara" onPress={() => { setCardOpen(false); setSearchOpen(true); }} />
        <Pressable style={styles.navCenter} onPress={() => cards.length > 0 && openCards(cards, 0)}>
          <View style={styles.navCenterCircle}>
            <Text style={styles.navCenterText}>24</Text>
          </View>
        </Pressable>
        <BrandNavItem />
        <NavItem icon="person-outline" label="Profil" onPress={() => { setCardOpen(false); router.push('/profil'); }} />
      </View>
    </View>
  );
}

function NavItem({ icon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={styles.navItem} hitSlop={6} onPress={onPress}>
      <Ionicons name={icon} size={20} color={active ? Gold.gold : Gold.textDim} />
      <Text style={[styles.navLabel, active && styles.navLabelOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// "Marka Fırsatları" — barber-pole style attention button: brand logos spin
// like a 360° hologram (coin-flip on the Y axis, cycling through logos).
// Same footprint and alignment as the other nav items.
const BRAND_ICONS: (keyof typeof Ionicons.glyphMap)[] = ['pricetags', 'gift', 'sparkles'];

function BrandNavItem({ onPress }: { onPress?: () => void }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    // Continuous spin at 1.5× the original pace (360°/1.2s), never pauses.
    // 1080° per timing cycle so the wrap 1080→0 lands on the same logo facing
    // the same way — seamless.
    spin.value = withRepeat(withTiming(1080, { duration: 3600, easing: Easing.linear }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Logo swaps happen at the EDGE-ON angles (90°/270°, width ≈ 0) so the
  // change is invisible — no static pop. Opacity eases down toward the edge
  // for a fast motion-blur feel.
  const mkFace = (i: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const idx = Math.floor(((spin.value + 90) % 1080) / 180) % 3;
      const facing = Math.abs(Math.cos(((spin.value % 360) * Math.PI) / 180));
      return {
        opacity: idx === i ? 0.45 + 0.55 * facing : 0,
        transform: [{ perspective: 300 }, { rotateY: `${spin.value % 360}deg` }],
      };
    });
  const faces = [mkFace(0), mkFace(1), mkFace(2)];
  return (
    <Pressable style={styles.navItem} hitSlop={6} onPress={onPress}>
      <View style={styles.brandSpinBox}>
        {BRAND_ICONS.map((ic, i) => (
          <Animated.View key={ic} style={[styles.brandFace, faces[i]]}>
            <Ionicons name={ic} size={20} color={Gold.gold} />
          </Animated.View>
        ))}
      </View>
      <Text style={styles.navLabel} numberOfLines={1}>Marka Fırsatları</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Gold.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
  },
  headerSide: { width: 96, justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  headerSayi: { color: Gold.textMuted, fontFamily: 'Rubik_700Bold', fontSize: 12, letterSpacing: 1 },
  brandWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandLogo: { width: 190, height: 110 },
  headerDateText: { color: Gold.gold, fontFamily: 'Rubik_700Bold', fontSize: 11, letterSpacing: 0.4 },
  headerDayText: { color: Gold.textMuted, fontFamily: 'Rubik_500Medium', fontSize: 8, letterSpacing: 1.2, marginTop: 2 },

  fixedMenu: { backgroundColor: Gold.bg, marginTop: -16 },
  menuRule: { height: 1, backgroundColor: Gold.line, marginTop: 4 },
  dateRow: { paddingHorizontal: 16, gap: 10, paddingVertical: 4 },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Gold.gold, // outline only — no fill
  },
  dateChipOn: { backgroundColor: Gold.gold },
  dateChipText: { color: Gold.textMuted, fontFamily: 'Rubik_700Bold', fontSize: 12, letterSpacing: 1 },
  dateChipTextOn: { color: Gold.bg },

  catRow: { paddingHorizontal: 16, gap: 16, paddingVertical: 10 },
  catItem: { alignItems: 'center', width: 62, gap: 6 },
  catCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Gold.line,
    backgroundColor: Gold.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCircleOn: { backgroundColor: Gold.gold, borderColor: Gold.gold },
  catLabel: { color: Gold.textMuted, fontFamily: 'Rubik_500Medium', fontSize: 10, textAlign: 'center' },
  catLabelOn: { color: Gold.gold, fontFamily: 'Rubik_700Bold' },

  sectionLabel: {
    color: Gold.textMuted,
    fontFamily: 'Rubik_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 6,
  },
  dayHeaderText: { color: Gold.gold, fontFamily: 'Rubik_800ExtraBold', fontSize: 16, letterSpacing: 0.5 },
  dayHeaderLine: { flex: 1, height: 1, backgroundColor: Gold.line },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Gold.line,
    borderRadius: 12,
    backgroundColor: Gold.surface,
  },
  loadMoreText: { color: Gold.gold, fontFamily: 'Rubik_700Bold', fontSize: 12, letterSpacing: 2 },
  teaser: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 236, // stretched downward — the 1929 front page gets room to read

    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teaserGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  teaserStack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  teaserCard: {
    position: 'absolute',
    borderRadius: 12,
    backgroundColor: '#e8d5a2',
  },
  teaserCardBack: { width: '78%', height: 190, top: 14, opacity: 0.5, transform: [{ scale: 0.92 }] },
  teaserCardMid: { width: '84%', height: 204, top: 18, opacity: 0.75, transform: [{ scale: 0.96 }] },
  teaserCardFront: { width: '90%', height: 216, top: 10, overflow: 'hidden' },
  teaserImgFull: { width: '100%', height: '100%' },
  teaserCardTitle: {
    color: '#1a1509',
    fontFamily: 'Rubik_800ExtraBold',
    fontSize: 14,
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  teaserBlur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  teaserOverlay: { alignItems: 'center', gap: 6, zIndex: 2 },
  teaserPlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Gold.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  teaserText: { color: Gold.text, fontFamily: 'Rubik_800ExtraBold', fontSize: 13, letterSpacing: 2 },
  teaserSub: { color: Gold.textMuted, fontFamily: 'Rubik_500Medium', fontSize: 10, letterSpacing: 0.5 },
  adRow: {
    marginHorizontal: 16,
    marginVertical: 8,
    height: 72,
    borderWidth: 1,
    borderColor: Gold.line,
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Gold.surface,
  },
  adRowText: { color: Gold.textDim, fontFamily: 'Rubik_700Bold', fontSize: 10, letterSpacing: 4 },

  featured: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: Gold.surface },
  featuredImg: { width: '100%', height: 180, backgroundColor: Gold.surface2 },
  featuredBody: { padding: 14 },
  featuredTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  featuredTag: { color: Gold.gold, fontFamily: 'Rubik_700Bold', fontSize: 10, letterSpacing: 2 },
  featuredTime: { color: Gold.textMuted, fontFamily: 'Rubik_500Medium', fontSize: 11 },
  featuredTitle: { color: Gold.text, fontFamily: 'Montserrat_700Bold', fontSize: 18, lineHeight: 25, letterSpacing: 0 },
  featuredSub: { color: Gold.textMuted, fontFamily: 'Montserrat_400Regular', fontSize: 12.5, lineHeight: 19, marginTop: 6 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  metaText: { color: Gold.textDim, fontFamily: 'Rubik_500Medium', fontSize: 10, letterSpacing: 1 },
  metaDot: { color: Gold.textDim },

  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  rowThumbWrap: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: Gold.surface,
    borderWidth: 1,
    borderColor: Gold.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowThumb: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 3 },
  rowCat: { color: Gold.gold, fontFamily: 'Rubik_700Bold', fontSize: 9, letterSpacing: 1.5 },
  rowTitle: { color: Gold.text, fontFamily: 'Montserrat_600SemiBold', fontSize: 13, lineHeight: 18 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  rowMetaText: { color: Gold.textDim, fontFamily: 'Rubik_400Regular', fontSize: 10, letterSpacing: 0.5 },

  empty: { color: Gold.textMuted, textAlign: 'center', marginTop: 40, fontFamily: 'Rubik_400Regular' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { color: Gold.textMuted, fontFamily: 'Rubik_500Medium', fontSize: 14 },
  retryBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Gold.gold,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryText: { color: Gold.gold, fontFamily: 'Rubik_700Bold', fontSize: 12, letterSpacing: 1 },

  readerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  fillAbs: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Gold.surface,
    borderWidth: 1,
    borderColor: Gold.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: Gold.text,
    fontFamily: 'Rubik_500Medium',
    fontSize: 14,
    paddingVertical: 0,
  },
  searchClose: { color: Gold.text, fontSize: 26, lineHeight: 28, marginTop: -2 },
  searchRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Gold.line,
    gap: 3,
  },
  brandSpinBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  brandFace: { position: 'absolute' },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: Gold.line,
    backgroundColor: Gold.surface,
    paddingTop: 8,
    zIndex: 30, // above the reader overlay — nav stays visible while reading
  },
  navItem: { alignItems: 'center', gap: 3, flex: 1 },
  navLabel: { color: Gold.textDim, fontFamily: 'Rubik_500Medium', fontSize: 9 },
  navLabelOn: { color: Gold.gold },
  navCenter: { alignItems: 'center', justifyContent: 'center', width: 64, marginTop: -24 },
  navCenterCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Gold.bg,
    borderWidth: 2,
    borderColor: Gold.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCenterText: { color: Gold.gold, fontFamily: 'Rubik_800ExtraBold', fontSize: 20 },
});
