#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull

docker run --rm -v "$(pwd):/app" -w /app node:22 sh -c "npm ci && npm run build -w frontend"

rm -rf deploy/frontend-dist
cp -r frontend/dist deploy/frontend-dist

cd deploy

CADDYFILE_CHANGED=0
if ! git diff --quiet HEAD~1 HEAD -- Caddyfile 2>/dev/null; then
  CADDYFILE_CHANGED=1
fi

docker compose up -d --build api

if [ "$CADDYFILE_CHANGED" = "1" ]; then
  docker compose restart caddy
fi
