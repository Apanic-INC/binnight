import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { lookupCouncil } from './council-lookup';
import { scrapeMerriBek } from './scrapers/merri-bek';

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = 'https://rnbolrhsrhipljoaiwuw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYm9scmhzcmhpcGxqb2Fpd3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzQ3MjgsImV4cCI6MjA5MDQxMDcyOH0.105xmarhEYsmVkgCL0WloInOWGnsuopesVbmG3uenqU';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface CollectionEvent {
  date: string;
  bins: string[];
  isHoliday?: boolean;
}

// Registry of scraper functions — add new councils here
const SCRAPERS: Record<string, (address: string) => Promise<CollectionEvent[]>> = {
  'merri-bek': scrapeMerriBek,
  // 'darebin': scrapeDarebin,
  // 'yarra': scrapeYarra,
};

/**
 * Merri-bek holiday rules:
 * - Only Christmas Day (Dec 25) and New Year's Day (Jan 1) cancel collections.
 * - For the 2 weeks following each holiday, Thursday and Friday collections
 *   are pushed forward by 1 day (Thu→Fri, Fri→Sat).
 * - All other public holidays have normal collection.
 */
function applyMerriBekHolidayRules(events: CollectionEvent[]): (CollectionEvent & { isHoliday?: boolean })[] {
  const result: (CollectionEvent & { isHoliday?: boolean })[] = [];

  // Find the year range from the events
  const years = new Set(events.map(e => parseInt(e.date.split('-')[0])));

  // Build list of affected holidays (Christmas + New Year's)
  const holidays: string[] = [];
  for (const year of years) {
    holidays.push(`${year}-12-25`); // Christmas Day
    holidays.push(`${year}-01-01`); // New Year's Day
  }

  // For each holiday, determine the 2-week affected window
  const affectedRanges: { start: Date; end: Date }[] = [];
  for (const h of holidays) {
    const holidayDate = new Date(h + 'T00:00:00');
    const endDate = new Date(holidayDate);
    endDate.setDate(endDate.getDate() + 14); // 2 weeks
    affectedRanges.push({ start: holidayDate, end: endDate });
  }

  for (const event of events) {
    const eventDate = new Date(event.date + 'T00:00:00');
    const dayOfWeek = eventDate.getDay(); // 0=Sun, 4=Thu, 5=Fri

    // Check if this date IS Christmas or New Year's
    const isChristmasOrNewYears = holidays.includes(event.date);

    if (isChristmasOrNewYears) {
      // Mark as holiday — no collection
      result.push({ ...event, bins: event.bins, isHoliday: true });
      continue;
    }

    // Check if this date falls in an affected 2-week window AND is Thu or Fri
    const inAffectedWindow = affectedRanges.some(
      r => eventDate >= r.start && eventDate < r.end
    );

    if (inAffectedWindow && (dayOfWeek === 4 || dayOfWeek === 5)) {
      // Push forward by 1 day (Thu→Fri, Fri→Sat)
      const newDate = new Date(eventDate);
      newDate.setDate(newDate.getDate() + 1);
      const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
      result.push({ date: newDateStr, bins: event.bins });
    } else {
      // Normal collection — no holiday
      result.push({ ...event });
    }
  }

  return result;
}

