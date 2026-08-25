/**
 * Greedy plate calculator for barbell loading.
 * Returns plates per side (kg) to reach target weight with bar weight.
 */
export function calculatePlates(targetKg, barKg = 20, availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  const target = Number(targetKg);
  if (!Number.isFinite(target) || target <= 0) return null;

  const perSide = (target - barKg) / 2;
  if (perSide < 0) return null;
  if (perSide === 0) return { perSide: [], total: barKg };

  const sorted = [...availablePlates].sort((a, b) => b - a);
  let remaining = perSide;
  const perSidePlates = [];

  for (const plate of sorted) {
    while (remaining >= plate - 0.001) {
      perSidePlates.push(plate);
      remaining = Math.round((remaining - plate) * 1000) / 1000;
    }
  }

  if (remaining > 0.01) {
    return { perSide: perSidePlates, total: null, remainder: remaining };
  }

  const loaded = barKg + perSidePlates.reduce((s, p) => s + p * 2, 0);
  return { perSide: perSidePlates, total: Math.round(loaded * 10) / 10 };
}

export function formatPlateList(plates) {
  if (!plates?.length) return '—';
  return plates.map((p) => `${p} kg`).join(' + ');
}
