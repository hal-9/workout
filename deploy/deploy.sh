#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull

docker run --rm -v "$(pwd):/app" -w /app node:22 sh -c "npm ci && npm run build -w frontend"

# Verzeichnis nie löschen: es ist als Bind-Mount in den laufenden Caddy
# gemountet — nach rm -rf zeigt der Container auf den alten Inode und liefert
# für alles 404, bis er neu gestartet wird. Nur den Inhalt austauschen.
mkdir -p deploy/frontend-dist
find deploy/frontend-dist -mindepth 1 -delete
cp -r frontend/dist/. deploy/frontend-dist/

cd deploy

CADDYFILE_CHANGED=0
if ! git diff --quiet HEAD~1 HEAD -- Caddyfile 2>/dev/null; then
  CADDYFILE_CHANGED=1
fi

docker compose up -d --build api

if [ "$CADDYFILE_CHANGED" = "1" ]; then
  docker compose restart caddy
fi
