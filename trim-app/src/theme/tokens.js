// Semantic color tokens — the single source of truth for color.
// Screens should consume these via useTheme() instead of hardcoding hex.
// (Full screen migration to these tokens lands in a later pass; this file only
//  establishes the system.)

// Roles that are identical in both schemes (brand accent, status colors, macros).
const shared = {
  accent: '#2ECC71', // brand green — the ONE accent, app-wide
  accentText: '#0F0F0F', // text/icon sitting on top of `accent` (near-black for contrast)
  danger: '#EF5350', // destructive / delete
  warning: '#FFB74D', // caution ("eating too little", maintain banner)
  success: '#2ECC71',
  surplus: '#FF6B6B', // calorie surplus indicator

  // Macro data-viz colors — intentionally distinct hues (not the brand accent).
  macroProtein: '#4FC3F7',
  macroCarbs: '#FFB74D',
  macroFat: '#CE93D8',
};

export const dark = {
  ...shared,
  bg: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceAlt: '#252525',
  card: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textMuted: '#666666',
};

export const light = {
  ...shared,
  accentText: '#FFFFFF', // on a light bg, green needs white text
  bg: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFEC',
  card: '#FFFFFF',
  border: 'rgba(0,0,0,0.08)',
  textPrimary: '#14140F',
  textSecondary: '#5A5A55',
  textMuted: '#8A8A85',
};

export const palettes = { dark, light };
