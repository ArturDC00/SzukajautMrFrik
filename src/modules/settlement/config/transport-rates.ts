/**
 * Stawki transportu z USA (źródło: Excel Automekki).
 * Używane przy szacowaniu kosztów po drodze do klienta — kalkulator uzupełni później.
 */

/** Tabela stawek — wypełnij wg arkusza (np. odległość × stawka). */
export const TRANSPORT_RATES_USA: ReadonlyArray<{
  id: string;
  label: string;
  /** Kwota lub null jeśli wyliczana formułą — do ustalenia */
  amountUsd?: number;
}> = [];
