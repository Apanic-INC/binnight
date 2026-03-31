// Maps suburb names and postcodes to council scraper IDs
// As we add more councils, we expand this mapping

interface CouncilMapping {
  scraperId: string;
  councilName: string;
}

// Merri-bek suburbs and postcodes
const SUBURB_MAP: Record<string, CouncilMapping> = {
  // Suburbs (lowercase)
  'brunswick': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'brunswick east': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'brunswick west': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'coburg': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'coburg north': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'pascoe vale': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'pascoe vale south': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'oak park': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'glenroy': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'hadfield': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'fawkner': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'gowanbrae': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'tullamarine': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },
  'merlynston': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' },

  // Add more councils here as we build scrapers:
  // 'northcote': { scraperId: 'darebin', councilName: 'City of Darebin' },
  // 'preston': { scraperId: 'darebin', councilName: 'City of Darebin' },
};

const POSTCODE_MAP: Record<string, CouncilMapping> = {
  '3056': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' }, // Brunswick
  '3057': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' }, // Brunswick East
  '3055': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' }, // Brunswick West
  '3058': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' }, // Coburg / Coburg North
  '3044': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' }, // Pascoe Vale / Pascoe Vale South
  '3046': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' }, // Glenroy / Oak Park / Hadfield
  '3060': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' }, // Fawkner
  '3043': { scraperId: 'merri-bek', councilName: 'Merri-bek City Council' }, // Tullamarine / Gowanbrae
};

export function lookupCouncil(address: string): CouncilMapping | null {
  const upper = address.toUpperCase();
  const lower = address.toLowerCase();

  // 1. Try postcode match (most reliable)
  const postcodeMatch = upper.match(/\b(\d{4})\b/);
  if (postcodeMatch) {
    const postcode = postcodeMatch[1];
    if (POSTCODE_MAP[postcode]) {
      console.log(`Council found by postcode ${postcode}: ${POSTCODE_MAP[postcode].councilName}`);
      return POSTCODE_MAP[postcode];
    }
  }

  // 2. Try suburb match (check longest suburb names first to avoid partial matches)
  const suburbs = Object.keys(SUBURB_MAP).sort((a, b) => b.length - a.length);
  for (const suburb of suburbs) {
    if (lower.includes(suburb)) {
      console.log(`Council found by suburb "${suburb}": ${SUBURB_MAP[suburb].councilName}`);
      return SUBURB_MAP[suburb];
    }
  }

  return null;
}

// List of supported councils for the UI
export function getSupportedCouncils(): string[] {
  const councils = new Set<string>();
  Object.values(SUBURB_MAP).forEach(m => councils.add(m.councilName));
  Object.values(POSTCODE_MAP).forEach(m => councils.add(m.councilName));
  return Array.from(councils);
}
