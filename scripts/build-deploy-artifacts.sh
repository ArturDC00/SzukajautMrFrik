#!/usr/bin/env bash
# Buduje paczkę rozszerzenia (webpack) i przygotowuje folder deploy/ do wgrania na hosting (FTP).
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

rm -rf deploy
mkdir -p deploy

echo "→ chrome-extension: npm ci + npm run build"
cd "$ROOT/chrome-extension"
npm ci
npm run build

echo "→ mrfrik-extension.zip (zawartość chrome-extension/dist — unpack bez dodatkowego folderu)"
(cd "$ROOT/chrome-extension/dist" && zip -rq "$ROOT/deploy/mrfrik-extension.zip" .)

echo "→ HTML na mrfrik.com/mrfrik/"
cd "$ROOT"
for f in instalacja-wtyczki.html zakladka-szukaj.html zakladka-oferta.html zakladka-rozliczenie.html index.html install.html; do
  if [[ -f "$f" ]]; then
    cp "$f" deploy/
    echo "   + $f"
  fi
done

if [[ -f "$ROOT/frik-scraper.zip" ]]; then
  cp "$ROOT/frik-scraper.zip" deploy/
  echo "   + frik-scraper.zip"
fi

echo "→ deploy/:"
ls -la deploy
