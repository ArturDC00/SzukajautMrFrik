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

### Przepływ: lokalnie → GitHub → serwer

1. **Commit + Push** z Cursora (Source Control) na branch **`main`** do repozytorium  
   `https://github.com/ArturDC00/SzukajautMrFrik.git` — sam commit lokalny **nie** uruchamia wdrożenia; musi być **`git push`** (albo „Sync” / „Publish Branch” w IDE).
2. Na GitHubie uruchamia się workflow **Actions** → **Deploy mrfrik** (`.github/workflows/deploy-mrfrik.yml`): buduje wtyczkę i zawartość `deploy/`, potem wgrywa ją na serwer **jedną z dwóch metod** (ustawiasz tylko jedną — pierwszeństwo ma SSH).

### Jednorazowa konfiguracja sekretów (GitHub)

**Repozytorium → Settings → Secrets and variables → Actions → New repository secret.**

#### A) VPS przez SSH/rsync (zalecane)

| Sekret | Przykład / znaczenie |
|--------|----------------------|
| `SSH_HOST` | `135.125.243.231` lub hostname |
| `SSH_USER` | `ubuntu` |
| `SSH_PRIVATE_KEY` | Cały klucz prywatny PEM (np. treść `~/.ssh/id_ed25519` lub dedykowany klucz deploy); **publiczny** klucz dodaj na serwerze w `~/.ssh/authorized_keys` użytkownika `SSH_USER` |
| `SSH_REMOTE_DIR` | Absolutna ścieżka katalogu, pod który nginx serwuje zawartość jak z `/mrfrik/` (np. `.../public/mrfrik/` — **końcówka `/`**; musi odpowiadać temu, co masz w produkcji) |

Jeśli `SSH_HOST` jest ustawiony, workflow **nie** użyje FTP.

#### B) Hosting z FTP

| Sekret | Znaczenie |
|--------|-----------|
| `FTP_SERVER` | Host FTP |
| `FTP_USERNAME`, `FTP_PASSWORD` | Dane logowania |
| `FTP_REMOTE_DIR` | Katalog docelowy na serwerze (np. `public_html/mrfrik/`) |

Używaj FTP **tylko** gdy nie ustawiasz `SSH_HOST` (np. hosting współdzielony bez SSH).

### Co robi workflow

Po **pushu** na `main` lub `master` (albo ręcznie: Actions → **Deploy mrfrik** → **Run workflow**): `npm ci` + `npm run build` w `chrome-extension/`, paczka `deploy/` (HTML + `mrfrik-extension.zip` itd.), synchronizacja na serwer.

### Lokalny build bez Actions

Ten sam zestaw co na CI: `bash scripts/build-deploy-artifacts.sh` — wynik w `deploy/` (do testów lub ręcznego rsync).
