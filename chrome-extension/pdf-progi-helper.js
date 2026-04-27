/**
 * PDF → tekst → uzupełnienie pól Progi (fallback gdy DOM jest ubogi).
 * Wymaga pdf.worker.min.js w pakiecie rozszerzenia (webpack kopiuje z pdfjs-dist).
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

export async function extractTextFromPdfBuffer(buffer) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let full = '';
  const maxPages = Math.min(pdf.numPages, 10);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    full += tc.items.map(function (x) {
      return x.str;
    }).join(' ') + '\n';
  }
  return full;
}

export function mergeProgiPlainTextIntoData(text, base) {
  const t = text || '';
  const out = Object.assign({}, base);
  const vinM = t.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  if (vinM) out.vin = vinM[1];

  const titleLine = t.split(/\r?\n/).find(function (line) {
    return /\d{4}\s+[A-Za-z]/.test(line);
  });
  if (titleLine) {
    const m = titleLine.trim().match(/^(\d{4})\s+([A-Za-z\-]+)\s+(.+)/);
    if (m) {
      out.year = parseInt(m[1], 10);
      out.make = m[2];
      out.model = m[3].replace(/\s*[|#].*$/, '').trim();
      out.vehicleTitle = [out.year, out.make, out.model].join(' ');
    }
  }

  const lotM = t.match(/\b(?:Lot|Lotu|#)[:\s#]*([0-9]{4,10})\b/i);
  if (lotM) out.lotNumber = lotM[1];

  const evM = t.match(/(?:Value|Warto|Price|Bid|High)[:\s]*\$?([\d,]+)/i);
  if (evM) out.estimatedValue = parseInt(evM[1].replace(/,/g, ''), 10);

  const locM = t.match(/(?:Location|Lokalizacja|Yard)[:\s]+([^\n]{3,120})/i);
  if (locM) out.location = locM[1].trim();

  const odoKm = t.match(/([\d,]+)\s*km/i);
  const odoMi = t.match(/Odometer[:\s]*([\d,]+)\s*mi/i) || t.match(/Mileage[:\s]*([\d,]+)\s*mi/i);
  if (odoKm) out.odometerKm = parseInt(odoKm[1].replace(/,/g, ''), 10);
  if (odoMi) out.odometerMi = parseInt(odoMi[1].replace(/,/g, ''), 10);
  if (out.odometerKm && !out.odometerMi) {
    out.odometerMi = Math.round(out.odometerKm / 1.609344);
  }
  out.odometer = out.odometerMi;
  out.pdfFallbackUsed = true;
  if (out.location && typeof self !== 'undefined' && self.FrikAuctionSources) {
    out.locationMeta = self.FrikAuctionSources.parseLocation(out.location, { country: 'CA' });
  }
  return out;
}
