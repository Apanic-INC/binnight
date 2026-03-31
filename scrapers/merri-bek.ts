import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const ADDRESS = '174 Donald St';
const CALENDAR_URL = 'https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/waste-calendar26/';

// Supabase connection
const SUPABASE_URL = 'https://rnbolrhsrhipljoaiwuw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYm9scmhzcmhpcGxqb2Fpd3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzQ3MjgsImV4cCI6MjA5MDQxMDcyOH0.105xmarhEYsmVkgCL0WloInOWGnsuopesVbmG3uenqU';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CollectionEvent {
  date: string;       // YYYY-MM-DD
  bins: string[];     // e.g. ["fogo", "rubbish"]
}

async function scrapeMerriBek() {
  console.log(`Starting scraper for: ${ADDRESS}`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Navigating to Merri-bek waste calendar...');
  await page.goto(CALENDAR_URL, { waitUntil: 'networkidle' });

  // Step 1: Type address into the #address input (slowly, to trigger autocomplete)
  const addressInput = page.locator('#address');
  console.log('Typing address...');
  await addressInput.click();
  await addressInput.pressSequentially(ADDRESS, { delay: 80 });

  // Step 2: Wait for jQuery UI autocomplete dropdown to appear
  console.log('Waiting for autocomplete dropdown...');
  try {
    await page.locator('.ui-autocomplete .ui-menu-item').first().waitFor({ state: 'visible', timeout: 8000 });
    console.log('Dropdown appeared — clicking first suggestion...');
    await page.locator('.ui-autocomplete .ui-menu-item').first().click();
  } catch {
    console.log('jQuery UI dropdown not found, trying other selectors...');
    try {
      await page.locator('#selectedAddressSuggestions li, #selectedAddressSuggestions a').first().waitFor({ state: 'visible', timeout: 5000 });
      await page.locator('#selectedAddressSuggestions li, #selectedAddressSuggestions a').first().click();
    } catch {
      console.log('No dropdown found. Taking screenshot...');
      await page.screenshot({ path: 'debug-no-dropdown.png', fullPage: true });
    }
  }

  await page.waitForTimeout(1000);

  // Step 3: Click the Search button within the waste calendar form
  console.log('Clicking Search button...');
  await page.locator('.search-address button.button').click();

  // Step 4: Wait for the calendar JavaScript to populate the day cells with images
  console.log('Waiting for calendar to load...');
  await page.waitForFunction(() => {
    const imgs = document.querySelectorAll('.bin-calendar__day img');
    return imgs.length > 0;
  }, { timeout: 15000 }).catch(() => {
    console.log('Timed out waiting for calendar images — will try anyway...');
  });

  await page.screenshot({ path: 'debug-calendar.png', fullPage: true });

  // Step 5: Extract collection events by checking which <img> overlays
  // are inside each day cell
  const events: CollectionEvent[] = await page.evaluate(() => {
    const results: { date: string; bins: string[] }[] = [];
    const cells = document.querySelectorAll('.bin-calendar__day');

    for (const cell of cells) {
      const id = cell.id;
      if (!id) continue;

      const parts = id.split('-');
      if (parts.length !== 3) continue;

      const [day, month, year] = parts;
      const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      const imgs = cell.querySelectorAll('img');
      const bins: string[] = [];

      imgs.forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.includes('bin-holiday')) {
          bins.push('holiday');
        } else if (src.includes('bin.png') || src.includes('bin-')) {
          if (!bins.includes('fogo')) bins.push('fogo');
          if (!bins.includes('rubbish')) bins.push('rubbish');
        }
        if (src.includes('recycle')) {
          bins.push('recycling');
        }
        if (src.includes('glass')) {
          bins.push('glass');
        }
      });

      if (bins.length > 0) {
        results.push({ date: dateStr, bins });
      }
    }

    return results;
  });

  // Print upcoming collections
  const rubbishNext = await page.locator('#bin').innerText().catch(() => '');
  const fogoNext = await page.locator('#fogoBin').innerText().catch(() => '');
  const recycleNext = await page.locator('#recycleBin').innerText().catch(() => '');
  const glassNext = await page.locator('#glassBin').innerText().catch(() => '');

  console.log('\n--- Upcoming collections ---');
  if (rubbishNext) console.log(`  General rubbish: ${rubbishNext}`);
  if (fogoNext) console.log(`  FOGO: ${fogoNext}`);
  if (recycleNext) console.log(`  Recycling: ${recycleNext}`);
  if (glassNext) console.log(`  Glass: ${glassNext}`);

  console.log(`\nExtracted ${events.length} collection events from calendar`);

  // Save JSON backup
  fs.writeFileSync('schedule.json', JSON.stringify(events, null, 2));

  // ============================================
  // Step 6: Store data in Supabase
  // ============================================
  console.log('\n--- Saving to Supabase ---');

  // Get the Merri-bek council ID
  const { data: council, error: councilError } = await supabase
    .from('councils')
    .select('id')
    .eq('scraper_id', 'merri-bek')
    .single();

  if (councilError || !council) {
    console.error('Could not find Merri-bek council in database:', councilError?.message);
    await browser.close();
    return;
  }

  console.log(`Found Merri-bek council: ${council.id}`);

  // Clear any existing schedule for this council (so we don't get duplicates)
  const { error: deleteError } = await supabase
    .from('collection_schedule')
    .delete()
    .eq('council_id', council.id);

  if (deleteError) {
    console.error('Error clearing old schedule:', deleteError.message);
  }

  // Insert all collection events
  const rows = events.map(event => ({
    council_id: council.id,
    zone: 'default',
    date: event.date,
    bins: event.bins.filter(b => b !== 'holiday'),
    is_holiday: event.bins.includes('holiday'),
  }));

  // Insert in batches of 50 (Supabase has limits)
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error: insertError } = await supabase
      .from('collection_schedule')
      .insert(batch);

    if (insertError) {
      console.error(`Error inserting batch ${i}:`, insertError.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Inserted ${inserted} collection events into Supabase`);

  await browser.close();
  console.log('\nDone!');
}

scrapeMerriBek().catch(console.error);
