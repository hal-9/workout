# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A small, invite-only circle of friends (registration by invite code). Each person runs their own training plan and logs sets on an iPhone, using the app as a home-screen PWA, mid-workout at home or in the gym: phone in one hand, often sweaty, between sets, glancing rather than reading. The UI is German.

## Product Purpose
LiLief replaces the notebook and the spreadsheet for strength training. It shows today's planned workout, logs each set quickly with the last performance prefilled, runs rest timers, and afterwards gives an evaluation and progression proposals. Success is a workout logged without friction and visible progress over weeks.

## Positioning
A self-hosted, private training log for a friend group: your own plan (imported or built), not a content platform. It has no feed, no ads and no coaching upsell. Friends can see each other's progress, and an LLM coach writes the evaluation after each workout.

## Operating Context
- Daily ritual: open "Heute", start the workout, work through exercises in focus mode (set, rest, next), finish, read the coach summary.
- Weekly rhythm: fixed weekdays per plan day; missed days slide back (Kalender); past weeks are read-only.
- Gym conditions: bright or dim light, glances at arm's length, large tap targets matter more than density.
- Monthly "Rückblick" (Wrapped-style story) and share cards.

## Capabilities and Constraints
- React 18 + Vite PWA, Express + SQLite backend, Docker Compose on a VPS behind Caddy. Offline-tolerant (cached plan, queued writes).
- Screens: Heute (day overview + focus mode), Kalender, Plan (overview, editor, wizard, import), Fortschritt (stats, charts, 3D muscle recovery map, training tree), Freunde, Auswertung (coach evaluation).
- Domain terms: Satz, Wdh., Übung, Plantag, Cooldown, Steigern (progression proposal), Frische (muscle recovery), Band-Unterstützung, Reise-Modus.
- Theme: one signature palette with light and dark modes (decided 2026-10-12; replaces the 4-palette picker).

## Brand Commitments
- Name "LiLief" and the existing dumbbell logo mark (colors may change with the redesign).
- German copy, informal "du".

## Evidence on Hand
- Real plan templates: `frontend/src/data/templates/*.json`, `docs/plan-de.json`.
- Exercise library: `shared/exercises.json` (240 entries).
- No testimonials, metrics or public claims exist; none may be invented.

## Product Principles
1. Logging a set must never take more than one glance and one tap.
2. The plan is the user's own; the app proposes and never silently changes it.
3. Show progress honestly: real numbers from real sets, no inflated gamification.
4. Private by default: friends see what they are allowed to see, nothing more.

## Accessibility & Inclusion
Readable at arm's length in poor gym lighting: strong text contrast, large targets (≥44 px), respects reduced motion. Must work one-handed.
