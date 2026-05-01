# Integracja wtyczki → platforma (C4 — miniaturka CDN)

Po **udanym** zapisie pierwszego zdjęcia z aukcji jako pliku w Bitrix (`uploadAuctionImagesAsBitrixFiles`), wtyczka może wysłać **tę samą** bitmapę na endpoint platformy Next.js — zapis na S3 i URL w polu UF na ofercie (`portal-thumbnail-ingest`).

## Konfiguracja (popup MrFrik)

1. Zaznacz **„Po pierwszym udanym zdjęciu w CRM wyślij kopię na platformę”**.
2. **URL:** pełny adres `POST`, np.  
   `https://<twoja-domena>/api/offers/portal-thumbnail-ingest`  
   Lokalnie: `http://localhost:3000/api/offers/portal-thumbnail-ingest` (w `manifest.json` jest `http://localhost:3000/*`).
3. **Klucz:** wartość nagłówka `INTERNAL_API_KEY` z deploymentu platformy (Vercel).  
   **Uwaga:** klucz w `chrome.storage` — używaj tylko na komputerze zaufanym; nie commituj.

## Wymagania po stronie platformy

- Skonfigurowany S3 + `PORTAL_THUMB_PUBLIC_BASE_URL`, pole UF URL na quote (`BITRIX_UF_QUOTE_PORTAL_THUMB_URL`).
- Ten sam `INTERNAL_API_KEY` co przy innych wywołaniach serwer→serwer.

## Zachowanie

- Wywołanie jest **opcjonalne** i **nie blokuje** zapisu w Bitrix.
- Błąd HTTP jest tylko w konsoli (`[MrFrik] portal CDN ingest`).

Szerszy kontekst: repo **mrfrik-platform** — `docs/D1-D2-C4-QA.md` (checklist QA), `docs/ZAKRES-repo-platform-vs-szukaj-aut.md`.
