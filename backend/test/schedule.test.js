import { describe, it, expect } from 'vitest';
import {
  assignWeekdays,
  getMissedDays,
  missedDayKeys,
  nextDueDayKey,
  weekProgress,
} from '../../frontend/src/lib/schedule.js';

function fourDayPlan() {
  return {
    schema_version: 1,
    name: 'Test 4-Day',
    days: [
      { key: 'monday', name: 'Montag Workout', focus: 'A', weekday: 'mon', exercises: [] },
      { key: 'tuesday', name: 'Dienstag Workout', focus: 'B', weekday: 'tue', exercises: [] },
      { key: 'thursday', name: 'Donnerstag Workout', focus: 'C', weekday: 'thu', exercises: [] },
      { key: 'friday', name: 'Freitag Workout', focus: 'D', weekday: 'fri', exercises: [] },
    ],
  };
}

function tuesday() {
  return new Date(2026, 6, 7, 12, 0, 0); // Tue Jul 7 2026 local
}

function monday() {
  return new Date(2026, 6, 6, 12, 0, 0);
}

describe('schedule.js', () => {
  describe('assignWeekdays', () => {
    it('maps explicit weekdays from plan days', () => {
      const map = assignWeekdays(fourDayPlan());
      expect(map.get('mon').key).toBe('monday');
      expect(map.get('tue').key).toBe('tuesday');
      expect(map.get('wed')).toBeUndefined();
    });
  });

  describe('nextDueDayKey (hybrid: today first)', () => {
    it('suggests today when today workout is open', () => {
      const plan = fourDayPlan();
      const done = new Map();
      expect(nextDueDayKey(plan, done, tuesday())).toBe('tuesday');
    });

    it('suggests today even when earlier weekdays were missed', () => {
      const plan = fourDayPlan();
      const done = new Map();
      expect(nextDueDayKey(plan, done, tuesday())).toBe('tuesday');
    });

    it('skips completed days and picks next open from today forward', () => {
      const plan = fourDayPlan();
      const done = new Map([['tuesday', new Date()]]);
      expect(nextDueDayKey(plan, done, tuesday())).toBe('thursday');
    });

    it('falls back to earliest open day in plan order when rest of week is done', () => {
      const plan = fourDayPlan();
      const done = new Map([
        ['tuesday', new Date()],
        ['thursday', new Date()],
        ['friday', new Date()],
      ]);
      expect(nextDueDayKey(plan, done, tuesday())).toBe('monday');
    });
  });

  describe('getMissedDays', () => {
    it('returns past scheduled workouts that are still open', () => {
      const plan = fourDayPlan();
      const done = new Map();
      const missed = getMissedDays(plan, done, tuesday());
      expect(missed).toHaveLength(1);
      expect(missed[0].key).toBe('monday');
      expect(missed[0].weekday).toBe('mon');
    });

    it('excludes completed past workouts', () => {
      const plan = fourDayPlan();
      const done = new Map([['monday', new Date()]]);
      expect(getMissedDays(plan, done, tuesday())).toEqual([]);
    });

    it('returns empty on Monday (no past days yet)', () => {
      const plan = fourDayPlan();
      const done = new Map();
      expect(getMissedDays(plan, done, monday())).toEqual([]);
    });

    it('lists multiple missed days when several past slots are open', () => {
      const plan = fourDayPlan();
      const done = new Map();
      const fridayDate = new Date(2026, 6, 10, 12, 0, 0);
      const missed = getMissedDays(plan, done, fridayDate);
      expect(missed.map((d) => d.key)).toEqual(['monday', 'tuesday', 'thursday']);
    });
  });

  describe('missedDayKeys', () => {
    it('returns a set of missed day keys', () => {
      const plan = fourDayPlan();
      const keys = missedDayKeys(plan, new Map(), tuesday());
      expect(keys.has('monday')).toBe(true);
      expect(keys.has('tuesday')).toBe(false);
    });
  });

  describe('weekProgress', () => {
    it('counts completed plan days in the current week', () => {
      const plan = fourDayPlan();
      const done = new Map([
        ['monday', new Date()],
        ['tuesday', new Date()],
      ]);
      expect(weekProgress(plan, done)).toEqual({ done: 2, total: 4 });
    });

    it('returns zero for empty plan', () => {
      expect(weekProgress(null, new Map())).toEqual({ done: 0, total: 0 });
    });
  });

  describe('week rollover', () => {
    it('treats all days as open when nothing is done (fresh week)', () => {
      const plan = fourDayPlan();
      const done = new Map();
      const mondayFresh = new Date(2026, 6, 13, 12, 0, 0); // next Monday
      expect(getMissedDays(plan, done, mondayFresh)).toEqual([]);
      expect(nextDueDayKey(plan, done, mondayFresh)).toBe('monday');
      expect(weekProgress(plan, done)).toEqual({ done: 0, total: 4 });
    });
  });
});
