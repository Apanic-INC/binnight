import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { THEME } from '../lib/theme';

// Point this at your local API server
const API_URL = 'https://binnight-api.onrender.com';

export default function SetupScreen() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit() {
    if (address.trim().length < 5) {
      setError('Please enter your full street address');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus('Finding your bins...');

    try {
      // Check if there's an existing user (address change scenario)
      const existingUserId = await AsyncStorage.getItem('userId');

      const response = await fetch(`${API_URL}/api/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          existingUserId: existingUserId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setStatus('Setting up your schedule...');

      // Save user data locally so the app remembers them
      await AsyncStorage.setItem('userId', data.userId);
      await AsyncStorage.setItem('userZone', data.zone);
      await AsyncStorage.setItem('userAddress', address.trim());

      setStatus('Done! Loading your bins...');

      // Navigate to the main app
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);

    } catch (err: any) {
      setError(err.message || 'Failed to set up. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Logo area */}
        <View style={styles.logoSection}>
          <View style={styles.logoBin}>
            <View style={[styles.logoBinHandle, { backgroundColor: '#E53935' }]} />
            <View style={[styles.logoBinLid, { backgroundColor: '#E53935' }]} />
            <View style={styles.logoBinBody} />
          </View>
          <Text style={styles.title}>Bin Night</Text>
          <Text style={styles.tagline}>Never miss bin night again!</Text>
        </View>

        {/* Address input card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Where do you live?</Text>
          <Text style={styles.cardSubtitle}>
            Enter your full street address and postcode so we can find your bin schedule
          </Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. 42 Smith St, Brunswick 3056"
            placeholderTextColor={THEME.textMuted}
            value={address}
            onChangeText={setAddress}
            autoCapitalize="words"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            editable={!loading}
          />

          <Text style={styles.councilNote}>
            Currently supports Merri-bek council areas{'\n'}
            (Brunswick, Coburg, Northcote, Preston, etc.)
          </Text>

          {error && (
            <View style={styles.errorBadge}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {status && loading && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.buttonText}>  Searching...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Find my bins!</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          This takes about 15 seconds — we're checking{'\n'}your council's website for your schedule.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 80,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBin: {
    alignItems: 'center',
    marginBottom: 12,
    width: 64,
    height: 80,
  },
  logoBinHandle: {
    width: 20,
    height: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: -1,
  },
  logoBinLid: {
    width: 64,
    height: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  logoBinBody: {
    width: 56,
    height: 52,
    backgroundColor: '#444444',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: THEME.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: THEME.warmYellow,
    fontWeight: '700',
    marginTop: 4,
  },
  card: {
    backgroundColor: THEME.bgCard,
    borderRadius: THEME.borderRadiusLarge,
    padding: 24,
    borderBottomWidth: 5,
    borderBottomColor: '#1A4030',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    backgroundColor: THEME.bgCardLight,
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    color: THEME.textPrimary,
    fontWeight: '500',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  councilNote: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  errorBadge: {
    backgroundColor: 'rgba(229, 57, 53, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusBadge: {
    backgroundColor: 'rgba(139, 195, 74, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    color: THEME.tabActive,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    backgroundColor: THEME.tabActive,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#6B9F30',
  },
  buttonDisabled: {
    backgroundColor: THEME.bgAccent,
    borderBottomColor: '#2D6040',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  footer: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
