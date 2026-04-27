/**
 * Typy domenowe modułu **settlement** (rozliczenie po wygranej aukcji).
 * Współpracują z fakturą aukcyjną i kalkulatorem dwóch przelewów 50/50.
 */

/**
 * Dom aukcyjny wystawiający fakturę — decyduje o szablonie opłat i odbiorcy przelewu.
 */
export enum AuctionHouse {
  IAI_USA = 'IAI_USA',
  IAI_CA = 'IAI_CA',
  COPART_USA = 'COPART_USA',
  COPART_CA = 'COPART_CA',
  MANHEIM = 'MANHEIM',
  PROGI = 'PROGI',
}

/**
 * Waluta rozliczenia (ta sama dla obu przelewów i kwot z faktury).
 */
export enum Currency {
  USD = 'USD',
  CAD = 'CAD',
}

/**
 * Kraj lokalizacji pojazdu / yardu z faktury — wpływa na reguły podatkowe i transport.
 */
export enum Country {
  US = 'US',
  CA = 'CA',
}

/**
 * Prowincja kanadyjska (kod ISO-style używany na fakturach i w kalkulatorze HST/GST/PST).
 */
export enum CanadianProvince {
  ON = 'ON',
  QC = 'QC',
  BC = 'BC',
  AB = 'AB',
  MB = 'MB',
  SK = 'SK',
  NS = 'NS',
  NB = 'NB',
  NL = 'NL',
  PE = 'PE',
}

/**
 * Odbiorca przelewu (yard / dom aukcyjny) — te same dane na oba przelewy 50/50.
 */
export interface BankRecipient {
  /** Nazwa beneficjenta na fakturze / przelewie */
  name: string;
  /** Nazwa banku */
  bank: string;
  /** Kod SWIFT/BIC */
  swift: string;
  /** Numer konta (jeśli stosowany zamiast IBAN) */
  account: string;
  /** IBAN, gdy występuje na fakturze */
  iban?: string;
  /** Adres odbiorcy (często wymagany w PDF dla klienta) */
  address: string;
}

/**
 * Pojedynczy krok audytu: etykieta, kwota po kroku, opcjonalnie wzór tekstowy dla księgowości.
 */
export interface CalculationStep {
  label: string;
  value: number;
  /** Opcjonalny opis wzoru, np. "(sale - HST) * 1.03" */
  formula?: string;
}

/**
 * Ślad obliczenia od kwot faktury do dwóch przelewów — do PDF i sporów.
 */
export interface CalculationBreakdown {
  steps: CalculationStep[];
}

/**
 * Opis pojazdu z faktury aukcyjnej (nie mylić z pełnym rekordem CRM).
 */
export interface AuctionInvoiceVehicle {
  year: number;
  make: string;
  model: string;
  color: string;
}

/**
 * Lokalizacja z faktury — miasto, stan lub prowincja, kraj.
 */
export interface AuctionInvoiceLocation {
  city: string;
  /** Dla USA: kod stanu (np. NY); dla Kanady: kod prowincji */
  stateOrProvince: string;
  country: Country;
}

/**
 * Opłaty pozycyjne z faktury (kwoty już w walucie faktury).
 */
export interface AuctionInvoiceCharges {
  saleAmount: number;
  buyFee: number;
  environmentalFee: number;
  auctionNowFee: number;
  pullFee: number;
  carfaxFee: number;
  digitalSalesFee: number;
  /** Pozostałe pozycje faktury niewymienione explicite */
  otherFees?: number;
}

/**
 * Zsumowane podatki z faktury — HST/GST oraz PST/QST osobno (np. do odliczeń i audytu).
 */
export interface AuctionInvoiceTaxes {
  hstGst: number;
  pstQst: number;
}

/**
 * Faktura aukcyjna po OCR / ręcznym wpisie — wejście do kalkulatora rozliczenia.
 * Reprezentuje to, co Automekka odczytała z dokumentu, zanim policzy dwa przelewy.
 */
export interface AuctionInvoice {
  stockNumber: string;
  vin: string;
  saleDate: Date;
  vehicle: AuctionInvoiceVehicle;
  auctionHouse: AuctionHouse;
  location: AuctionInvoiceLocation;
  currency: Currency;
  charges: AuctionInvoiceCharges;
  taxes: AuctionInvoiceTaxes;
  /** Suma należności z faktury (jak na dokumencie), do weryfikacji z pozycjami */
  totalAmount: number;
}

/**
 * Wynik kalkulatora: kwoty bazowe, mnożnik (np. 1.03 dla CA), suma do zapłaty i podział 50/50 oraz odbiorca.
 */
export interface SettlementResult {
  /** Kwota bazowa po odjęciu podatków podlegających zwrotowi / korekcie (wg reguł firmy) */
  baseAmount: number;
  /** Suma podatków odliczonych od bazy przed mnożnikiem */
  taxRefundable: number;
  /** Mnożnik księgowy: 1.03 dla Kanady, 1.0 dla USA (optymalizacja podatkowa) */
  multiplier: number;
  /** Łączna kwota do zapłaty domowi aukcyjnemu przed podziałem na dwa przelewy */
  totalToPay: number;
  /** Pierwszy przelew (50% lub pierwsza część po zaokrągleniu) */
  transfer1: number;
  /** Drugi przelew (dopełnienie do totalToPay) */
  transfer2: number;
  currency: Currency;
  recipient: BankRecipient;
  calculation: CalculationBreakdown;
}
