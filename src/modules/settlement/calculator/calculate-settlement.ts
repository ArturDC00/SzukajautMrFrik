/**
 * Czysta funkcja rozliczenia po fakturze aukcyjnej — bez I/O, pod testy jednostkowe.
 */

import { AUCTION_HOUSES } from '../config/auction-houses';
import { TAX_RULES } from '../config/tax-rules';
import type { AuctionInvoice, SettlementResult } from '../types';
import { Country } from '../types';

type CaProvinceCode = keyof typeof TAX_RULES.CA;
type CaTaxRule = (typeof TAX_RULES.CA)[CaProvinceCode];
type UsTaxRule = (typeof TAX_RULES.US)['DEFAULT'];
export type ResolvedTaxRule = CaTaxRule | UsTaxRule;

/** Mapowanie pełnej nazwy prowincji → kod (dla faktur z tekstem zamiast kodu). */
const CA_PROVINCE_NAME_TO_CODE: Record<string, CaProvinceCode> = {
  ONTARIO: 'ON',
  QUEBEC: 'QC',
  'BRITISH COLUMBIA': 'BC',
  ALBERTA: 'AB',
  MANITOBA: 'MB',
  SASKATCHEWAN: 'SK',
  'NOVA SCOTIA': 'NS',
  'NEW BRUNSWICK': 'NB',
  'NEWFOUNDLAND AND LABRADOR': 'NL',
  NEWFOUNDLAND: 'NL',
  LABRADOR: 'NL',
  'PRINCE EDWARD ISLAND': 'PE',
};

export class UnsupportedLocationError extends Error {
  constructor(
    message: string,
    public readonly country: Country,
    public readonly stateOrProvince: string,
  ) {
    super(message);
    this.name = 'UnsupportedLocationError';
  }
}

export class InvalidInvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInvoiceError';
  }
}

function roundToCents(n: number): number {
  if (!Number.isFinite(n)) throw new InvalidInvoiceError('Kwota musi być skończoną liczbą');
  return Math.round(n * 100) / 100;
}

function assertNonNegative(label: string, n: number): void {
  if (!Number.isFinite(n) || n < 0) {
    throw new InvalidInvoiceError(`Nieprawidłowa wartość: ${label}`);
  }
}

/**
 * Normalizuje kod lub nazwę prowincji kanadyjskiej do klucza z `TAX_RULES.CA`.
 */
export function normalizeCanadianProvinceCode(raw: string): CaProvinceCode | null {
  const t = raw.trim();
  if (!t) return null;
  const two = t.length === 2 ? t.toUpperCase() : null;
  if (two && two in TAX_RULES.CA) return two as CaProvinceCode;
  const fromName = CA_PROVINCE_NAME_TO_CODE[t.toUpperCase()];
  if (fromName) return fromName;
  return null;
}

/**
 * Zwraca regułę podatkową dla kraju i stanu/prowincji (bez walidacji faktury).
 */
export function resolveTaxRule(
  country: Country,
  stateOrProvince: string,
): ResolvedTaxRule {
  if (country === Country.US) {
    return TAX_RULES.US.DEFAULT;
  }
  if (country === Country.CA) {
    const code = normalizeCanadianProvinceCode(stateOrProvince);
    if (!code) {
      throw new UnsupportedLocationError(
        `Brak reguły podatkowej dla prowincji: "${stateOrProvince}"`,
        country,
        stateOrProvince,
      );
    }
    return TAX_RULES.CA[code];
  }
  throw new UnsupportedLocationError(`Nieobsługiwany kraj: ${String(country)}`, country, stateOrProvince);
}

/**
 * Dzieli kwotę na dwa przelewy: pierwsza połowa w dół do centa, reszta w drugim.
 */
export function splitIntoTransfers(totalToPay: number): { transfer1: number; transfer2: number } {
  if (!Number.isFinite(totalToPay) || totalToPay < 0) {
    throw new InvalidInvoiceError('totalToPay musi być skończoną liczbą nieujemną');
  }
  const t1 = Math.floor((totalToPay * 100) / 2) / 100;
  const t2 = roundToCents(totalToPay - t1);
  return { transfer1: t1, transfer2: t2 };
}

