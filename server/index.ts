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
}

// Registry of scraper functions — add new councils here
const SCRAPERS: Record<string, (address: string) => Promise<CollectionEvent[]>> = {
  'merri-bek': scrapeMerriBek,
  // 'darebin': scrapeDarebin,
  // 'yarra': scrapeYarra,
};

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

    // 5. Insert new schedule
    const rows = events.map(event => ({
      council_id: council.id,
      zone,
      date: event.date,
      bins: event.bins.filter(b => b !== 'holiday'),
      is_holiday: event.bins.includes('holiday'),
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
      title: 'Bin Night!',
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nBinNight API server running on http://localhost:${PORT}`);
  console.log('Ready to accept address setup requests\n');
});
