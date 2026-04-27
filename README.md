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

## Wdrożenie na produkcję (mrfrik.com)

**Sam commit w Cursorze / Source Control nie wgrywa plików na serwer** — Git tylko zapisuje historię w repozytorium. Żeby strona `https://mrfrik.com/mrfrik/` i plik `mrfrik-extension.zip` się zaktualizowały, trzeba albo ręcznie wrzucić pliki na hosting, albo uruchomić automat z repozytorium **GitHub**.

W repozytorium jest workflow **GitHub Actions** (`.github/workflows/deploy-mrfrik-ftp.yml`):

1. Repozytorium musi być na **GitHubie** i **wysłane** tam (`git push`), nie tylko commit lokalny.
2. W **Settings → Secrets and variables → Actions** dodaj sekrety:
   - `FTP_SERVER` — adres serwera FTP,
   - `FTP_USERNAME`, `FTP_PASSWORD`,
   - `FTP_REMOTE_DIR` — katalog odpowiadający URL-owi `/mrfrik/` na serwerze (np. `public_html/mrfrik/` — zgodnie z panelem hostingu).
3. Po każdym **pushu** na branch `main` lub `master` workflow zbuduje wtyczkę (`npm ci` + `npm run build` w `chrome-extension/`), utworzy `deploy/` (HTML + świeży `mrfrik-extension.zip`) i wgra folder `deploy/` przez FTP.

Ręcznie lokalnie ten sam zestaw zbudujesz: `bash scripts/build-deploy-artifacts.sh`, a potem zawartość `deploy/` wrzucasz tam, gdzie stoi produkcja.
