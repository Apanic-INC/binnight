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
 * Geocode an address using Photon (Komoot) — free OSM-based geocoder.
 * Unlike Nominatim, Photon doesn't block cloud provider IPs.
 *
 * Photon ranks named POIs above exact street-number matches (e.g. it may
 * return "Some Cafe at 926 X St" above "851 X St"). To avoid classifying
 * the wrong building near a zone boundary, we pull several candidates and
 * prefer the one whose housenumber matches the number in the user's query.
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const query = `${address}, Victoria, Australia`;
  const params = new URLSearchParams({
    q: query,
    limit: '10',
    lang: 'en',
    lat: '-37.8',   // Bias toward Melbourne
    lon: '145.0',
  });

  const resp = await fetch(`https://photon.komoot.io/api/?${params}`, {
    headers: {
      'User-Agent': 'BinNight-App/1.0 (apanic.inc@gmail.com)',
    },
  });

  if (!resp.ok) {
    throw new Error(`Geocoding error: ${resp.status}`);
  }

  const data = await resp.json();
  const features = data.features || [];
  if (features.length === 0) return null;

  const housenumMatch = address.trim().match(/^(\d+[a-z]?)\b/i);
  const wanted = housenumMatch ? housenumMatch[1].toLowerCase() : null;

  let chosen = features[0];
  if (wanted) {
    const exactMatch = features.find((f: any) =>
      String(f.properties?.housenumber || '').toLowerCase() === wanted
    );
    if (exactMatch) chosen = exactMatch;
  }

  const [lng, lat] = chosen.geometry.coordinates;
  return { lat, lng };
}

/**
 * Generate dates at a fixed interval, advancing past today.
 * Uses UTC-based calendar arithmetic to avoid DST transition bugs
 * (e.g. Australian AEDT→AEST fall-back causes ms-based arithmetic
 * to drift by 1 hour, which can roll getDate() back a day).
 */
function generateDates(startDateStr: string, count: number, intervalDays: number): string[] {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  // Advance start past today by whole intervalDays steps
  while (start.getTime() < today.getTime()) {
    start.setUTCDate(start.getUTCDate() + intervalDays);
  }

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + i * intervalDays);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
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

  // Glass reference = recycling reference + 7 days (UTC-safe; avoids DST drift)
  const [ry, rm, rd] = recycleRef.split('-').map(Number);
  const glassDate = new Date(Date.UTC(ry, rm - 1, rd));
  glassDate.setUTCDate(glassDate.getUTCDate() + 7);
  const glassRef = `${glassDate.getUTCFullYear()}-${String(glassDate.getUTCMonth() + 1).padStart(2, '0')}-${String(glassDate.getUTCDate()).padStart(2, '0')}`;

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
