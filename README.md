# Workout App

Selbst-gehostete Workout-PWA für einen kleinen Freundeskreis (Registrierung per
Einladungscode). React/Vite-Frontend, Node/Express-Backend mit SQLite, LLM-Auswertung
nach jedem Workout (Google Gemini). Deployment per Docker Compose + Caddy auf einem
Contabo VPS.

## Dokumente

- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — vollständige Spezifikation und
  Meilensteine M1–M6. **Handover-Dokument für das umsetzende Modell.**
- [docs/VPS_SETUP.md](docs/VPS_SETUP.md) — manuelle VPS-Einrichtung Schritt für Schritt.
- [docs/ACCOUNTS_UND_FREUNDE.md](docs/ACCOUNTS_UND_FREUNDE.md) — Registrierung, Onboarding
  und Freundschaften (M13), inklusive Deploy-Schritten für Bestandsnutzer.
- `docs/ux-reference.html` — **fehlt noch:** bestehendes HTML-Artifact hier ablegen.
  Es ist die maßgebliche Design-Referenz (Farben, Layout, iOS-Meta-Tags) — ohne die Datei
  vor M2 anhalten (siehe Arbeitsregeln im Implementation Plan).

## Struktur (entsteht in M1)

```
/frontend   Vite-React-App (PWA)
/backend    Express-API, Migrations, Seed, Tests
/deploy     compose.yml, Caddyfile, deploy.sh, .env.example
/docs       Spezifikation & Setup-Anleitung
```
