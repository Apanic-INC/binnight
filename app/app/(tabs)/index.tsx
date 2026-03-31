import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { NextCollection } from '../../components/NextCollection';
import { type BinType, BIN_COLOURS } from '../../lib/colours';
import { THEME } from '../../lib/theme';
import { useNotifications } from '../../hooks/useNotifications';
import type { CollectionEvent } from '../../lib/types';

export default function HomeScreen() {
  const [nextCollection, setNextCollection] = useState<CollectionEvent | null>(null);
  const [upcomingCollections, setUpcomingCollections] = useState<CollectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Register for push notifications
  useNotifications();

  useEffect(() => {
    checkSetupAndFetch();
  }, []);

  async function checkSetupAndFetch() {
    const userZone = await AsyncStorage.getItem('userZone');

    // If user hasn't set up yet, send them to setup screen
    if (!userZone) {
      router.replace('/setup');
      return;
    }

    fetchSchedule(userZone);
  }

  async function fetchSchedule(zone: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error: fetchError } = await supabase
        .from('collection_schedule')
        .select('*')
        .eq('zone', zone)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(10);

      if (fetchError) throw fetchError;
      if (data && data.length > 0) {
        setNextCollection(data[0]);
        setUpcomingCollections(data.slice(1, 6));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={THEME.tabActive} />
        <Text style={styles.loadingText}>Loading your bins...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!nextCollection) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noBins}>No upcoming collections found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>Bin Night</Text>
      <Text style={styles.subtitle}>Next collection</Text>

      {/* Next collection card */}
      <View style={styles.nextCard}>
        <NextCollection
          date={nextCollection.date}
          bins={nextCollection.bins}
          isHoliday={nextCollection.is_holiday}
        />
      </View>

      {/* Upcoming collections */}
      {upcomingCollections.length > 0 && (
        <View style={styles.upcomingSection}>
          <Text style={styles.upcomingTitle}>Coming up</Text>
          {upcomingCollections.map((event, index) => {
            const date = new Date(event.date + 'T00:00:00');
            const dateLabel = date.toLocaleDateString('en-AU', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
            const binTypes = event.bins.filter(b => b !== 'holiday') as BinType[];

            return (
              <View key={event.id || index} style={styles.upcomingRow}>
                <Text style={styles.upcomingDate}>{dateLabel}</Text>
                <View style={styles.upcomingBins}>
                  {event.is_holiday ? (
                    <View style={styles.holidayChip}>
                      <Text style={styles.holidayLabel}>Holiday</Text>
                    </View>
                  ) : (
                    binTypes.map(bin => (
                      <View
                        key={bin}
                        style={[styles.binDot, { backgroundColor: BIN_COLOURS[bin] }]}
                      />
                    ))
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  content: {
    paddingTop: 60,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.bg,
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    color: THEME.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
    fontWeight: '600',
  },
  nextCard: {
    marginHorizontal: 16,
    backgroundColor: THEME.bgCard,
    borderRadius: THEME.borderRadiusLarge,
    padding: 4,

    // Duolingo-style 3D border
    borderBottomWidth: 5,
    borderBottomColor: '#1A4030',

    shadowColor: THEME.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  upcomingSection: {
    marginTop: 28,
    marginHorizontal: 16,
    backgroundColor: THEME.bgCard,
    borderRadius: THEME.borderRadius,
    padding: 18,
    borderBottomWidth: 4,
    borderBottomColor: '#1A4030',
  },
  upcomingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 12,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  upcomingDate: {
    fontSize: 16,
    color: THEME.textSecondary,
    fontWeight: '600',
    width: 120,
  },
  upcomingBins: {
    flexDirection: 'row',
    gap: 8,
  },
  binDot: {
    width: 26,
    height: 26,
    borderRadius: 13,

    // Duolingo-style border
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  holidayChip: {
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  holidayLabel: {
    fontSize: 13,
    color: '#42A5F5',
    fontWeight: '700',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.textMuted,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#E53935',
    textAlign: 'center',
  },
  noBins: {
    fontSize: 18,
    color: THEME.textMuted,
  },
});
