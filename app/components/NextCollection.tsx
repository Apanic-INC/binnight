import { View, Text, StyleSheet } from 'react-native';
import { BinCard } from './BinCard';
import { type BinType } from '../lib/colours';
import { THEME } from '../lib/theme';

interface NextCollectionProps {
  date: string;
  bins: string[];
  isHoliday?: boolean;
}

function getRelativeDay(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) {
    return target.toLocaleDateString('en-AU', { weekday: 'long' });
  }
  return target.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function NextCollection({ date, bins, isHoliday }: NextCollectionProps) {
  const relativeDay = getRelativeDay(date);
  const fullDate = formatDate(date);
  const binTypes = bins.filter(b => b !== 'holiday') as BinType[];
  const isToday = relativeDay === 'Today';
  const isTomorrow = relativeDay === 'Tomorrow';

  const message = isToday
    ? 'Quick, put out your bins if you haven\'t already!'
    : isTomorrow
    ? 'Put out your bins tonight!'
    : 'Bins to put out:';

  if (isHoliday) {
    return (
      <View style={styles.container}>
        <Text style={styles.relativeDayHoliday}>{relativeDay}</Text>
        <Text style={styles.fullDate}>{fullDate}</Text>
        <View style={styles.holidayBadge}>
          <Text style={styles.holidayText}>No collection — Public Holiday</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.relativeDay}>{relativeDay}</Text>
      <Text style={styles.fullDate}>{fullDate}</Text>
      <View style={styles.putOutBadge}>
        <Text style={styles.putOut}>{message}</Text>
      </View>
      <View style={styles.binsRow}>
        {binTypes.map(bin => (
          <BinCard key={bin} binType={bin} size="large" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  relativeDay: {
    fontSize: 34,
    fontWeight: '900',
    color: THEME.warmYellow,
    marginBottom: 2,
  },
  relativeDayHoliday: {
    fontSize: 34,
    fontWeight: '900',
    color: '#42A5F5',
    marginBottom: 2,
  },
  fullDate: {
    fontSize: 15,
    color: THEME.textSecondary,
    marginBottom: 14,
    fontWeight: '500',
  },
  putOutBadge: {
    backgroundColor: THEME.bgAccent,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 18,
  },
  putOut: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
  holidayBadge: {
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 12,
  },
  holidayText: {
    fontSize: 16,
    color: '#42A5F5',
    fontWeight: '700',
  },
  binsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
