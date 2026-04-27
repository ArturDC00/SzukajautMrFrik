/**
 * Dane bankowe odbiorcy przelewu wg **domu aukcyjnego**.
 *
 * **Instrukcja:**  
 * 1. Cezary / księgowość uzupełnia pola `bank`, `swift`, `account`, `address` (oraz `iban` jeśli dotyczy)
 *    wartościami z aktualnych umów lub szablonów faktur — zamień każde `TODO` na produkcyjny tekst.  
 * 2. Po zmianie zweryfikuj przelew testowy (1 USD/CAD) lub potwierdzenie z bankiem.  
 * 3. Nie commituj prawdziwych numerów kont w publicznym repozytorium bez zgody — rozważ `.env` / sekrety CI.
 */

import { AuctionHouse, type BankRecipient } from '../types';

/**
 * Placeholder: pełny zestaw domów z enumu `AuctionHouse`.
 * Wszystkie pola techniczne ustawione na `TODO` do uzupełnienia przez Cezarego.
 */
export const AUCTION_HOUSES: Record<AuctionHouse, BankRecipient> = {
  [AuctionHouse.IAI_USA]: {
    name: 'Insurance Auto Auctions Inc.',
    bank: 'TODO',
    swift: 'TODO',
    account: 'TODO',
    address: 'TODO',
  },
  [AuctionHouse.IAI_CA]: {
    name: 'Insurance Auto Auctions Canada',
    bank: 'TODO',
    swift: 'TODO',
    account: 'TODO',
    address: 'TODO',
  },
  [AuctionHouse.COPART_USA]: {
    name: 'Copart Inc.',
    bank: 'TODO',
    swift: 'TODO',
    account: 'TODO',
    address: 'TODO',
  },
  [AuctionHouse.COPART_CA]: {
    name: 'Copart Canada Inc.',
    bank: 'TODO',
    swift: 'TODO',
    account: 'TODO',
    address: 'TODO',
  },
  [AuctionHouse.MANHEIM]: {
    name: 'Manheim Auctions',
    bank: 'TODO',
    swift: 'TODO',
    account: 'TODO',
    address: 'TODO',
  },
  [AuctionHouse.PROGI]: {
    name: 'Progi Online Solutions',
    bank: 'TODO',
    swift: 'TODO',
    account: 'TODO',
    address: 'TODO',
  },
};
