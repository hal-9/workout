const THEME_KEY = 'lilief-theme';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.dataset.theme = theme;
}

export function initTheme() {
  const theme = getTheme();
  document.documentElement.dataset.theme = theme;
}
