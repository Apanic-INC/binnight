import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { THEME } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

const API_URL = 'https://binnight-api.onrender.com';

// Generate all 24 hours
const REMINDER_TIMES = Array.from({ length: 24 }, (_, i) => {
  const hour = i;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return {
    label: `${displayHour}:00 ${ampm}`,
    value: `${String(hour).padStart(2, '0')}:00:00`,
  };
});

export default function SettingsScreen() {
  const [address, setAddress] = useState('');
  const [notifyTime, setNotifyTime] = useState('18:00:00');
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const addr = await AsyncStorage.getItem('userAddress');
    if (addr) setAddress(addr);

    const savedTime = await AsyncStorage.getItem('notifyTime');
    if (savedTime) setNotifyTime(savedTime);
  }

  async function handleTimeSelect(timeValue: string) {
    setNotifyTime(timeValue);
    setShowTimePicker(false);

    // Save locally
    await AsyncStorage.setItem('notifyTime', timeValue);

    // Save to Supabase
    const userId = await AsyncStorage.getItem('userId');
    if (userId) {
      const { error } = await supabase
        .from('users')
        .update({ notify_time: timeValue })
        .eq('id', userId);

      if (error) {
        console.log('Could not save notification time:', error.message);
      }
    }
  }

  function getTimeLabel(value: string): string {
    const match = REMINDER_TIMES.find(t => t.value === value);
    return match ? match.label : value;
  }

  async function handleChangeAddress() {
    Alert.alert(
      'Change Address',
      'This will clear your current schedule and set up a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            // Keep userId so setup can reuse the same user record
            // but clear address/zone so the app goes to setup screen
            await AsyncStorage.removeItem('userZone');
            await AsyncStorage.removeItem('userAddress');
            router.replace('/setup');
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Manage your Bin Night preferences</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Address</Text>
        <Text style={styles.infoValue}>{address || 'Not set'}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Council</Text>
        <Text style={styles.infoValue}>Merri-bek City Council</Text>
      </View>

      {/* Reminder Time - Tappable */}
      <TouchableOpacity
        style={styles.infoCard}
        onPress={() => setShowTimePicker(!showTimePicker)}
        activeOpacity={0.7}
      >
        <Text style={styles.infoLabel}>Reminder Time</Text>
        <View style={styles.timeRow}>
          <View>
            <Text style={styles.infoValue}>{getTimeLabel(notifyTime)}</Text>
            <Text style={styles.timeHint}>Night before collection</Text>
          </View>
          <Text style={styles.chevron}>{showTimePicker ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Time picker options */}
      {showTimePicker && (
        <View style={styles.timePickerCard}>
          <Text style={styles.timePickerTitle}>When should we remind you?</Text>
          {REMINDER_TIMES.map((time) => {
            const isSelected = notifyTime === time.value;
            return (
              <TouchableOpacity
                key={time.value}
                style={[styles.timeOption, isSelected && styles.timeOptionSelected]}
                onPress={() => handleTimeSelect(time.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.timeOptionLabel, isSelected && styles.timeOptionLabelSelected]}>
                    {time.label}
                  </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        style={styles.changeButton}
        onPress={handleChangeAddress}
        activeOpacity={0.8}
      >
        <Text style={styles.changeButtonText}>Change Address</Text>
      </TouchableOpacity>

      <View style={styles.versionCard}>
        <Text style={styles.versionText}>Bin Night v0.1.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  content: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    marginBottom: 28,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: THEME.bgCard,
    borderRadius: THEME.borderRadius,
    padding: 18,
    marginBottom: 12,
    borderBottomWidth: 4,
    borderBottomColor: '#1A4030',
  },
  infoLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeHint: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  timePickerCard: {
    backgroundColor: THEME.bgCard,
    borderRadius: THEME.borderRadius,
    padding: 16,
    marginBottom: 12,
    borderBottomWidth: 4,
    borderBottomColor: '#1A4030',
  },
  timePickerTitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '700',
    marginBottom: 12,
  },
  timeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  timeOptionSelected: {
    backgroundColor: 'rgba(139, 195, 74, 0.15)',
  },
  timeOptionLabel: {
    fontSize: 16,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  timeOptionLabelSelected: {
    color: THEME.tabActive,
  },
  checkmark: {
    fontSize: 18,
    color: THEME.tabActive,
    fontWeight: '800',
  },
  changeButton: {
    backgroundColor: THEME.bgCard,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: THEME.warmYellow,
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.warmYellow,
  },
  versionCard: {
    marginTop: 32,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 13,
    color: THEME.textMuted,
    fontWeight: '600',
  },
});
