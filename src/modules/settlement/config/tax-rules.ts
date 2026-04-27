/**
 * Reguły podatkowe dla modułu **settlement** (Kanada / USA).
 *
 * **Mnożnik 1.03 (Kanada)**  
 * Po stronie księgowości Automekki stosowany jest dodatkowy mnożnik **1,03** na część
 * rozliczenia związaną z opłatami aukcyjnymi — modeluje **3% niezwrotnego** elementu
 * podatkowego od tych opłat (opis biznesowy: „optymalizacja podatkowa” / rozdział historii).
 * Dokładna interpretacja i moment zastosowania w łańcuchu kwot — do potwierdzenia z księgowością.
 *
 * **Zwrotność HST / GST / QST / PST**  
 * Dla firmy eksportującej pojazdy (Automekka) podatki wymienione w konfiguracji traktujemy
 * jako **podlegające odliczeniu / zwrotowi** w modelu rozliczenia (`refundable: true`) —
 * kalkulator odejmie je od bazy przed mnożnikiem zgodnie z logiką w `calculator/`.
 *
 * **Aktualność (rok 2026)**  
 * Stawki i typy reżimów są **stanem na 2026** i wymagają **weryfikacji rocznej**
 * (zmiany CRA / prowincji, harmonized rates).
 *
 * **TODO — weryfikacja z Cezarym (sesja „mapy scenariuszy”)**  
 * Stawki dla prowincji **inne niż Ontario i Quebec** są **przybliżone** (typowe połączenia
 * federal GST + provincial). **MUSZĄ** zostać potwierdzone z dokumentacją i praktyką Automekki
 * przed użyciem produkcyjnym.
 */

/**
 * Konfiguracja reguł podatkowych: Kanada (per prowincja) oraz USA (domyślnie).
 * Kształt z `as const` zachowuje literały typów dla kalkulatora.
 */
export const TAX_RULES = {
  CA: {
    // Ontario — HST 13% (zwrotny dla eksportu)
    ON: { type: 'HST', rate: 0.13, refundable: true, multiplier: 1.03 },
    // Quebec — GST 5% + QST 9.975% (oba zwrotne)
    QC: { type: 'GST_QST', gst: 0.05, qst: 0.09975, refundable: true, multiplier: 1.03 },
    // British Columbia — GST 5% + PST 7%
    BC: { type: 'GST_PST', gst: 0.05, pst: 0.07, refundable: true, multiplier: 1.03 },
    // Alberta — tylko GST 5%
    AB: { type: 'GST', gst: 0.05, refundable: true, multiplier: 1.03 },
    // Manitoba — GST 5% + PST 7%
    MB: { type: 'GST_PST', gst: 0.05, pst: 0.07, refundable: true, multiplier: 1.03 },
    // Saskatchewan — GST 5% + PST 6%
    SK: { type: 'GST_PST', gst: 0.05, pst: 0.06, refundable: true, multiplier: 1.03 },
    // Maritime provinces — HST 15%
    NS: { type: 'HST', rate: 0.15, refundable: true, multiplier: 1.03 },
    NB: { type: 'HST', rate: 0.15, refundable: true, multiplier: 1.03 },
    NL: { type: 'HST', rate: 0.15, refundable: true, multiplier: 1.03 },
    PE: { type: 'HST', rate: 0.15, refundable: true, multiplier: 1.03 },
  },
  US: {
    // USA — brak podatku eksportowego, mnożnik = 1.0 (bez 3% niezwrotnego)
    DEFAULT: { type: 'NONE', rate: 0, refundable: false, multiplier: 1.0 },
  },
} as const;

export type TaxRules = typeof TAX_RULES;
