/* auction-sources.js — rejestr źródeł aukcji + parser lokalizacji (prowincje CA / stany US). */
(function initFrikAuctionSources(root) {
  'use strict';

  const KM_PER_MI = 1.609344;

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
   * @param {object} [sourceConfig]
   * @returns {{ country: string|null, region: string|null, taxRegime: string|null, raw: string }}
   */
  function parseLocation(raw, sourceConfig) {
    if (!raw || typeof raw !== 'string') {
      return { country: null, region: null, taxRegime: null, raw: raw || '' };
    }
    const s = raw.trim();
    const cc = sourceConfig && sourceConfig.country;

    if (cc === 'US') {
      const mEnd = s.match(/,\s*([A-Z]{2})(?:\s+\d{5}(-\d{4})?)?\s*$/i);
      if (mEnd) {
        return { country: 'US', region: mEnd[1].toUpperCase(), taxRegime: null, raw: s };
      }
    }

    if (cc === 'CA') {
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
    }

    const mProv0 = s.match(/,\s*(QC|ON|AB|BC|MB|SK|PE|NS|NL|NT|NU|YT|NB)\b/i);
    if (mProv0) {
      const pr = mProv0[1].toUpperCase();
      return { country: 'CA', region: pr, taxRegime: taxRegimeForProvince(pr), raw: s };
    }
    const fromName0 = tryProvinceFromName(s);
    if (fromName0) {
      return { country: 'CA', region: fromName0, taxRegime: taxRegimeForProvince(fromName0), raw: s };
    }
    const fromPostal0 = provinceFromCanadianPostal(s);
    if (fromPostal0) {
      return { country: 'CA', region: fromPostal0, taxRegime: taxRegimeForProvince(fromPostal0), raw: s };
    }
    const mEnd0 = s.match(/,\s*([A-Z]{2})(?:\s+\d{5}(-\d{4})?)?\s*$/i);
    if (mEnd0) {
      const st = mEnd0[1].toUpperCase();
      if (CA_PROV.has(st)) {
        return { country: 'CA', region: st, taxRegime: taxRegimeForProvince(st), raw: s };
      }
      return { country: 'US', region: st, taxRegime: null, raw: s };
    }
    return { country: null, region: null, taxRegime: null, raw: s };
  }

  const SOURCES = {
    IAAI_US: {
      id: 'IAAI_US',
      label: 'IAAI',
      country: 'US',
      currency: 'USD',
      sourceEnum: 3089,
      fabColor: '#0b66c2',
      panelColor: '#0b66c2',
      accentHover: '#0955a8',
    },
    COPART_US: {
      id: 'COPART_US',
      label: 'Copart',
      country: 'US',
      currency: 'USD',
      sourceEnum: 3091,
      fabColor: '#d35400',
      panelColor: '#d35400',
      accentHover: '#a84300',
    },
    IAAI_CA: {
      id: 'IAAI_CA',
      label: 'IAAI (Kanada)',
      country: 'CA',
      currency: 'CAD',
      sourceEnum: null,
      fabColor: '#0b66c2',
      panelColor: '#0b66c2',
      accentHover: '#0955a8',
    },
    COPART_CA: {
      id: 'COPART_CA',
      label: 'Copart (Kanada)',
      country: 'CA',
      currency: 'CAD',
      sourceEnum: null,
      fabColor: '#d35400',
      panelColor: '#d35400',
      accentHover: '#a84300',
    },
    PROGI_CA: {
      id: 'PROGI_CA',
      label: 'Progi',
      country: 'CA',
      currency: 'CAD',
      sourceEnum: null,
      fabColor: '#6f42c1',
      panelColor: '#6f42c1',
      accentHover: '#5a2d9e',
    },
    MANHEIM_ADESA: {
      id: 'MANHEIM_ADESA',
      label: 'Manheim / ADESA',
      country: 'US',
      currency: 'USD',
      sourceEnum: null,
      fabColor: '#1a5f8a',
      panelColor: '#1a5f8a',
      accentHover: '#154a6e',
    },
  };

  function getSourceByHost(hostname) {
    const h = String(hostname).replace(/^www\./, '').toLowerCase();
    if (h === 'ca.iaai.com' || h.endsWith('.ca.iaai.com')) return SOURCES.IAAI_CA;
    if (h.endsWith('copart.ca')) return SOURCES.COPART_CA;
    if (h === 'manheim-adesa.com' || h.endsWith('.manheim-adesa.com')) {
      return SOURCES.MANHEIM_ADESA;
    }
    // Progi: produkcyjnie często autoauction.*; .progi.ca / .progi.com
    if (
      h === 'progi.com' ||
      h.endsWith('.progi.com') ||
      h === 'autoauction.progi.com' ||
      h.endsWith('.autoauction.progi.com') ||
      h === 'progi.ca' ||
      h.endsWith('.progi.ca')
    ) {
      return SOURCES.PROGI_CA;
    }
    if (h.includes('iaai.com')) return SOURCES.IAAI_US;
    if (h.includes('copart.com') && !h.includes('copart.ca')) return SOURCES.COPART_US;
    return null;
  }

  root.FrikAuctionSources = {
    SOURCES,
    getSourceByHost,
    parseLocation,
    KM_PER_MI,
  };
})(typeof self !== 'undefined' ? self : this);
