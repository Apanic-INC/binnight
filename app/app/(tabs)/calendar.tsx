import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { BIN_COLOURS, BIN_LABELS, type BinType } from '../../lib/colours';
import { THEME } from '../../lib/theme';
import type { CollectionEvent } from '../../lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  return { daysInMonth, startDay };
}

function getMonthName(month: number): string {
  return new Date(2026, month).toLocaleDateString('en-AU', { month: 'long' });
}

export default function CalendarScreen() {
  const [events, setEvents] = useState<CollectionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllEvents();
  }, []);

  async function fetchAllEvents() {
    const userZone = await AsyncStorage.getItem('userZone');
    const query = supabase
      .from('collection_schedule')
      .select('*')
      .order('date', { ascending: true });

    if (userZone) {
      query.eq('zone', userZone);
    }

    const { data } = await query;
    if (data) setEvents(data);
    setLoading(false);
  }

  const eventMap: Record<string, CollectionEvent> = {};
  events.forEach(e => { eventMap[e.date] = e; });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={THEME.tabActive} />
      </View>
    );
  }

  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.yearTitle}>2026</Text>

      {/* Legend */}
      <View style={styles.legend}>
        {(['fogo', 'rubbish', 'recycling', 'glass'] as BinType[]).map(bin => (
          <View key={bin} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: BIN_COLOURS[bin] }]} />
            <Text style={styles.legendText}>{BIN_LABELS[bin]}</Text>
          </View>
        ))}
      </View>

      {months.map(month => {
        const { daysInMonth, startDay } = getMonthData(2026, month);
        const cells: (number | null)[] = [];
        for (let i = 0; i < startDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);

        const weeks: (number | null)[][] = [];
        for (let i = 0; i < cells.length; i += 7) {
          weeks.push(cells.slice(i, i + 7));
        }

        return (
          <View key={month} style={styles.monthContainer}>
            <Text style={styles.monthTitle}>{getMonthName(month)}</Text>
            <View style={styles.monthCard}>
              <View style={styles.weekRow}>
                {DAYS.map(d => (
                  <Text key={d} style={styles.dayHeader}>{d}</Text>
                ))}
              </View>

              {weeks.map((week, wi) => (
                <View key={wi} style={styles.weekRow}>
                  {week.map((day, di) => {
                    if (day === null) {
                      return <View key={di} style={styles.dayCell} />;
                    }

                    const dateStr = `2026-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const event = eventMap[dateStr];
                    const bins = event ? event.bins.filter(b => b !== 'holiday') as BinType[] : [];
                    const isHoliday = event?.is_holiday;

                    return (
                      <View key={di} style={styles.dayCell}>
                        <Text style={[styles.dayNumber, isHoliday && styles.holidayNumber]}>
                          {day}
                        </Text>
                        <View style={styles.dotsRow}>
                          {bins.map(bin => (
                            <View
                              key={bin}
                              style={[styles.dot, { backgroundColor: BIN_COLOURS[bin] }]}
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
    padding: 16,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.bg,
  },
  yearTitle: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    color: THEME.textPrimary,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  monthContainer: {
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.warmYellow,
    marginBottom: 8,
    marginLeft: 4,
  },
  monthCard: {
    backgroundColor: THEME.bgCard,
    borderRadius: THEME.borderRadius,
    padding: 12,
    borderBottomWidth: 4,
    borderBottomColor: '#1A4030',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    paddingBottom: 6,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 44,
  },
  dayNumber: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  holidayNumber: {
    color: '#42A5F5',
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
