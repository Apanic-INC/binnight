import type { CollectionEvent } from '../index';
import * as fs from 'fs';
import * as path from 'path';

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

// Suburb-based fallback for areas not covered by the 2021 open data polygons.
// These are derived from the 2025-26 PDF calendar maps.
const SUBURB_DAY_FALLBACK: Record<string, string> = {
  'port melbourne': 'Tuesday',
  'fishermans bend': 'Tuesday',
  'flemington': 'Thursday',
  'south yarra': 'Tuesday',
  'south wharf': 'Tuesday',
};

// Reference dates for recycling per collection day (from 2025-26 PDF calendars).
// Mon/Tue/Wed and Thu/Fri alternate recycling fortnights.
const DAY_RECYCLE_REF: Record<string, string> = {
  'Monday':    '2025-07-07',
  'Tuesday':   '2025-07-08',
  'Wednesday': '2025-07-09',
  'Thursday':  '2025-07-03',
  'Friday':    '2025-07-04',
};

interface ZonePolygon {
  collection_day: string;
  rings: number[][][];
}

// Load zone polygons from pre-cached file (from Melbourne Open Data portal)
let cachedZones: ZonePolygon[] | null = null;
function loadZones(): ZonePolygon[] {
  if (cachedZones) return cachedZones;
  const zonesPath = path.join(__dirname, 'melbourne-zones.json');
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
 * Returns the collection day (Monday–Friday) or null.
 */
function findZone(lng: number, lat: number): string | null {
  const zones = loadZones();
  for (const zone of zones) {
    // First ring is outer boundary, subsequent rings are holes
    const outerRing = zone.rings[0];
    if (pointInPolygon(lng, lat, outerRing)) {
      // Check if point is in a hole
      let inHole = false;
      for (let i = 1; i < zone.rings.length; i++) {
        if (pointInPolygon(lng, lat, zone.rings[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) {
        return zone.collection_day;
      }
    }
  }
  return null;
}

/**
 * Geocode an address using Photon (Komoot) — free OSM-based geocoder.
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
    lat: '-37.81',   // Bias toward Melbourne CBD
    lon: '144.96',
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

export async function scrapeMelbourne(address: string): Promise<CollectionEvent[]> {
  console.log(`[melbourne] Scraping for: ${address}`);

  // Clean address for geocoding
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

  console.log(`[melbourne] Geocoding: ${cleanAddress}`);

  // Step 1: Geocode address
  const coords = await geocodeAddress(cleanAddress);
  if (!coords) {
    throw new Error('Could not find this address. Please check the address and try again.');
  }

  console.log(`[melbourne] Geocoded to: (${coords.lng}, ${coords.lat})`);

  // Step 2: Find collection day using local polygon data
  let collectionDay = findZone(coords.lng, coords.lat);

  // Fallback: if polygon lookup fails, try suburb-based lookup
  if (!collectionDay) {
    const addrLower = address.toLowerCase();
    for (const [suburb, day] of Object.entries(SUBURB_DAY_FALLBACK)) {
      if (addrLower.includes(suburb)) {
        console.log(`[melbourne] Polygon miss, using suburb fallback: ${suburb} → ${day}`);
        collectionDay = day;
        break;
      }
    }
  }

  if (!collectionDay) {
    throw new Error('This address does not appear to be in the City of Melbourne collection area.');
  }

  console.log(`[melbourne] Collection day: ${collectionDay}`);

  // Get reference date for recycling
  const recycleRef = DAY_RECYCLE_REF[collectionDay];
  if (!recycleRef) {
    throw new Error(`Unknown collection day: ${collectionDay}`);
  }

  // Generate events
  const allEvents: CollectionEvent[] = [];

  // Rubbish + FOGO (weekly) — Melbourne collects both weekly
  const rubbishDates = generateDates(recycleRef, 52, 7);
  for (const date of rubbishDates) {
    allEvents.push({ date, bins: ['rubbish', 'fogo'] });
  }

  // Recycling (fortnightly)
  const recycleDates = generateDates(recycleRef, 26, 14);
  for (const date of recycleDates) {
    allEvents.push({ date, bins: ['recycling'] });
  }

  // No curbside glass — Melbourne uses communal glass hubs

  const merged = mergeEvents(allEvents);
  console.log(`[melbourne] Generated ${merged.length} events for ${collectionDay}`);
  return merged;
}
