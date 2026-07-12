import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Gold } from '@/constants/theme';

const UPDATED = '11 Temmuz 2026';
const CONTACT = 'merttcaliskanis@gmail.com';

function H({ children }: { children: string }) {
  return <Text style={styles.h}>{children}</Text>;
}
function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}

export default function GizlilikScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: 'Gizlilik Politikası' }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Gold.gold} />
        </Pressable>
        <Text style={styles.title}>GİZLİLİK POLİTİKASI</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.updated}>Son güncelleme: {UPDATED}</Text>

        <H>1. Kimiz</H>
        <P>
          Son 24 (&quot;Uygulama&quot;), Türkiye gündemindeki gelişmeleri resmî ve birincil
          kaynaklardan derleyip tarafsız özetlerle sunan bir haber özeti uygulamasıdır.
          Sorularınız için: {CONTACT}
        </P>

        <H>2. Hesap yok, kimlik yok</H>
        <P>
          Uygulama üyelik veya hesap gerektirmez. Ad, e-posta, telefon numarası, konum gibi
          kimliğinizi belirleyen hiçbir kişisel veriyi toplamayız, saklamayız, işlemeyiz.
        </P>

        <H>3. Topladığımız anonim veriler</H>
        <P>
          • <Text style={styles.b}>Bağlantı tıklamaları:</Text> Kaynaklar sekmesindeki
          &quot;Habere Git&quot; bağlantısına dokunduğunuzda hangi habere gidildiği (haber
          kimliği, hedef adres, zaman) anonim olarak kaydedilir. Bu kayıt sizinle
          ilişkilendirilemez; hangi içeriklerin ilgi gördüğünü anlamak için kullanılır.
        </P>
        <P>
          • <Text style={styles.b}>Çökme raporları:</Text> Uygulama hata verirse cihaz modeli,
          işletim sistemi sürümü ve hatanın teknik ayrıntısı (Sentry aracılığıyla) toplanabilir.
          Bu raporlar kişisel içerik taşımaz ve yalnızca hataları düzeltmek için kullanılır.
        </P>

        <H>4. Verilerin saklandığı yer</H>
        <P>
          Veriler Supabase altyapısında barındırılır. Haber içerikleri, ilgili kurumların ve
          partilerin kamuya açık internet sitelerinden derlenir; özetler yapay zekâ ile kendi
          cümlelerimizle üretilir ve kaynak bağlantısı her kartta gösterilir.
        </P>

        <H>5. Üçüncü taraf bağlantılar</H>
        <P>
          &quot;Habere Git&quot; bağlantıları sizi kaynağın kendi sitesine götürür. O sitelerin
          gizlilik uygulamalarından ilgili site sorumludur.
        </P>

        <H>6. Reklamlar</H>
        <P>
          Uygulamada ileride reklam gösterilebilir. Kişiselleştirilmiş reklam veya reklam amaçlı
          veri paylaşımı eklenirse bu politika güncellenir ve uygulama içinden duyurulur.
        </P>

        <H>7. Çocukların gizliliği</H>
        <P>
          Uygulama kişisel veri toplamadığı için her yaş grubu güvenle kullanabilir; yine de
          içerik güncel siyaset haberleri olduğundan 13 yaş üstü kullanım önerilir.
        </P>

        <H>8. KVKK kapsamındaki haklarınız</H>
        <P>
          6698 sayılı KVKK uyarınca verilerinize ilişkin bilgi talep etme, düzeltme ve silme
          haklarına sahipsiniz. Uygulama kimliğinizi bilmediği için tıklama kayıtları sizinle
          eşleştirilemez; yine de her türlü talep için {CONTACT} adresine yazabilirsiniz.
        </P>

        <H>9. Değişiklikler</H>
        <P>
          Bu politika değiştiğinde &quot;Son güncelleme&quot; tarihi yenilenir. Önemli
          değişiklikler uygulama içinden duyurulur.
        </P>
      </ScrollView>
    </View>
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
  body: { paddingHorizontal: 20, paddingTop: 4 },
  updated: { color: Gold.textDim, fontFamily: 'Rubik_500Medium', fontSize: 11, marginBottom: 16 },
  h: {
    color: Gold.gold,
    fontFamily: 'Rubik_700Bold',
    fontSize: 14,
    marginTop: 18,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  p: {
    color: Gold.text,
    fontFamily: 'LibreBaskerville_400Regular',
    fontSize: 13.5,
    lineHeight: 21,
    marginBottom: 6,
  },
  b: { fontFamily: 'LibreBaskerville_700Bold' },
});
