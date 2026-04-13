import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { lookupCouncil } from './council-lookup';
import { scrapeMerriBek } from './scrapers/merri-bek';
import { scrapeDarebin } from './scrapers/darebin';
import { scrapeYarra } from './scrapers/yarra';

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Auth middleware — requires Bearer token matching BN_API_KEY
const BN_API_KEY = process.env.BN_API_KEY || '';
const CRON_KEY = process.env.CRON_KEY || '';

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${BN_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireCronAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.query.key as string;
  if (!key || key !== CRON_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export interface CollectionEvent {
  date: string;
  bins: string[];
  isHoliday?: boolean;
}

// Registry of scraper functions — add new councils here
const SCRAPERS: Record<string, (address: string) => Promise<CollectionEvent[]>> = {
  'merri-bek': scrapeMerriBek,
  'darebin': scrapeDarebin,
  'yarra': scrapeYarra,
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

/**
 * Darebin holiday rules:
 * - ALL Victorian public holidays cancel collections.
 * - Collections shift forward by 1 day after each holiday.
 * - If shifted date is also a holiday, shift again.
 */
function applyDarebinHolidayRules(events: (CollectionEvent & { isHoliday?: boolean })[]): (CollectionEvent & { isHoliday?: boolean })[] {
  // Victorian public holidays (hardcoded for 2025-2027)
  const holidays = new Set([
    // 2025
    '2025-01-01', // New Year's Day
    '2025-01-27', // Australia Day (observed, 26th is Sunday)
    '2025-03-10', // Labour Day (VIC)
    '2025-04-18', // Good Friday
    '2025-04-19', // Saturday before Easter
    '2025-04-21', // Easter Monday
    '2025-04-25', // ANZAC Day
    '2025-06-09', // King's Birthday
    '2025-09-26', // AFL Grand Final Friday
    '2025-11-04', // Melbourne Cup
    '2025-12-25', // Christmas Day
    '2025-12-26', // Boxing Day
    // 2026
    '2026-01-01', // New Year's Day
    '2026-01-26', // Australia Day
    '2026-03-09', // Labour Day (VIC)
    '2026-04-03', // Good Friday
    '2026-04-04', // Saturday before Easter
    '2026-04-06', // Easter Monday
    '2026-04-25', // ANZAC Day (Saturday — observed Monday 27th)
    '2026-04-27', // ANZAC Day observed
    '2026-06-08', // King's Birthday
    '2026-09-25', // AFL Grand Final Friday (estimated)
    '2026-11-03', // Melbourne Cup
    '2026-12-25', // Christmas Day
    '2026-12-28', // Boxing Day (observed, 26th is Saturday)
    // 2027
    '2027-01-01', // New Year's Day
    '2027-01-26', // Australia Day
    '2027-03-08', // Labour Day (VIC)
    '2027-03-26', // Good Friday
    '2027-03-27', // Saturday before Easter
    '2027-03-29', // Easter Monday
    '2027-04-26', // ANZAC Day (observed, 25th is Sunday)
    '2027-06-14', // King's Birthday
    '2027-11-02', // Melbourne Cup
    '2027-12-25', // Christmas Day (Saturday — observed Monday 27th)
    '2027-12-27', // Christmas observed
    '2027-12-26', // Boxing Day (Sunday — observed Tuesday 28th)
    '2027-12-28', // Boxing Day observed
  ]);

  const result: (CollectionEvent & { isHoliday?: boolean })[] = [];

  for (const event of events) {
    if (holidays.has(event.date)) {
      // Mark as holiday — no collection
      result.push({ ...event, isHoliday: true });

      // Shift to the next non-holiday day
      const shifted = new Date(event.date + 'T00:00:00');
      shifted.setDate(shifted.getDate() + 1);
      let shiftedStr = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;

      // Keep shifting if the new date is also a holiday
      while (holidays.has(shiftedStr)) {
        shifted.setDate(shifted.getDate() + 1);
        shiftedStr = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
      }

      result.push({ date: shiftedStr, bins: event.bins });
    } else {
      result.push({ ...event });
    }
  }

  return result;
}

/**
 * Yarra holiday rules:
 * - Only Christmas Day (Dec 25) shifts collection forward by 1 day.
 * - All other public holidays have normal collection.
 */
function applyYarraHolidayRules(events: CollectionEvent[]): (CollectionEvent & { isHoliday?: boolean })[] {
  const result: (CollectionEvent & { isHoliday?: boolean })[] = [];

  const years = new Set(events.map(e => parseInt(e.date.split('-')[0])));
  const christmasDays = new Set<string>();
  for (const year of years) {
    christmasDays.add(`${year}-12-25`);
  }

  for (const event of events) {
    if (christmasDays.has(event.date)) {
      // Mark Christmas as holiday
      result.push({ ...event, isHoliday: true });

      // Shift to next day (Boxing Day)
      const shifted = new Date(event.date + 'T00:00:00');
      shifted.setDate(shifted.getDate() + 1);
      const shiftedStr = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
      result.push({ date: shiftedStr, bins: event.bins });
    } else {
      result.push({ ...event });
    }
  }

  return result;
}

// POST /api/setup — receives an address (and optional existingUserId), identifies council, scrapes schedule
app.post('/api/setup', requireAuth, async (req, res) => {
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
        error: 'Sorry, your council isn\'t supported yet. We currently support Merri-bek, Darebin, and Yarra council areas.',
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
    let processedEvents: (CollectionEvent & { isHoliday?: boolean })[];
    if (councilInfo.scraperId === 'merri-bek') {
      processedEvents = applyMerriBekHolidayRules(events);
    } else if (councilInfo.scraperId === 'darebin') {
      processedEvents = applyDarebinHolidayRules(events);
    } else if (councilInfo.scraperId === 'yarra') {
      processedEvents = applyYarraHolidayRules(events);
    } else {
      processedEvents = events;
    }

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
app.post('/api/save-push-token', requireAuth, async (req, res) => {
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
app.post('/api/test-notification', requireAuth, async (req, res) => {
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
app.post('/api/cleanup-user', requireAuth, async (req, res) => {
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
app.get('/api/send-notifications', requireCronAuth, async (req, res) => {
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
app.get('/api/bins-out-status', requireAuth, async (req, res) => {
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
app.post('/api/bins-out', requireAuth, async (req, res) => {
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
app.post('/api/bins-out-undo', requireAuth, async (req, res) => {
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
