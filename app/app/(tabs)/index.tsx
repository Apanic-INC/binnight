import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { NextCollection } from '../../components/NextCollection';
import { type BinType, BIN_COLOURS } from '../../lib/colours';
import { THEME } from '../../lib/theme';
import { useNotifications } from '../../hooks/useNotifications';
import type { CollectionEvent } from '../../lib/types';
import { updateWidgetData } from '../../lib/widgetData';

const API_URL = 'https://binnight-api.onrender.com';

function isToday(dateStr: string): boolean {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateStr === todayStr;
}

function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  return dateStr === tomorrowStr;
}

export default function HomeScreen() {
  const [nextCollection, setNextCollection] = useState<CollectionEvent | null>(null);
  const [upcomingCollections, setUpcomingCollections] = useState<CollectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [binsAreOut, setBinsAreOut] = useState(false);

  // Register for push notifications
  useNotifications();

  // Check bins out status and refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkSetupAndFetch();
      checkBinsOutStatus();
    }, [])
  );

  async function checkBinsOutStatus() {
    const userAddress = await AsyncStorage.getItem('userAddress');
    if (!userAddress) {
      setBinsAreOut(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/bins-out-status?address=${encodeURIComponent(userAddress)}`);
      const data = await response.json();
      const savedDate = data.binsOutDate;

      if (!savedDate) {
        setBinsAreOut(false);
        return;
      }

      // Auto-reset after 12 PM on collection day
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (savedDate === todayStr && now.getHours() >= 12) {
        // It's past noon on collection day — auto-clear for the household
        await fetch(`${API_URL}/api/bins-out-undo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: userAddress }),
        });
        setBinsAreOut(false);
      } else if (savedDate < todayStr) {
        // Old date — clear it
        await fetch(`${API_URL}/api/bins-out-undo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: userAddress }),
        });
        setBinsAreOut(false);
      } else {
        setBinsAreOut(true);
      }
    } catch (err) {
      console.log('Could not check bins out status:', err);
      setBinsAreOut(false);
    }
  }

  async function handleBinsOut() {
    if (!nextCollection) return;
    const userAddress = await AsyncStorage.getItem('userAddress');
    if (!userAddress) return;

    try {
      await fetch(`${API_URL}/api/bins-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userAddress, collectionDate: nextCollection.date }),
      });
    } catch (err) {
      console.log('Could not sync bins out status:', err);
    }

    setBinsAreOut(true);
    // Update widget
    updateWidgetData({
      showWidget: true,
      binTypes: nextCollection.bins.filter(b => b !== 'holiday'),
      collectionDay: isToday(nextCollection.date) ? 'Today' : 'Tomorrow',
      binsAreOut: true,
    });
  }

  async function handleUndoBinsOut() {
    const userAddress = await AsyncStorage.getItem('userAddress');
    if (userAddress) {
      try {
        await fetch(`${API_URL}/api/bins-out-undo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: userAddress }),
        });
      } catch (err) {
        console.log('Could not sync bins out undo:', err);
      }
    }

    setBinsAreOut(false);
    // Update widget
    if (nextCollection) {
      updateWidgetData({
        showWidget: true,
        binTypes: nextCollection.bins.filter(b => b !== 'holiday'),
        collectionDay: isToday(nextCollection.date) ? 'Today' : 'Tomorrow',
        binsAreOut: false,
      });
    }
  }

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
        // Find the next actual collection (skip holidays)
        const nextActual = data.find(d => !d.is_holiday);
        // All events for the "Coming up" list (after the next actual collection)
        const nextActualIndex = nextActual ? data.indexOf(nextActual) : 0;
        const upcoming = data.filter((d, i) => i !== nextActualIndex).slice(0, 5);

        setNextCollection(nextActual || data[0]);
        setUpcomingCollections(upcoming);

        // Sync widget data
        if (nextActual) {
          const shouldShow = isToday(nextActual.date) || isTomorrow(nextActual.date);

          updateWidgetData({
            showWidget: shouldShow,
            binTypes: nextActual.bins.filter((b: string) => b !== 'holiday'),
            collectionDay: isToday(nextActual.date) ? 'Today' : 'Tomorrow',
            binsAreOut: binsAreOut,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }

  // Show the "bins out" button only when collection is today or tomorrow
  const showBinsOutButton = nextCollection && !nextCollection.is_holiday &&
    (isToday(nextCollection.date) || isTomorrow(nextCollection.date));

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

      {/* Bins are out button */}
      {showBinsOutButton && (
        binsAreOut ? (
          <TouchableOpacity
            style={styles.binsOutDoneButton}
            onPress={handleUndoBinsOut}
            activeOpacity={0.8}
          >
            <Text style={styles.binsOutDoneIcon}>✓</Text>
            <Text style={styles.binsOutDoneText}>Bins are out</Text>
            <Text style={styles.binsOutUndoText}>Tap to undo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.binsOutButton}
            onPress={handleBinsOut}
            activeOpacity={0.8}
          >
            <Text style={styles.binsOutButtonText}>The bins are out</Text>
          </TouchableOpacity>
        )
      )}

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
  binsOutButton: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: THEME.tabActive,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#6B9F30',
  },
  binsOutButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  binsOutDoneButton: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: 'rgba(139, 195, 74, 0.15)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.tabActive,
  },
  binsOutDoneIcon: {
    fontSize: 24,
    color: THEME.tabActive,
    fontWeight: '800',
    marginBottom: 2,
  },
  binsOutDoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.tabActive,
  },
  binsOutUndoText: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 4,
    fontWeight: '500',
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
