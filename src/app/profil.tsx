import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { Gold } from '@/constants/theme';

const VERSION = 'V1.0';
const CONTACT = 'merttcaliskanis@gmail.com';

export default function ProfilScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: 'Profil' }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Gold.gold} />
        </Pressable>
        <Text style={styles.title}>PROFİL</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.center}>
        <Image
          source={require('../../assets/images/son24-logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.version}>{VERSION}</Text>
        <Text style={styles.tagline}>Günün özeti · Olayların bağlamı</Text>
      </View>

      <View style={styles.list}>
        <Row icon="shield-checkmark-outline" label="Gizlilik Politikası" onPress={() => router.push('/gizlilik')} />
        <Row icon="mail-outline" label="İletişim" onPress={() => Linking.openURL(`mailto:${CONTACT}`)} />
      </View>
    </View>
  );
}

function Row({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={18} color={Gold.gold} />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Ionicons name="chevron-forward" size={16} color={Gold.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Gold.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: Gold.gold, fontFamily: 'Rubik_800ExtraBold', fontSize: 14, letterSpacing: 2 },
  center: { alignItems: 'center', paddingTop: 28, paddingBottom: 20 },
  logo: { width: 170, height: 98 },
  version: { color: Gold.textMuted, fontFamily: 'Rubik_700Bold', fontSize: 12, marginTop: 6, letterSpacing: 1 },
  tagline: { color: Gold.textDim, fontFamily: 'LibreBaskerville_400Regular', fontSize: 12, marginTop: 4 },
  list: { marginTop: 12, marginHorizontal: 16, borderRadius: 14, backgroundColor: Gold.surface, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Gold.line,
  },
  rowLabel: { color: Gold.text, fontFamily: 'Rubik_500Medium', fontSize: 14 },
});