function validateInvoice(invoice: AuctionInvoice): void {
  assertNonNegative('charges.saleAmount', invoice.charges.saleAmount);
  assertNonNegative('taxes.hstGst', invoice.taxes.hstGst);
  assertNonNegative('taxes.pstQst', invoice.taxes.pstQst);
  assertNonNegative('totalAmount', invoice.totalAmount);

  if (invoice.charges.saleAmount <= 0) {
    throw new InvalidInvoiceError('charges.saleAmount musi być dodatnie');
  }
  const c = invoice.charges;
  assertNonNegative('buyFee', c.buyFee);
  assertNonNegative('environmentalFee', c.environmentalFee);
  assertNonNegative('auctionNowFee', c.auctionNowFee);
  assertNonNegative('pullFee', c.pullFee);
  assertNonNegative('carfaxFee', c.carfaxFee);
  assertNonNegative('digitalSalesFee', c.digitalSalesFee);
  if (c.otherFees !== undefined) assertNonNegative('otherFees', c.otherFees);

  if (invoice.location.country === Country.US && invoice.totalAmount <= 0) {
    throw new InvalidInvoiceError('totalAmount musi być dodatnie dla USA');
  }
}

/**
 * Główny kalkulator rozliczenia — funkcja czysta (bez side-effectów).
 */
export function calculateSettlement(invoice: AuctionInvoice): SettlementResult {
  validateInvoice(invoice);

  const taxRule = resolveTaxRule(invoice.location.country, invoice.location.stateOrProvince);
  const multiplier = taxRule.multiplier;

  let baseAmount: number;
  let taxRefundable: number;

  if (invoice.location.country === Country.CA) {
    taxRefundable = roundToCents(invoice.taxes.hstGst + invoice.taxes.pstQst);
    baseAmount = roundToCents(invoice.charges.saleAmount - taxRefundable);
  } else {
    taxRefundable = 0;
    baseAmount = roundToCents(invoice.totalAmount);
  }

  if (baseAmount < 0) {
    throw new InvalidInvoiceError('baseAmount ujemne — zbyt duże odliczenia podatków względem saleAmount');
  }

  const totalToPayRaw = baseAmount * multiplier;
  const totalToPay = roundToCents(totalToPayRaw);
  const { transfer1, transfer2 } = splitIntoTransfers(totalToPay);

  const recipient = AUCTION_HOUSES[invoice.auctionHouse];
  if (!recipient) {
    throw new InvalidInvoiceError(`Brak danych bankowych dla domu: ${invoice.auctionHouse}`);
  }

  const steps: SettlementResult['calculation']['steps'] = [];

  if (invoice.location.country === Country.CA) {
    const prov = normalizeCanadianProvinceCode(invoice.location.stateOrProvince);
    let pstFormula: string | undefined;
    if (invoice.taxes.pstQst === 0) {
      if (prov === 'ON') pstFormula = 'brak w Ontario';
      else if (prov === 'QC') {
        pstFormula =
          'QST=0 na fakturze — nietypowe; często GST jest w jednym wierszu jako HST/GST (eksport) — zweryfikuj z fakturą';
      } else pstFormula = 'na fakturze 0';
    }

    steps.push({ label: 'Sale Amount', value: roundToCents(invoice.charges.saleAmount) });
    steps.push({
      label: 'HST/GST do odjęcia',
      value: roundToCents(-invoice.taxes.hstGst),
      formula: 'zwrotny dla eksportu',
    });
    steps.push({
      label: 'PST/QST do odjęcia',
      value: roundToCents(-invoice.taxes.pstQst),
      formula: pstFormula,
    });
    steps.push({ label: 'Baza do obliczenia', value: baseAmount });
  } else {
    steps.push({ label: 'Suma pozycji (totalAmount)', value: baseAmount, formula: 'USA — bez odliczenia podatku eksportowego' });
  }

  steps.push({
    label: 'Mnożnik',
    value: multiplier,
    formula: invoice.location.country === Country.CA ? '3% niezwrotny podatek od opłat (model CA)' : 'brak (USA)',
  });
  steps.push({ label: 'Suma do zapłaty', value: totalToPay });
  steps.push({ label: 'Przelew 1', value: transfer1 });
  steps.push({ label: 'Przelew 2', value: transfer2 });

  return {
    baseAmount,
    taxRefundable,
    multiplier,
    totalToPay,
    transfer1,
    transfer2,
    currency: invoice.currency,
    recipient,
    calculation: { steps },
  };
}
