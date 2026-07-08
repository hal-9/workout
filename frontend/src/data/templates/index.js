import upperLower4day from './upper-lower-4day.json';
import gluteCore4day from './glute-core-4day.json';
import simple3day from './simple-3day.json';
import { clonePlan } from '../../lib/planDefaults.js';

export const PLAN_TEMPLATES = [
  {
    id: 'simple-3day',
    title: 'Einfach 3-Tage',
    description: 'Ganzkörper für Einsteiger — 3 Trainingstage pro Woche.',
    days: 3,
    plan: simple3day,
  },
  {
    id: 'upper-lower-4day',
    title: 'Ober/Unter Foundation',
    description: '4-Tage Split mit Drücken, Ziehen und Beinen — für solide Grundlagen.',
    days: 4,
    plan: upperLower4day,
  },
  {
    id: 'glute-core-4day',
    title: 'Glute & Core',
    description: 'Po, Core und Cardio — mit festen Wochentagen (Mo/Mi/Fr/Sa).',
    days: 4,
    plan: gluteCore4day,
  },
];

export function getTemplatePlan(templateId) {
  const template = PLAN_TEMPLATES.find((item) => item.id === templateId);
  if (!template) return null;
  return clonePlan(template.plan);
}
