import type { CollectionEvent } from '../index';

const ARCGIS_BASE = 'https://yccgis-prd.esriaustraliaonline.com.au/arcgis/rest/services';
const ADDRESS_URL = `${ARCGIS_BASE}/FYC_WM_PRD___MCH_Address_Look_Up_MIL1/MapServer/0/query`;
const ZONES_URL = `${ARCGIS_BASE}/Hosted/Waster_Collection_Zones/FeatureServer/0/query`;

const STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.yarracity.vic.gov.au/',
};

// Street type abbreviations → full names (ArcGIS uses full names)
const STREET_TYPES: Record<string, string> = {
  'ST': 'STREET', 'RD': 'ROAD', 'AVE': 'AVENUE', 'AV': 'AVENUE',
  'DR': 'DRIVE', 'CT': 'COURT', 'CRT': 'COURT', 'CR': 'CRESCENT',
  'CRES': 'CRESCENT', 'PL': 'PLACE', 'TCE': 'TERRACE', 'TER': 'TERRACE',
  'PDE': 'PARADE', 'LN': 'LANE', 'WAY': 'WAY', 'CL': 'CLOSE',
  'GR': 'GROVE', 'GRV': 'GROVE', 'BVD': 'BOULEVARD', 'BLVD': 'BOULEVARD',
  'HWY': 'HIGHWAY',
};

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

function expandStreetType(address: string): string {
  return address.split(/\s+/).map(p => STREET_TYPES[p] || p).join(' ');
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

  // Clean and normalize
  let cleanAddress = address
    .toUpperCase()
    .replace(new RegExp(`\\b(${STATES.join('|')})\\b`, 'gi'), '')
    .replace(/,/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  cleanAddress = cleanAddress.replace(/\s*\d{4}\s*$/, '').trim();
  cleanAddress = expandStreetType(cleanAddress);

  // Remove unit/flat prefix for initial search
  const withoutUnit = cleanAddress.replace(/^\d+\//, '');

  console.log(`[yarra] Querying address: ${withoutUnit}`);

  // Query 1: Address → coordinates
  const addrParams = new URLSearchParams({
    where: `ezi_address LIKE '%${withoutUnit}%'`,
    outFields: 'ezi_address,locality_name,postcode',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '10',
  });

  const addrResp = await fetch(`${ADDRESS_URL}?${addrParams}`, { headers: FETCH_HEADERS });
  if (!addrResp.ok) {
    throw new Error(`Yarra address API error: ${addrResp.status}`);
  }

  const addrData = await addrResp.json();
  const features = addrData.features || [];

  if (features.length === 0) {
    throw new Error('Address not found in City of Yarra database.');
  }

  // Score matches
  const addressParts = withoutUnit.split(/\s+/).filter(p => p.length > 1);
  let bestFeature = features[0];
  let bestScore = 0;

  for (const feature of features) {
    const eziAddr = feature.attributes.ezi_address;
    let score = 0;
    for (const part of addressParts) {
      if (eziAddr.includes(part)) score++;
    }
    console.log(`[yarra]   Match: "${eziAddr}" (score: ${score}/${addressParts.length})`);
    if (score > bestScore) {
      bestScore = score;
      bestFeature = feature;
    }
  }

  const coords = bestFeature.geometry;
  console.log(`[yarra] Best match: "${bestFeature.attributes.ezi_address}" → (${coords.x}, ${coords.y})`);

  // Query 2: Coordinates → zone
  const zoneParams = new URLSearchParams({
    geometry: `${coords.x},${coords.y}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'zone_num,collection_day',
    returnGeometry: 'false',
    f: 'json',
  });

  const zoneResp = await fetch(`${ZONES_URL}?${zoneParams}`, { headers: FETCH_HEADERS });
  if (!zoneResp.ok) {
    throw new Error(`Yarra zone API error: ${zoneResp.status}`);
  }

  const zoneData = await zoneResp.json();
  const zoneFeature = zoneData.features?.[0]?.attributes;

  if (!zoneFeature) {
    throw new Error('Could not determine waste collection zone for this address.');
  }

  const zoneNum = zoneFeature.zone_num;
  const collectionDay = zoneFeature.collection_day;
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
