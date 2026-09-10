// Geräte-Filter des Übungs-Tauschs — gerätelokal (localStorage), wie weightOverrides.
// Wer eine Woche im Hotel nur mit Körpergewicht trainiert, will den Filter nicht
// bei jeder Übung neu setzen.
const STORAGE_KEY = 'swapEquipment';

export function getSwapEquipment() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setSwapEquipment(keys) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    /* privater Modus o. Ä. — Filter gilt dann nur für diese Sitzung */
  }
}