// POST /api/setup — receives an address (and optional existingUserId), identifies council, scrapes schedule
app.post('/api/setup', async (req, res) => {
  const { address, existingUserId } = req.body;

  if (!address || address.trim().length < 5) {
    return res.status(400).json({ error: 'Please enter a valid address' });
  }

  try {
    console.log(`\n=== Setup request: ${address} ===`);
    if (existingUserId) {
      console.log(`Existing user: ${existingUserId} — will update`);
    }

    // 1. Look up which council this address belongs to
    const councilInfo = lookupCouncil(address);

    if (!councilInfo) {
      return res.status(400).json({
        error: 'Sorry, your council isn\'t supported yet. We currently support Merri-bek council areas (Brunswick, Coburg, Glenroy, Pascoe Vale, etc.)',
      });
    }

    console.log(`Council: ${councilInfo.councilName} (${councilInfo.scraperId})`);

    // 2. Check we have a scraper for this council
    const scraper = SCRAPERS[councilInfo.scraperId];
    if (!scraper) {
      return res.status(400).json({
        error: `We've identified your council as ${councilInfo.councilName}, but we don't have a scraper for it yet. Stay tuned!`,
      });
    }

    // 3. Get the council from Supabase
    const { data: council } = await supabase
      .from('councils')
      .select('id')
      .eq('scraper_id', councilInfo.scraperId)
      .single();

    if (!council) {
      return res.status(500).json({ error: 'Council not found in database' });
    }

    // 4. Run the council-specific scraper
    const events = await scraper(address);
    console.log(`Scraped ${events.length} events`);

    if (events.length === 0) {
      return res.status(400).json({
        error: `Could not find bin schedule for this address on the ${councilInfo.councilName} website.`,
      });
    }

    let userId: string;
    let zone: string;

    if (existingUserId) {
      // Reuse existing user — delete their old schedule first
      userId = existingUserId;
      zone = `user_${userId}`;

      // Delete old schedule
      const { error: deleteError } = await supabase
        .from('collection_schedule')
        .delete()
        .eq('zone', zone);

      if (deleteError) {
        console.error('Error deleting old schedule:', deleteError.message);
      } else {
        console.log(`Cleared old schedule for zone ${zone}`);
      }

      // Update user's address and council
      const { error: updateError } = await supabase
        .from('users')
        .update({
          address: address.trim(),
          council_id: council.id,
          collection_zone: zone,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user:', updateError.message);
      }

      console.log(`Updated user: ${userId}`);
    } else {
      // New user
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          address: address.trim(),
          council_id: council.id,
          collection_zone: 'pending',
        })
        .select()
        .single();

      if (userError) {
        console.error('Error creating user:', userError.message);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      userId = user.id;
      zone = `user_${userId}`;

      // Set the proper zone
      await supabase
        .from('users')
        .update({ collection_zone: zone })
        .eq('id', userId);

      console.log(`Created user: ${userId}, zone: ${zone}`);
    }

    // 5. Apply council-specific holiday rules
    const processedEvents = councilInfo.scraperId === 'merri-bek'
      ? applyMerriBekHolidayRules(events)
      : events;

    // 6. Insert new schedule
    const rows = processedEvents.map(event => ({
      council_id: council.id,
      zone,
      date: event.date,
      bins: event.bins,
      is_holiday: event.isHoliday || false,
    }));

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error: insertError } = await supabase
        .from('collection_schedule')
        .insert(batch);

      if (insertError) {
        console.error(`Insert error:`, insertError.message);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Inserted ${inserted} events for user ${userId}`);

    res.json({
      success: true,
      userId,
      zone,
      councilName: councilInfo.councilName,
      eventsCount: inserted,
    });

  } catch (err: any) {
    console.error('Setup error:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong' });
  }
});

// POST /api/save-push-token — save a user's push token
app.post('/api/save-push-token', async (req, res) => {
  const { userId, pushToken } = req.body;

  if (!userId || !pushToken) {
    return res.status(400).json({ error: 'userId and pushToken required' });
  }

  const { error } = await supabase
    .from('users')
    .update({ push_token: pushToken })
    .eq('id', userId);

  if (error) {
    console.error('Error saving push token:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log(`Push token saved for user ${userId}`);
  res.json({ success: true });
});

// POST /api/test-notification — send a test notification to a specific user
app.post('/api/test-notification', async (req, res) => {
  const { userId } = req.body;

  try {
    const { Expo } = await import('expo-server-sdk');
    const expo = new Expo();

    // Get user's push token
    const { data: user } = await supabase
      .from('users')
      .select('push_token, address')
      .eq('id', userId)
      .single();

    if (!user || !user.push_token) {
      return res.status(400).json({ error: 'User has no push token. Open the app first to register.' });
    }

    if (!Expo.isExpoPushToken(user.push_token)) {
      return res.status(400).json({ error: 'Invalid push token' });
    }

    const receipts = await expo.sendPushNotificationsAsync([{
      to: user.push_token,
      sound: 'default',
      title: 'Bin Night',
      body: 'This is a test notification. Your bins are set up!',
      data: { test: true },
    }]);

    console.log('Test notification sent:', receipts);
    res.json({ success: true, receipts });

  } catch (err: any) {
    console.error('Test notification error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cleanup-user — delete old user data when changing address
app.post('/api/cleanup-user', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    // Get the user's zone so we can delete their schedule
    const { data: user } = await supabase
      .from('users')
      .select('collection_zone')
      .eq('id', userId)
      .single();

    if (user && user.collection_zone) {
      // Delete their schedule data
      const { error: scheduleError } = await supabase
        .from('collection_schedule')
        .delete()
        .eq('zone', user.collection_zone);

      if (scheduleError) {
        console.error('Error deleting schedule:', scheduleError.message);
      } else {
        console.log(`Deleted schedule for zone ${user.collection_zone}`);
      }
    }

    // Delete the user record
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      console.error('Error deleting user:', userError.message);
    } else {
      console.log(`Deleted user ${userId}`);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Cleanup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/send-notifications — triggered by cron-job.org every hour
app.get('/api/send-notifications', async (req, res) => {
  try {
    const { sendNotifications } = await import('./send-notifications');
    await sendNotifications();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Notification error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bins-out-status — check if bins are out for a household (by address)
app.get('/api/bins-out-status', async (req, res) => {
  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }

  const { data } = await supabase
    .from('household_status')
    .select('bins_out_date')
    .eq('address', address.trim().toLowerCase())
    .single();

  res.json({ binsOutDate: data?.bins_out_date || null });
});

// POST /api/bins-out — mark bins as out for a household
app.post('/api/bins-out', async (req, res) => {
  const { address, collectionDate } = req.body;
  if (!address || !collectionDate) {
    return res.status(400).json({ error: 'address and collectionDate required' });
  }

  const normalizedAddress = address.trim().toLowerCase();

  const { error } = await supabase
    .from('household_status')
    .upsert({
      address: normalizedAddress,
      bins_out_date: collectionDate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'address' });

  if (error) {
    console.error('Error setting bins out:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log(`Bins marked out for ${normalizedAddress} (collection: ${collectionDate})`);
  res.json({ success: true });
});

// POST /api/bins-out-undo — undo bins out for a household
app.post('/api/bins-out-undo', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'address required' });
  }

  const normalizedAddress = address.trim().toLowerCase();

  const { error } = await supabase
    .from('household_status')
    .delete()
    .eq('address', normalizedAddress);

  if (error) {
    console.error('Error undoing bins out:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log(`Bins out cleared for ${normalizedAddress}`);
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nBinNight API server running on http://localhost:${PORT}`);
  console.log('Ready to accept address setup requests\n');
});
