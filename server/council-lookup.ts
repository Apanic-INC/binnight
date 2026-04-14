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

  // Darebin suburbs
  // Note: parts of Coburg are in Darebin but 'coburg' is mapped to Merri-bek above.
  // Postcode-based lookup handles the overlap for unambiguous Darebin postcodes.
  'alphington': { scraperId: 'darebin', councilName: 'City of Darebin' },
  'fairfield': { scraperId: 'darebin', councilName: 'City of Darebin' },
  'northcote': { scraperId: 'darebin', councilName: 'City of Darebin' },
  'thornbury': { scraperId: 'darebin', councilName: 'City of Darebin' },
  'preston': { scraperId: 'darebin', councilName: 'City of Darebin' },
  'reservoir': { scraperId: 'darebin', councilName: 'City of Darebin' },
  'kingsbury': { scraperId: 'darebin', councilName: 'City of Darebin' },
  'bundoora': { scraperId: 'darebin', councilName: 'City of Darebin' },
  'macleod': { scraperId: 'darebin', councilName: 'City of Darebin' },

  // Yarra suburbs
  'abbotsford': { scraperId: 'yarra', councilName: 'City of Yarra' },
  'burnley': { scraperId: 'yarra', councilName: 'City of Yarra' },
  'carlton north': { scraperId: 'yarra', councilName: 'City of Yarra' },
  'clifton hill': { scraperId: 'yarra', councilName: 'City of Yarra' },
  'collingwood': { scraperId: 'yarra', councilName: 'City of Yarra' },
  'cremorne': { scraperId: 'yarra', councilName: 'City of Yarra' },
  'fitzroy': { scraperId: 'yarra', councilName: 'City of Yarra' },
  'fitzroy north': { scraperId: 'yarra', councilName: 'City of Yarra' },
  'richmond': { scraperId: 'yarra', councilName: 'City of Yarra' },

  // Melbourne suburbs
  'flemington': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'kensington': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'west melbourne': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'port melbourne': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'north melbourne': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'carlton': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'parkville': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'melbourne': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'docklands': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'south wharf': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'southbank': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'south yarra': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'east melbourne': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'jolimont': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
  'fishermans bend': { scraperId: 'melbourne', councilName: 'City of Melbourne' },
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

  // Darebin postcodes
  '3070': { scraperId: 'darebin', councilName: 'City of Darebin' }, // Northcote
  '3071': { scraperId: 'darebin', councilName: 'City of Darebin' }, // Thornbury
  '3072': { scraperId: 'darebin', councilName: 'City of Darebin' }, // Preston
  '3073': { scraperId: 'darebin', councilName: 'City of Darebin' }, // Reservoir
  '3078': { scraperId: 'darebin', councilName: 'City of Darebin' }, // Alphington / Fairfield
  '3083': { scraperId: 'darebin', councilName: 'City of Darebin' }, // Bundoora / Kingsbury

  // Yarra postcodes
  '3065': { scraperId: 'yarra', councilName: 'City of Yarra' }, // Fitzroy
  '3066': { scraperId: 'yarra', councilName: 'City of Yarra' }, // Collingwood
  '3067': { scraperId: 'yarra', councilName: 'City of Yarra' }, // Abbotsford
  '3068': { scraperId: 'yarra', councilName: 'City of Yarra' }, // Fitzroy North / Clifton Hill
  '3121': { scraperId: 'yarra', councilName: 'City of Yarra' }, // Richmond / Burnley / Cremorne
  '3054': { scraperId: 'yarra', councilName: 'City of Yarra' }, // Carlton North

  // Melbourne postcodes
  '3000': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // Melbourne CBD
  '3002': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // East Melbourne
  '3003': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // West Melbourne
  '3004': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // South Yarra (Melbourne part)
  '3006': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // Southbank / South Wharf
  '3008': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // Docklands
  '3031': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // Flemington / Kensington
  '3051': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // North Melbourne
  '3052': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // Parkville
  '3053': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // Carlton
  '3207': { scraperId: 'melbourne', councilName: 'City of Melbourne' }, // Port Melbourne
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
