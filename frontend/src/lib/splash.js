// Der Boot-Splash steht in index.html, damit er vor dem Bundle da ist.
// Mindestdauer, damit die Pille einmal ganz aufgeht statt abzureißen.
const MIN_MS = 1500;

export function hideSplash() {
  const el = document.getElementById('splash');
  if (!el || el.dataset.leaving) return;
  el.dataset.leaving = '1';
  setTimeout(() => {
    el.classList.add('splash-out');
    setTimeout(() => el.remove(), 450);
  }, Math.max(0, MIN_MS - performance.now()));
}
