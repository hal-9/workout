/**
 * Deterministic warm-up set prescription based on working weight.
 * Not medical advice — labeled as estimates in the UI.
 */
export function warmupSets(workingKg, barKg = 20) {
  const working = Number(workingKg);
  if (!Number.isFinite(working) || working <= 0) return [];

  const rounds = [
    { pct: 0.4, reps: 8 },
    { pct: 0.6, reps: 5 },
    { pct: 0.8, reps: 3 },
  ];

  return rounds
    .map(({ pct, reps }) => {
      const raw = working * pct;
      const weight = Math.max(barKg, Math.round(raw * 2) / 2);
      if (weight >= working) return null;
      return { set_type: 'warmup', weight_kg: weight, reps };
    })
    .filter(Boolean);
}
