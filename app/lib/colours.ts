// Bin lid colours used throughout the app
export const BIN_COLOURS = {
  fogo: '#8BC34A',        // Lime green lid (Merri-bek)
  green: '#66BB6A',       // Light green lid (Darebin — Food & Green waste)
  rubbish: '#E53935',     // Red lid
  recycling: '#FDD835',   // Yellow lid
  glass: '#8E24AA',       // Purple lid
  holiday: '#42A5F5',     // Blue for holidays
} as const;

export const BIN_LABELS = {
  fogo: 'Organics',
  green: 'Food & Green',
  rubbish: 'General',
  recycling: 'Recycling',
  glass: 'Glass',
  holiday: 'Public Holiday',
} as const;

export const BIN_EMOJI = {
  fogo: '🟢',
  green: '🟢',
  rubbish: '🔴',
  recycling: '🟡',
  glass: '🟣',
  holiday: '📅',
} as const;

export type BinType = keyof typeof BIN_COLOURS;
