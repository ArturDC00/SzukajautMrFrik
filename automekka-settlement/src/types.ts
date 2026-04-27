/** Waluta przelewów (ta sama dla obu 50/50). */
export type SettlementCurrency = 'USD' | 'CAD';

export type AuctionRegion = 'US' | 'CA';

/** Dane bankowe odbiorcy (ten sam dla obu przelewów). */
export interface BankRecipient {
  beneficiaryName: string;
  /** IBAN lub nr konta — wg standardu firmy */
  accountOrIban: string;
  bankName?: string;
  swiftBic?: string;
  routingOrSort?: string;
  referenceHint?: string;
}

/** Wejście z faktury / ręcznie — Kanada. */
export interface CanadaSettlementInput {
  region: 'CA';
  currency: SettlementCurrency;
  /** Kwota sprzedaży z faktury aukcyjnej (brutto / jak na dokumencie). */
  saleAmount: number;
  /** HST do odjęcia przed współczynnikiem 1.03 (wg księgowości). */
  hstAmount: number;
  /** Pozostałe opłaty aukcyjne (opcjonalnie), w tej samej walucie. */
  otherFees?: number;
}

/** Wejście — USA (bez wzoru HST; tylko kwota + opłaty). */
export interface USSettlementInput {
  region: 'US';
  currency: SettlementCurrency;
  saleAmount: number;
  fees?: number;
}

export type SettlementInput = CanadaSettlementInput | USSettlementInput;

/** Dwie kwoty przelewów (50/50, ta sama waluta). */
export interface WireSplit {
  currency: SettlementCurrency;
  wire1: number;
  wire2: number;
  total: number;
}

export interface SettlementResult {
  region: AuctionRegion;
  currency: SettlementCurrency;
  /** Suma do zapłaty domowi aukcyjnemu (przed podziałem 50/50). */
  grandTotal: number;
  split: WireSplit;
  /** Notka do PDF / Bitrix (audyt). */
  formulaNote: string;
}
