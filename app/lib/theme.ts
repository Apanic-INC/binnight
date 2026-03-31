// BinNight Theme — Dark nature green with earth tones
// Inspired by Duolingo's fun, bold, rounded aesthetic

export const THEME = {
  // Backgrounds
  bg: '#1B3D2F',           // Deep forest green — main background
  bgCard: '#245840',       // Slightly lighter green — card backgrounds
  bgCardLight: '#2D6B4E',  // Lighter green — for hover/active states
  bgAccent: '#3D8B6A',     // Accent green — buttons, highlights

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A8D5BA',   // Soft sage green
  textMuted: '#6B9F84',       // Muted green for subtle text

  // Earth tones for accents
  warmYellow: '#F2C94C',      // Warm golden yellow
  warmOrange: '#E8A838',      // Earthy orange
  soil: '#8B6F47',            // Rich soil brown

  // Tab bar
  tabBar: '#143028',          // Darkest green for tab bar
  tabActive: '#8BC34A',       // Bright lime green for active tab
  tabInactive: '#6B9F84',     // Muted green for inactive

  // Fun Duolingo-style
  borderRadius: 20,
  borderRadiusLarge: 28,
  shadowColor: '#0D1F17',
} as const;
