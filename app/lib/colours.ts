// Bin lid colours used throughout the app
export const BIN_COLOURS = {
  fogo: '#8BC34A',        // Lime green lid
  rubbish: '#E53935',     // Red lid
  recycling: '#FDD835',   // Yellow lid
  glass: '#8E24AA',       // Purple lid
  holiday: '#42A5F5',     // Blue for holidays
} as const;

export const BIN_LABELS = {
  fogo: 'Organics',
  rubbish: 'General',
  recycling: 'Recycling',
  glass: 'Glass',
  holiday: 'Public Holiday',
} as const;

export const BIN_EMOJI = {
  fogo: '🟢',
  rubbish: '🔴',
  recycling: '🟡',
  glass: '🟣',
  holiday: '📅',
} as const;

export type BinType = keyof typeof BIN_COLOURS;
