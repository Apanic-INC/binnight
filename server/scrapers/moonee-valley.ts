import type { CollectionEvent } from '../index';
import * as fs from 'fs';
import * as path from 'path';

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

// Reference recycling dates per (Area, collection_day) from 2026 PDF calendars.
// Area 1 and Area 2 alternate recycling fortnights — Area 1 is offset 7 days later than Area 2.
// On a recycling week the day is YELLOW; on the intervening week it's GREEN (FOGO).
const RECYCLE_REF: Record<string, string> = {
  'Area 1|Monday':    '2026-01-12',
  'Area 1|Tuesday':   '2026-01-13',
  'Area 1|Wednesday': '2026-01-14',
  'Area 1|Thursday':  '2026-01-15',
  'Area 1|Friday':    '2026-01-16',
  'Area 2|Monday':    '2026-01-05',
  'Area 2|Tuesday':   '2026-01-06',
  'Area 2|Wednesday': '2026-01-07',
  'Area 2|Thursday':  '2026-01-08',
  'Area 2|Friday':    '2026-01-09',
};

interface ZonePolygon {
  area: string;          // "Area 1" or "Area 2"
  collection_day: string; // "Monday" ... "Friday"
  rings: number[][][];
}

// Load zone polygons from pre-cached file (from data.gov.au / Moonee Valley open data, CC-BY 3.0 AU)
let cachedZones: ZonePolygon[] | null = null;
function loadZones(): ZonePolygon[] {
  if (cachedZones) return cachedZones;
  const zonesPath = path.join(__dirname, 'moonee-valley-zones.json');
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
 * Returns { area, collection_day } or null.
 */
function findZone(lng: number, lat: number): { area: string; collection_day: string } | null {
  const zones = loadZones();
  for (const zone of zones) {
    // First ring is outer boundary, subsequent rings are holes (Moonee Valley data has no holes).
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
        return { area: zone.area, collection_day: zone.collection_day };
      }
    }
  }
  return null;
}

/**
 * Geocode an address using Photon (Komoot) — free OSM-based geocoder.
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const query = `${address}, Victoria, Australia`;
  const params = new URLSearchParams({
    q: query,
    limit: '1',
    lang: 'en',
    lat: '-37.77',   // Bias toward Moonee Valley
    lon: '144.89',
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

  const [lng, lat] = features[0].geometry.coordinates;
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

export async function scrapeMooneeValley(address: string): Promise<CollectionEvent[]> {
  console.log(`[moonee-valley] Scraping for: ${address}`);

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

  console.log(`[moonee-valley] Geocoding: ${cleanAddress}`);

  // Step 1: Geocode address
  const coords = await geocodeAddress(cleanAddress);
  if (!coords) {
    throw new Error('Could not find this address. Please check the address and try again.');
  }

  console.log(`[moonee-valley] Geocoded to: (${coords.lng}, ${coords.lat})`);

  // Step 2: Find zone (Area + collection day) using local polygon data
  const zone = findZone(coords.lng, coords.lat);

  if (!zone) {
    throw new Error('This address does not appear to be in the City of Moonee Valley collection area.');
  }

  const { area, collection_day: collectionDay } = zone;
  console.log(`[moonee-valley] Zone: ${area} / ${collectionDay}`);

  // Get recycling reference date
  const recycleRef = RECYCLE_REF[`${area}|${collectionDay}`];
  if (!recycleRef) {
    throw new Error(`Unknown zone combination: ${area} / ${collectionDay}`);
  }

  // FOGO reference is one week after recycling (UTC-safe; avoids DST drift)
  const [ry, rm, rd] = recycleRef.split('-').map(Number);
  const fogoRefDate = new Date(Date.UTC(ry, rm - 1, rd));
  fogoRefDate.setUTCDate(fogoRefDate.getUTCDate() + 7);
  const fogoRef = `${fogoRefDate.getUTCFullYear()}-${String(fogoRefDate.getUTCMonth() + 1).padStart(2, '0')}-${String(fogoRefDate.getUTCDate()).padStart(2, '0')}`;

  // Generate events
  const allEvents: CollectionEvent[] = [];

  // Rubbish (weekly) — every week, same day
  const rubbishDates = generateDates(recycleRef, 52, 7);
  for (const date of rubbishDates) {
    allEvents.push({ date, bins: ['rubbish'] });
  }

  // Recycling (fortnightly)
  const recycleDates = generateDates(recycleRef, 26, 14);
  for (const date of recycleDates) {
    allEvents.push({ date, bins: ['recycling'] });
  }

  // FOGO (fortnightly, alternating with recycling)
  const fogoDates = generateDates(fogoRef, 26, 14);
  for (const date of fogoDates) {
    allEvents.push({ date, bins: ['fogo'] });
  }

  // No curbside glass — Moonee Valley doesn't offer it

  const merged = mergeEvents(allEvents);
  console.log(`[moonee-valley] Generated ${merged.length} events for ${area} / ${collectionDay}`);
  return merged;
}
