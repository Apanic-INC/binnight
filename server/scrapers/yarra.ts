import type { CollectionEvent } from '../index';
import * as fs from 'fs';
import * as path from 'path';

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

// Reference dates for recycling per zone (extracted from council PDF calendars).
// Zones on the same collection day have opposite recycling/glass fortnights.
// Glass reference date = recycling reference date + 7 days (they alternate).
const ZONE_RECYCLE_REF: Record<number, string> = {
  1:  '2025-07-07', // Monday
  2:  '2025-07-14', // Monday
  3:  '2025-07-08', // Tuesday
  4:  '2025-07-01', // Tuesday
  5:  '2025-07-09', // Wednesday
  6:  '2025-07-02', // Wednesday
  7:  '2025-07-10', // Thursday
  8:  '2025-07-03', // Thursday
  9:  '2025-07-11', // Friday
  10: '2025-07-04', // Friday
};

interface ZonePolygon {
  zone_num: number;
  collection_day: string;
  rings: number[][][];
}

// Load zone polygons from pre-cached file (fetched from Yarra ArcGIS, simplified)
let cachedZones: ZonePolygon[] | null = null;
function loadZones(): ZonePolygon[] {
  if (cachedZones) return cachedZones;
  const zonesPath = path.join(__dirname, 'yarra-zones.json');
  cachedZones = JSON.parse(fs.readFileSync(zonesPath, 'utf-8'));
  return cachedZones!;
}

/**
 * Ray-casting point-in-polygon test.
 */
function pointInPolygon(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Find which zone a coordinate falls in.
 */
function findZone(lng: number, lat: number): ZonePolygon | null {
  const zones = loadZones();
  for (const zone of zones) {
    for (const ring of zone.rings) {
      if (pointInPolygon(lng, lat, ring)) {
        return zone;
      }
    }
  }
  return null;
}

/**
 * Geocode an address using OpenStreetMap Nominatim (free, no API key).
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const query = `${address}, City of Yarra, Victoria, Australia`;
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'au',
  });

  const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      'User-Agent': 'BinNight-App/1.0 (apanic.inc@gmail.com)',
    },
  });

  if (!resp.ok) {
    throw new Error(`Nominatim geocoding error: ${resp.status}`);
  }

  const results = await resp.json();
  if (results.length === 0) return null;

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
  };
}

/**
 * Generate dates at a fixed interval, advancing past today.
 */
function generateDates(startDateStr: string, count: number, intervalDays: number): string[] {
  const start = new Date(startDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const msInterval = intervalDays * 24 * 60 * 60 * 1000;
  const elapsed = today.getTime() - start.getTime();
  if (elapsed > 0) {
    const periodsElapsed = Math.floor(elapsed / msInterval);
    start.setTime(start.getTime() + periodsElapsed * msInterval);
    if (start.getTime() < today.getTime()) {
      start.setTime(start.getTime() + msInterval);
    }
  }

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * msInterval);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

/**
 * Merge events sharing the same date into single entries.
 */
function mergeEvents(events: CollectionEvent[]): CollectionEvent[] {
  const byDate = new Map<string, string[]>();
  for (const event of events) {
    const existing = byDate.get(event.date) || [];
    for (const bin of event.bins) {
      if (!existing.includes(bin)) existing.push(bin);
    }
    byDate.set(event.date, existing);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bins]) => ({ date, bins }));
}

export async function scrapeYarra(address: string): Promise<CollectionEvent[]> {
  console.log(`[yarra] Scraping for: ${address}`);

  // Clean address for geocoding (keep it human-readable for Nominatim)
  let cleanAddress = address
    .replace(/,/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Remove state abbreviation and postcode for cleaner geocoding
  cleanAddress = cleanAddress
    .replace(new RegExp(`\\b(${STATES.join('|')})\\b`, 'gi'), '')
    .replace(/\s*\d{4}\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  console.log(`[yarra] Geocoding: ${cleanAddress}`);

  // Step 1: Geocode address → coordinates
  const coords = await geocodeAddress(cleanAddress);
  if (!coords) {
    throw new Error('Could not find this address. Please check the address and try again.');
  }

  console.log(`[yarra] Geocoded to: (${coords.lng}, ${coords.lat})`);

  // Step 2: Find zone using local polygon data
  const zone = findZone(coords.lng, coords.lat);
  if (!zone) {
    throw new Error('This address does not appear to be in the City of Yarra collection area.');
  }

  const zoneNum = zone.zone_num;
  const collectionDay = zone.collection_day;
  console.log(`[yarra] Zone: ${zoneNum}, Collection day: ${collectionDay}`);

  // Get reference dates for this zone
  const recycleRef = ZONE_RECYCLE_REF[zoneNum];
  if (!recycleRef) {
    throw new Error(`Unknown zone number: ${zoneNum}`);
  }

  // Glass reference = recycling reference + 7 days
  const recycleDate = new Date(recycleRef + 'T00:00:00');
  const glassDate = new Date(recycleDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const glassRef = `${glassDate.getFullYear()}-${String(glassDate.getMonth() + 1).padStart(2, '0')}-${String(glassDate.getDate()).padStart(2, '0')}`;

  // Generate events
  const allEvents: CollectionEvent[] = [];

  // Rubbish + FOGO (weekly)
  const rubbishDates = generateDates(recycleRef, 52, 7);
  for (const date of rubbishDates) {
    allEvents.push({ date, bins: ['rubbish', 'fogo'] });
  }

  // Recycling (fortnightly)
  const recycleDates = generateDates(recycleRef, 26, 14);
  for (const date of recycleDates) {
    allEvents.push({ date, bins: ['recycling'] });
  }

  // Glass (fortnightly, alternates with recycling)
  const glassDates = generateDates(glassRef, 26, 14);
  for (const date of glassDates) {
    allEvents.push({ date, bins: ['glass'] });
  }

  const merged = mergeEvents(allEvents);
  console.log(`[yarra] Generated ${merged.length} events for zone ${zoneNum}`);
  return merged;
}
