// Theme-Auswahl: Modus (hell/dunkel) und Farbpalette sind zwei unabhaengige
// Achsen. Die Farbwerte selbst leben in frontend/src/index.css — hier stehen
// nur die IDs, weil das Backend sie validieren muss.
export const THEME_MODES = ['light', 'dark'];

export const THEME_PALETTES = [
  { id: 'violet', label: 'Lila', swatch: ['#8b5cf6', '#ec4899'] },
  { id: 'ocean', label: 'Ozean', swatch: ['#6366f1', '#22d3ee'] },
  { id: 'sun', label: 'Sonne', swatch: ['#f59e0b', '#fb7185'] },
  { id: 'forest', label: 'Wald', swatch: ['#10b981', '#2dd4bf'] },
];

export const THEME_PALETTE_IDS = THEME_PALETTES.map((p) => p.id);

export const DEFAULT_THEME = { mode: 'light', palette: 'violet' };

export function isThemeMode(value) {
  return THEME_MODES.includes(value);
}

export function isThemePalette(value) {
  return THEME_PALETTE_IDS.includes(value);
}
