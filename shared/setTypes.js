export const SET_TYPES = ['warmup', 'working', 'drop', 'failure'];

export const SET_TYPE_LABELS = {
  warmup: 'Warm-up',
  working: 'Arbeit',
  drop: 'Drop',
  failure: 'Failure',
};

export function isWarmupSet(set) {
  return set?.set_type === 'warmup';
}

/** Working sets only — warm-ups excluded from volume and progression. */
export function workingSets(sets = []) {
  return sets.filter((s) => !isWarmupSet(s));
}
