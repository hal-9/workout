const THEME_KEY = 'lilief-theme';
const THEME_COLORS = { light: '#f6f2fb', dark: '#1a1525' };

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  // Safari/iOS übernimmt ein geändertes content-Attribut erst nach dem Reload —
  // ein frisch eingehängter Meta-Tag färbt Status- und Home-Leiste sofort um.
  const color = THEME_COLORS[theme];
  for (const old of document.querySelectorAll('meta[name="theme-color"]')) old.remove();
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = color;
  document.head.appendChild(meta);
  document.documentElement.style.backgroundColor = color;
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function initTheme() {
  applyTheme(getTheme());
}
