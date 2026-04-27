import type {
  CanadaSettlementInput,
  SettlementCurrency,
  SettlementInput,
  SettlementResult,
  USSettlementInput,
  WireSplit,
} from './types';

const EPS = 1e-9;

/** Kanada: (sale_amount - HST) * 1.03 + opłaty (opcjonalnie). */
export function canadaGrandTotal(input: CanadaSettlementInput): number {
  const fees = input.otherFees ?? 0;
  const base = (input.saleAmount - input.hstAmount) * 1.03;
  return roundMoney(base + fees);
}

/** USA: sale_amount + opłaty. */
export function usGrandTotal(input: USSettlementInput): number {
  const fees = input.fees ?? 0;
  return roundMoney(input.saleAmount + fees);
}

/**
 * Podział 50/50 na dwa przelewy w tej samej walucie.
 * Reszta z dzielenia trafia na drugi przelew (unikamy utraty groszy).
 */
export function splitFiftyFifty(
  total: number,
  currency: SettlementCurrency,
): WireSplit {
  const t = roundMoney(total);
  if (t < 0) throw new Error('Total cannot be negative');
  const cents = Math.round(t * 100);
  const halfCents = Math.floor(cents / 2);
  const restCents = cents - halfCents;
  return {
    currency,
    wire1: halfCents / 100,
    wire2: restCents / 100,
    total: t,
  };
}

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) throw new Error('Amount must be finite');
  return Math.round((n + EPS) * 100) / 100;
}

export function settlementFromInput(input: SettlementInput): SettlementResult {
  let grand: number;
  let formulaNote: string;

  if (input.region === 'CA') {
    grand = canadaGrandTotal(input);
    formulaNote =
      `CA: (${input.saleAmount} - ${input.hstAmount}) * 1.03` +
      (input.otherFees ? ` + fees ${input.otherFees}` : '') +
      ` = ${grand} ${input.currency}`;
  } else {
    grand = usGrandTotal(input);
    formulaNote =
      `US: ${input.saleAmount}` +
      (input.fees ? ` + fees ${input.fees}` : '') +
      ` = ${grand} ${input.currency}`;
  }

  const split = splitFiftyFifty(grand, input.currency);

  if (Math.abs(split.wire1 + split.wire2 - split.total) > 0.01) {
    throw new Error('Split invariant failed');
  }

  return {
    region: input.region,
    currency: input.currency,
    grandTotal: grand,
    split,
    formulaNote,
  };
}
