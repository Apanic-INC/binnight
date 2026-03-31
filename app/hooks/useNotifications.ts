import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://binnight-api.onrender.com';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');

  useEffect(() => {
    // Small delay to ensure AsyncStorage userId is available
    const timer = setTimeout(() => {
      registerForPushNotifications();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  async function registerForPushNotifications() {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setPermissionStatus(finalStatus);

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }

    // Get the Expo push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '54d73741-6180-497a-89de-a9c3d8fd8685',
      });
      const token = tokenData.data;
      console.log('Push token:', token);
      setExpoPushToken(token);

      // Save token via our API server (more reliable than direct Supabase)
      const userId = await AsyncStorage.getItem('userId');
      console.log('Saving push token for userId:', userId);

      if (userId) {
        try {
          const response = await fetch(`${API_URL}/api/save-push-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pushToken: token }),
          });

          const result = await response.json();

          if (result.success) {
            console.log('Push token saved via API server');
          } else {
            console.log('Could not save push token:', result.error);
          }
        } catch (fetchError) {
          // Server might not be running — that's okay, we'll retry next time
          console.log('Could not reach API server to save push token — will retry later');
        }
      } else {
        console.log('No userId found in AsyncStorage — token not saved');
      }
    } catch (error) {
      console.log('Push token registration skipped:', error);
    }
  }

  return {
    expoPushToken,
    permissionStatus,
    registerForPushNotifications,
  };
}
