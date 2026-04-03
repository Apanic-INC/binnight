import { chromium } from 'playwright';
import type { CollectionEvent } from '../index';

const CALENDAR_URL = 'https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/waste-calendar26/';
const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export async function scrapeMerriBek(address: string): Promise<CollectionEvent[]> {
  console.log(`[merri-bek] Scraping for: ${address}`);

  // Clean the address for Merri-bek's website:
  // - Remove state abbreviations (site doesn't use them)
  // - Remove commas (site doesn't use them)
  const cleanAddress = address
    .replace(new RegExp(`\\b(${STATES.join('|')})\\b`, 'gi'), '')
    .replace(/,/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Extract just the street part for typing (number + street name + type)
  // e.g. "174 Donald St Brunswick East 3057" -> "174 Donald St"
  const shortAddress = cleanAddress.split(/\s+/).slice(0, 3).join(' ').trim();

  console.log(`[merri-bek] Clean: ${cleanAddress}`);
  console.log(`[merri-bek] Typing: ${shortAddress}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(CALENDAR_URL, { waitUntil: 'networkidle' });

    // Type address
    const addressInput = page.locator('#address');
    await addressInput.click();
    await addressInput.pressSequentially(shortAddress, { delay: 100 });
    await page.waitForTimeout(2000);

    let found = false;

    // Wait for dropdown and find best match
    for (let attempt = 0; attempt < 8; attempt++) {
      const menuItems = page.locator('.ui-autocomplete .ui-menu-item');
      const count = await menuItems.count();

      if (count > 0) {
        const upperClean = cleanAddress.toUpperCase();
        let bestMatch = -1;
        let bestScore = 0;

        for (let i = 0; i < count; i++) {
          const text = await menuItems.nth(i).innerText().catch(() => '');
          const upperText = text.toUpperCase().trim();

          const addressParts = upperClean
            .split(/[\s,]+/)
            .filter(p => p.length > 1 && !STATES.includes(p.toUpperCase()));
          let score = 0;
          for (const part of addressParts) {
            if (upperText.includes(part)) score++;
          }

          console.log(`[merri-bek]   Suggestion ${i}: "${text}" (score: ${score}/${addressParts.length})`);

          if (score > bestScore) {
            bestScore = score;
            bestMatch = i;
          }
        }

        if (bestMatch >= 0) {
          console.log(`[merri-bek] Clicking best match: ${bestMatch} (score: ${bestScore})`);
          await menuItems.nth(bestMatch).click();
          found = true;
          break;
        }
      }

      await page.waitForTimeout(1000);
    }

    if (!found) {
      // Retry
      console.log('[merri-bek] Retrying address entry...');
      await addressInput.clear();
      await page.waitForTimeout(500);
      await addressInput.pressSequentially(shortAddress, { delay: 120 });
      await page.waitForTimeout(3000);

      const menuItems = page.locator('.ui-autocomplete .ui-menu-item');
      if (await menuItems.count() > 0) {
        await menuItems.first().click();
        found = true;
      }
    }

    if (!found) {
      throw new Error('Address not found on the Merri-bek council website.');
    }

    await page.waitForTimeout(1000);

    // Click Search
    await page.locator('.search-address button.button').click();

    // Wait for calendar
    await page.waitForFunction(() => {
      const imgs = document.querySelectorAll('.bin-calendar__day img');
      return imgs.length > 0;
    }, { timeout: 15000 });

    // Extract events
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
          // Skip holiday images — we handle holidays with our own rules
          if (src.includes('bin-holiday')) return;
          if (src.includes('bin.png') || src.includes('bin-')) {
            if (!bins.includes('fogo')) bins.push('fogo');
            if (!bins.includes('rubbish')) bins.push('rubbish');
          }
          if (src.includes('recycle')) bins.push('recycling');
          if (src.includes('glass')) bins.push('glass');
        });

        if (bins.length > 0) {
          results.push({ date: dateStr, bins });
        }
      }

      return results;
    });

    console.log(`[merri-bek] Extracted ${events.length} events`);
    return events;

  } finally {
    await browser.close();
  }
}
