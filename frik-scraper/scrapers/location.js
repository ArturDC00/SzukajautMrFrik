'use strict';

const CA_TAX = {
  HST:      ['NB', 'NL', 'NS', 'ON', 'PE'],
  GST_QST:  ['QC'],
  GST_PST:  ['BC', 'MB', 'SK'],
  GST_ONLY: ['AB', 'NT', 'NU', 'YT'],
};

const CA_PROV = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

function taxRegimeForProvince(code) {
  if (!code) return null;
  const p = String(code).toUpperCase();
  for (const [reg, list] of Object.entries(CA_TAX)) {
    if (list.includes(p)) return reg;
  }
  return null;
}

const CA_NAME_TO_CODE = {
  alberta: 'AB', 'british columbia': 'BC', manitoba: 'MB', 'new brunswick': 'NB',
  'newfoundland and labrador': 'NL', 'northwest territories': 'NT', 'nova scotia': 'NS',
  nunavut: 'NU', ontario: 'ON', 'prince edward island': 'PE', quebec: 'QC',
  saskatchewan: 'SK', yukon: 'YT', labrador: 'NL',
};

function tryProvinceFromName(raw) {
  const l = String(raw).toLowerCase();
  for (const [name, code] of Object.entries(CA_NAME_TO_CODE)) {
    if (l.includes(name)) return code;
  }
  return null;
}

function provinceFromCanadianPostal(s) {
  const m = s.toUpperCase().match(/\b([A-Z]\d[A-Z])\s*\d[A-Z]\d\b/);
  if (!m) return null;
  const c = m[1][0];
  if (c === 'A') return 'NL';
  if (c === 'B') return 'NS';
  if (c === 'C') return 'PE';
  if (c === 'E') return 'NB';
  if ('GHJ'.includes(c)) return 'QC';
  if ('KLMNPT'.includes(c)) return 'ON';
  if (c === 'R') return 'MB';
  if (c === 'S') return 'SK';
  if (c === 'V') return 'BC';
  if (c === 'X') return 'NU';
  if (c === 'Y') return 'YT';
  return null;
}

/**
 * @param {string} raw
 * @returns {{ country: string|null, region: string|null, taxRegime: string|null, raw: string }}
 */
function parseLocation(raw) {
  if (!raw || typeof raw !== 'string') {
    return { country: null, region: null, taxRegime: null, raw: raw || '' };
  }
  const s = raw.trim();

  const mProv = s.match(/,\s*(QC|ON|AB|BC|MB|SK|PE|NS|NL|NT|NU|YT|NB)\b/i);
  if (mProv) {
    const pr = mProv[1].toUpperCase();
    return { country: 'CA', region: pr, taxRegime: taxRegimeForProvince(pr), raw: s };
  }

  const fromName = tryProvinceFromName(s);
  if (fromName) {
    return { country: 'CA', region: fromName, taxRegime: taxRegimeForProvince(fromName), raw: s };
  }

  const fromPostal = provinceFromCanadianPostal(s);
  if (fromPostal) {
    return { country: 'CA', region: fromPostal, taxRegime: taxRegimeForProvince(fromPostal), raw: s };
  }

  const mEnd = s.match(/,\s*([A-Z]{2})(?:\s+\d{5}(-\d{4})?)?\s*$/i);
  if (mEnd) {
    const st = mEnd[1].toUpperCase();
    if (CA_PROV.has(st)) {
      return { country: 'CA', region: st, taxRegime: taxRegimeForProvince(st), raw: s };
    }
    return { country: 'US', region: st, taxRegime: null, raw: s };
  }

  return { country: null, region: null, taxRegime: null, raw: s };
}

module.exports = { parseLocation, taxRegimeForProvince, provinceFromCanadianPostal };
