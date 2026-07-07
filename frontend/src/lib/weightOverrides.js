const STORAGE_KEY = 'weightOverrides';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getOverride(exerciseId) {
  const value = readAll()[exerciseId];
  return value == null ? null : Number(value);
}

export function setOverride(exerciseId, kg) {
  const map = readAll();
  map[exerciseId] = kg;
  writeAll(map);
}

export function clearOverride(exerciseId) {
  const map = readAll();
  delete map[exerciseId];
  writeAll(map);
}

export function getAllOverrides() {
  return readAll();
}
