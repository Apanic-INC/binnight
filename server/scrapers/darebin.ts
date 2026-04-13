import type { CollectionEvent } from '../index';

const ARCGIS_URL = 'https://services-ap1.arcgis.com/1WJBRkF3v1EEG5gz/arcgis/rest/services/Waste_Collection_Date3/FeatureServer/0/query';

// Common street type abbreviations → full names (ArcGIS uses full names)
const STREET_TYPES: Record<string, string> = {
  'ST': 'STREET',
  'RD': 'ROAD',
  'AVE': 'AVENUE',
  'AV': 'AVENUE',
  'DR': 'DRIVE',
  'CT': 'COURT',
  'CRT': 'COURT',
  'CR': 'CRESCENT',
  'CRES': 'CRESCENT',
  'PL': 'PLACE',
  'TCE': 'TERRACE',
  'TER': 'TERRACE',
  'PDE': 'PARADE',
  'LN': 'LANE',
  'WAY': 'WAY',
  'CL': 'CLOSE',
  'GR': 'GROVE',
  'GRV': 'GROVE',
  'BVD': 'BOULEVARD',
  'BLVD': 'BOULEVARD',
  'HWY': 'HIGHWAY',
};

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

/**
 * Expand abbreviated street types to full names.
 * e.g. "127 BRUCE ST" → "127 BRUCE STREET"
 */
function expandStreetType(address: string): string {
  const parts = address.split(/\s+/);
  return parts.map(p => STREET_TYPES[p] || p).join(' ');
}

/**
 * Generate dates at a fixed interval from a start date.
 * Advances past today if the start date is in the past.
 */
function generateDates(startEpochMs: number, count: number, intervalDays: number): string[] {
  const start = new Date(startEpochMs);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Advance start to the most recent occurrence before or on today
  const msInterval = intervalDays * 24 * 60 * 60 * 1000;
  const elapsed = today.getTime() - start.getTime();
  if (elapsed > 0) {
    const periodsElapsed = Math.floor(elapsed / msInterval);
    start.setTime(start.getTime() + periodsElapsed * msInterval);
    // If we're past the date, move to next occurrence
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
 * Merge events that share the same date into single entries with combined bins.
 */
function mergeEvents(events: CollectionEvent[]): CollectionEvent[] {
  const byDate = new Map<string, string[]>();

  for (const event of events) {
    const existing = byDate.get(event.date) || [];
    for (const bin of event.bins) {
      if (!existing.includes(bin)) {
        existing.push(bin);
      }
    }
    byDate.set(event.date, existing);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bins]) => ({ date, bins }));
}

export async function scrapeDarebin(address: string): Promise<CollectionEvent[]> {
  console.log(`[darebin] Scraping for: ${address}`);

  // Clean and normalize the address
  let cleanAddress = address
    .toUpperCase()
    .replace(new RegExp(`\\b(${STATES.join('|')})\\b`, 'gi'), '')
    .replace(/,/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Remove postcode (4 digits at end)
  cleanAddress = cleanAddress.replace(/\s*\d{4}\s*$/, '').trim();

  // Expand street abbreviations
  cleanAddress = expandStreetType(cleanAddress);

  console.log(`[darebin] Querying ArcGIS: ${cleanAddress}`);

  // Query 1: Find the property by address
  const searchParams = new URLSearchParams({
    where: `EZI_ADDRESS LIKE '%${cleanAddress}%'`,
    outFields: 'OBJECTID,EZI_ADDRESS',
    returnGeometry: 'false',
    f: 'json',
    resultRecordCount: '10',
  });

  const searchResp = await fetch(`${ARCGIS_URL}?${searchParams}`);
  if (!searchResp.ok) {
    throw new Error(`Darebin API error: ${searchResp.status}`);
  }

  const searchData = await searchResp.json();
  const features = searchData.features || [];

  if (features.length === 0) {
    // Try without unit number (e.g. "4/127 BRUCE STREET" → "127 BRUCE STREET")
    const withoutUnit = cleanAddress.replace(/^\d+\//, '');
    if (withoutUnit !== cleanAddress) {
      console.log(`[darebin] Retrying without unit: ${withoutUnit}`);
      const retryParams = new URLSearchParams({
        where: `EZI_ADDRESS LIKE '%${withoutUnit}%'`,
        outFields: 'OBJECTID,EZI_ADDRESS',
        returnGeometry: 'false',
        f: 'json',
        resultRecordCount: '10',
      });

      const retryResp = await fetch(`${ARCGIS_URL}?${retryParams}`);
      const retryData = await retryResp.json();

      if (!retryData.features || retryData.features.length === 0) {
        throw new Error('Address not found in Darebin council database.');
      }

      features.push(...retryData.features);
    } else {
      throw new Error('Address not found in Darebin council database.');
    }
  }

  // Score matches to find the best one
  const addressParts = cleanAddress.split(/\s+/).filter(p => p.length > 1);
  let bestFeature = features[0];
  let bestScore = 0;

  for (const feature of features) {
    const eziAddress = feature.attributes.EZI_ADDRESS;
    let score = 0;
    for (const part of addressParts) {
      if (eziAddress.includes(part)) score++;
    }
    console.log(`[darebin]   Match: "${eziAddress}" (score: ${score}/${addressParts.length})`);
    if (score > bestScore) {
      bestScore = score;
      bestFeature = feature;
    }
  }

  const objectId = bestFeature.attributes.OBJECTID;
  console.log(`[darebin] Best match: "${bestFeature.attributes.EZI_ADDRESS}" (OBJECTID: ${objectId})`);

  // Query 2: Get collection details
  const detailParams = new URLSearchParams({
    where: `OBJECTID=${objectId}`,
    outFields: 'Collection_Day,Condition,Green_Collection,Recycle_Collection',
    returnGeometry: 'false',
    f: 'json',
  });

  const detailResp = await fetch(`${ARCGIS_URL}?${detailParams}`);
  if (!detailResp.ok) {
    throw new Error(`Darebin API error: ${detailResp.status}`);
  }

  const detailData = await detailResp.json();
  const details = detailData.features?.[0]?.attributes;

  if (!details) {
    throw new Error('Failed to fetch collection schedule from Darebin API.');
  }

  console.log(`[darebin] Collection day: ${details.Collection_Day}`);
  console.log(`[darebin] Green epoch: ${details.Green_Collection}`);
  console.log(`[darebin] Recycle epoch: ${details.Recycle_Collection}`);

  // Generate collection dates
  const allEvents: CollectionEvent[] = [];

  // Rubbish (weekly) — use the earlier of green/recycle as the starting reference
  const rubbishStart = Math.min(details.Green_Collection, details.Recycle_Collection);
  const rubbishDates = generateDates(rubbishStart, 52, 7);
  for (const date of rubbishDates) {
    allEvents.push({ date, bins: ['rubbish'] });
  }

  // Recycling (fortnightly)
  const recycleDates = generateDates(details.Recycle_Collection, 26, 14);
  for (const date of recycleDates) {
    allEvents.push({ date, bins: ['recycling'] });
  }

  // Green/Food waste (fortnightly)
  const greenDates = generateDates(details.Green_Collection, 26, 14);
  for (const date of greenDates) {
    allEvents.push({ date, bins: ['green'] });
  }

  // Merge events on the same date
  const merged = mergeEvents(allEvents);

  console.log(`[darebin] Generated ${merged.length} events`);
  return merged;
}
