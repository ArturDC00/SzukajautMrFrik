import type { BankRecipient, SettlementResult } from './types';

/** Kształt payloadu pod zewnętrzny webhook (dostosuj URL i pola w workerze Next). */
export interface BitrixSettlementPayload {
  kind: 'automekka.settlement.v1';
  region: 'US' | 'CA';
  currency: string;
  grandTotal: number;
  wire1: number;
  wire2: number;
  formulaNote: string;
  bank: BankRecipient;
  /** Metadane deala / oferty z CRM (wypełnia aplikacja). */
  crm?: {
    dealId?: string;
    quoteId?: string;
    invoiceUrl?: string;
  };
}

export function toBitrixPayload(
  result: SettlementResult,
  bank: BankRecipient,
  crm?: BitrixSettlementPayload['crm'],
): BitrixSettlementPayload {
  return {
    kind: 'automekka.settlement.v1',
    region: result.region,
    currency: result.currency,
    grandTotal: result.grandTotal,
    wire1: result.split.wire1,
    wire2: result.split.wire2,
    formulaNote: result.formulaNote,
    bank: { ...bank },
    crm: crm ? { ...crm } : undefined,
  };
}
