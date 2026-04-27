/**
 * Testy kalkulatora settlement — Vitest.
 * Scenariusze 1–2: wartości inspirowane realnymi fakturami (Ontario, Quebec).
 */
import { describe, expect, it } from 'vitest';
import { AuctionHouse, Country, Currency, type AuctionInvoice } from '../types';
import {
  calculateSettlement,
  UnsupportedLocationError,
} from './calculate-settlement';

function inv(partial: Partial<AuctionInvoice>): AuctionInvoice {
  const base: AuctionInvoice = {
    stockNumber: 'STOCK',
    vin: '1HGBH41JXMN109186',
    saleDate: new Date('2026-01-15'),
    vehicle: { year: 2020, make: 'Dodge', model: 'Test', color: 'Black' },
    auctionHouse: AuctionHouse.IAI_CA,
    location: { city: 'Toronto', stateOrProvince: 'ON', country: Country.CA },
    currency: Currency.CAD,
    charges: {
      saleAmount: 1000,
      buyFee: 0,
      environmentalFee: 0,
      auctionNowFee: 0,
      pullFee: 0,
      carfaxFee: 0,
      digitalSalesFee: 0,
    },
    taxes: { hstGst: 0, pstQst: 0 },
    totalAmount: 1000,
  };
  return { ...base, ...partial, charges: { ...base.charges, ...partial.charges }, taxes: { ...base.taxes, ...partial.taxes }, location: { ...base.location, ...partial.location }, vehicle: { ...base.vehicle, ...partial.vehicle } };
}

describe('calculateSettlement', () => {
  it('Test 1 — Ontario (DODGE RAM 1500, IAAI CA)', () => {
    const invoice = inv({
      vehicle: { year: 2019, make: 'Dodge', model: 'RAM 1500', color: 'Silver' },
      auctionHouse: AuctionHouse.IAI_CA,
      location: { city: 'Toronto', stateOrProvince: 'Ontario', country: Country.CA },
      charges: {
        saleAmount: 7450,
        buyFee: 0,
        environmentalFee: 0,
        auctionNowFee: 0,
        pullFee: 0,
        carfaxFee: 0,
        digitalSalesFee: 0,
      },
      taxes: { hstGst: 968.5, pstQst: 0 },
      totalAmount: 9384.14,
    });

    const r = calculateSettlement(invoice);

    expect(r.baseAmount).toBe(6481.5);
    expect(r.taxRefundable).toBe(968.5);
    expect(r.multiplier).toBe(1.03);
    expect(r.totalToPay).toBe(6675.95);
    expect(r.transfer1).toBe(3337.97);
    expect(r.transfer2).toBe(3337.98);
    expect(r.currency).toBe(Currency.CAD);
    expect(r.recipient.name).toContain('Insurance Auto Auctions Canada');
  });

  it('Test 2 — Quebec (DODGE CHARGER, Copart CA) — GST w wierszu HST/GST, QST=0', () => {
    /**
     * Faktura Quebec: często część federalna widnieje w jednym bloku z HST/GST,
     * a QST=0 w podziale — baza = saleAmount - hstGst - pstQst zgodnie z polami faktury.
     */
    const invoice = inv({
      vehicle: { year: 2021, make: 'Dodge', model: 'Charger', color: 'Red' },
      auctionHouse: AuctionHouse.COPART_CA,
      location: { city: 'Montreal', stateOrProvince: 'Quebec', country: Country.CA },
      charges: {
        saleAmount: 13600,
        buyFee: 0,
        environmentalFee: 0,
        auctionNowFee: 0,
        pullFee: 0,
        carfaxFee: 0,
        digitalSalesFee: 0,
      },
      taxes: { hstGst: 680, pstQst: 0 },
      totalAmount: 15360.25,
    });

    const r = calculateSettlement(invoice);

    expect(r.baseAmount).toBe(12920);
    expect(r.taxRefundable).toBe(680);
    expect(r.totalToPay).toBe(13307.6);
    expect(r.transfer1 + r.transfer2).toBe(r.totalToPay);
    expect(r.recipient.name).toContain('Copart Canada');
  });

  it('Test 3 — USA Texas Copart (hipotetyczny)', () => {
    const invoice = inv({
      location: { city: 'Houston', stateOrProvince: 'TX', country: Country.US },
      currency: Currency.USD,
      auctionHouse: AuctionHouse.COPART_USA,
      charges: {
        saleAmount: 10000,
        buyFee: 200,
        environmentalFee: 0,
        auctionNowFee: 0,
        pullFee: 0,
        carfaxFee: 0,
        digitalSalesFee: 0,
      },
      taxes: { hstGst: 0, pstQst: 0 },
      totalAmount: 10800,
    });

    const r = calculateSettlement(invoice);

    expect(r.baseAmount).toBe(10800);
    expect(r.taxRefundable).toBe(0);
    expect(r.multiplier).toBe(1.0);
    expect(r.totalToPay).toBe(10800);
    expect(r.transfer1).toBe(5400);
    expect(r.transfer2).toBe(5400);
  });

  it('Test 4 — nieobsługiwana lokalizacja (Yukon)', () => {
    const invoice = inv({
      location: { city: 'Whitehorse', stateOrProvince: 'YT', country: Country.CA },
    });

    expect(() => calculateSettlement(invoice)).toThrow(UnsupportedLocationError);
  });
});
