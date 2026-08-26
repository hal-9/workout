import { DEFAULT_THEME, isThemeMode, isThemePalette } from 'shared/themes';

const MODE_KEY = 'lilief-theme';
const PALETTE_KEY = 'lilief-palette';
// Nur fuer den Fall, dass die Variablen beim ersten Lauf noch nicht berechenbar sind.
const FALLBACK_BG = { light: '#f6f2fb', dark: '#1a1525' };

export function getMode() {
  const value = localStorage.getItem(MODE_KEY);
  return isThemeMode(value) ? value : DEFAULT_THEME.mode;
}

export function getPalette() {
  const value = localStorage.getItem(PALETTE_KEY);
  return isThemePalette(value) ? value : DEFAULT_THEME.palette;
}

export function getTheme() {
  return { mode: getMode(), palette: getPalette() };
}

function applyTheme({ mode, palette }) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.palette = palette;

  const color = getComputedStyle(root).getPropertyValue('--bg').trim() || FALLBACK_BG[mode];
  // Safari/iOS übernimmt ein geändertes content-Attribut erst nach dem Reload —
  // ein frisch eingehängter Meta-Tag färbt Status- und Home-Leiste sofort um.
  for (const old of document.querySelectorAll('meta[name="theme-color"]')) old.remove();
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = color;
  document.head.appendChild(meta);
  root.style.backgroundColor = color;
}

export function setTheme({ mode, palette }) {
  localStorage.setItem(MODE_KEY, mode);
  localStorage.setItem(PALETTE_KEY, palette);
  applyTheme({ mode, palette });
}

export function initTheme() {
  applyTheme(getTheme());
}
