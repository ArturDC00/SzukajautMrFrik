/* Ładuje global dla content-auction.js (kolejność: auction-sources → ten plik → content-auction). */
import * as Pdf from './pdf-progi-helper.js';

(function attach(root) {
  root.FrikPdfProgi = Pdf;
})(typeof self !== 'undefined' ? self : this);
