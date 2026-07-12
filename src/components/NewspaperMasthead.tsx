import { View, Text, StyleSheet } from 'react-native';
import { NewsprintColors, Fonts, Spacing } from '@/constants/theme';

const DAYS_TR = ['PAZAR', 'PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ'];

function dateNumeric() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function dayName() {
  return DAYS_TR[new Date().getDay()];
}

interface Props {
  issueNumber: number;
}

export function NewspaperMasthead({ issueNumber }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRule} />
      <View style={styles.row}>
        <View style={styles.sideLeft}>
          <Text style={styles.sideText} numberOfLines={1}>SAYI: {issueNumber}</Text>
        </View>

        <Text style={styles.title} numberOfLines={1}>SON 24</Text>

        <View style={styles.dateBlock}>
          <Text style={styles.dateNum} numberOfLines={1}>{dateNumeric()}</Text>
          <View style={styles.dateRule} />
          <Text style={styles.dateDay} numberOfLines={1}>{dayName()}</Text>
        </View>
      </View>
      <View style={styles.doubleRule} />
    </View>
  );
}

const SIDE_W = 78;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    backgroundColor: NewsprintColors.ink,
  },
  topRule: {
    height: 1,
    backgroundColor: NewsprintColors.rule,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideLeft: {
    width: SIDE_W,
    justifyContent: 'center',
  },
  sideText: {
    color: NewsprintColors.paperDim,
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: NewsprintColors.paper,
    fontFamily: Fonts.serifDisplay,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 2,
  },
  dateBlock: {
    width: SIDE_W,
    alignItems: 'flex-end',
  },
  dateNum: {
    color: NewsprintColors.paper,
    fontFamily: Fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  dateRule: {
    height: 1,
    width: 62,
    backgroundColor: NewsprintColors.rule,
    marginVertical: 3,
  },
  dateDay: {
    color: NewsprintColors.paperMuted,
    fontFamily: Fonts.sans,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  doubleRule: {
    height: 3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: NewsprintColors.rule,
    marginTop: Spacing.two,
  },
});
