# SzukajautMrFrik

MrFrik — zakładka Bitrix24 „Szukaj aut” oraz rozszerzenie Chrome do tworzenia ofert z aukcji (IAAI, Copart, Progi; wersja z obsługą Kanady i parserem prowincji).

## Struktura

- `chrome-extension/` — rozszerzenie Chrome (manifest, `content-auction.js`, `auction-sources.js`, popup z webhookiem)
- `frik-scraper/` — serwis Node (Playwright) do podglądu danych z listingu
- `zakladka-szukaj.html` i powiązane pliki — treści ładowane w Bitrix24 (iframe)
- `instalacja-wtyczki.html` — instrukcja instalacji wtyczki dla użytkowników

## Wymagania

- Do scrapera: Node.js, `npm install` w `frik-scraper/`
- Wtyczka: Chrome / Chromium, własny URL webhooka Bitrix zapisany w menu rozszerzenia

## Konfiguracja

Webhook Bitrix i hosting zakładek ustawiasz lokalnie / na serwerze produkcyjnym; nie commituj plików `.env` ani sekretów.
