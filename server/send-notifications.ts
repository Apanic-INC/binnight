import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { supabase } from './index';

const expo = new Expo();

// Friendly bin names with colour circle emojis
const BIN_NAMES: Record<string, string> = {
  fogo: '🟢 Organics (green lid)',
  rubbish: '🔴 General (red lid)',
  recycling: '🟡 Recycling (yellow lid)',
  glass: '🟣 Glass (purple lid)',
};

export async function sendNotifications() {
  console.log('\n=== Bin Night Notification Sender ===');

  // Get current time in Melbourne
  const now = new Date();
  const melbourneTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const currentHour = melbourneTime.getHours();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:00:00`;

  console.log(`Melbourne time: ${melbourneTime.toLocaleString('en-AU')}`);
  console.log(`Looking for users with notify_time: ${currentTimeStr}`);

  // Get tomorrow's date in AEST
  const tomorrow = new Date(melbourneTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  console.log(`Checking collections for: ${tomorrowStr}`);

  // Get users with push tokens whose notify_time matches the current hour
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, address, push_token, collection_zone, notify_time')
    .not('push_token', 'is', null)
    .eq('notify_time', currentTimeStr);

  if (usersError) {
    console.error('Error fetching users:', usersError.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log('No users with push tokens found');
    return;
  }

  console.log(`Found ${users.length} users with push tokens`);

  const messages: ExpoPushMessage[] = [];

  for (const user of users) {
    // Check if this user has a collection tomorrow
    const { data: collections } = await supabase
      .from('collection_schedule')
      .select('bins, is_holiday')
      .eq('zone', user.collection_zone)
      .eq('date', tomorrowStr);

    if (!collections || collections.length === 0) continue;

    const collection = collections[0];

    // Skip if it's a holiday (no collection)
    if (collection.is_holiday) {
      console.log(`  ${user.address}: Holiday tomorrow, skipping`);
      continue;
    }

    // Build the notification message
    const bins = collection.bins as string[];
    const binNames = bins
      .filter(b => b !== 'holiday')
      .map(b => BIN_NAMES[b] || b);

    if (binNames.length === 0) continue;

    const body = `Put your bins out tonight!\n${binNames.join('\n')}`;

    console.log(`  ${user.address}: ${body}`);

    // Validate the push token
    if (!Expo.isExpoPushToken(user.push_token)) {
      console.log(`  Invalid push token for ${user.address}, skipping`);
      continue;
    }

    messages.push({
      to: user.push_token,
      sound: 'default',
      title: 'Bin Night!',
      body,
      data: { date: tomorrowStr, bins },
    });
  }

  if (messages.length === 0) {
    console.log('\nNo notifications to send');
    return;
  }

  // Send in chunks (Expo recommends batches of 100)
  console.log(`\nSending ${messages.length} notifications...`);
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      console.log('Sent:', receipts.length, 'notifications');

      // Log any errors
      for (const receipt of receipts) {
        if (receipt.status === 'error') {
          console.error('Notification error:', receipt.message);
        }
      }
    } catch (error) {
      console.error('Error sending chunk:', error);
    }
  }

  console.log('\nDone!');
}

// Run standalone if called directly
if (require.main === module) {
  sendNotifications().catch(console.error);
}
