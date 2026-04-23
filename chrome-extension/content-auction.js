/* content-auction.js
 * Strony aukcji (IAAI, Copart, Progi) — deal z URL, panel tworzenia oferty Bitrix24.
 */
(function frikAuction() {
  'use strict';

  // ── Capture deal params from URL (happens once per hard navigation) ──
  (function captureDealParams() {
    const p = new URLSearchParams(location.search);
    const dealId = p.get('bx_deal_id');
    const domain = p.get('bx_domain');
    if (dealId) {
      chrome.storage.local.set({ frik_deal_id: dealId, frik_domain: domain || '' });
    }
  })();

  if (typeof FrikAuctionSources === 'undefined') { return; }
  const HOST   = location.hostname.replace(/^www\./, '');
  const sourceConfig = FrikAuctionSources.getSourceByHost(HOST);
  if (!sourceConfig) return;
  try { console.info('[MrFrik] content-auction', '1.2.0'); } catch (_) {}
  const ACCENT      = sourceConfig.fabColor;
  const ACCENT_DARK = sourceConfig.accentHover;

  // ── Is this a vehicle detail page? ──────────────────────────────
  function isDetailPage() {
    const path = location.pathname.toLowerCase();
    if (sourceConfig.id === 'IAAI_US' || sourceConfig.id === 'IAAI_CA') {
      // US: /VehicleDetail/…, /vehicledetails/… ; CA: /vehicle-details/… (Angular bywa wolny — też href)
      const href = (location.href || '').toLowerCase();
      return /\/vehicle[-_]?details?\//i.test(path)
        || path.includes('/vehicledetail/')
        || /\/vehicle[-_]?details?\//i.test(href)
        || /\/vehicledetail\//i.test(href);
    }
    if (sourceConfig.id === 'COPART_US' || sourceConfig.id === 'COPART_CA') {
      const hash = (location.hash || '').toLowerCase();
      const href = (location.href || '').toLowerCase();
      // SPA / locale: czasem numer lotu tylko w hash; ścieżka musi zawierać /lot/ + cyfry
      if (/\/lot\/\d/.test(path) || /\/lot\/\d/.test(hash) || /\/lot\/\d/.test(href)) return true;
      if (path.includes('/lot/') && /\d/.test(path.split('/lot/')[1] || '')) return true;
      if (/\/lotdetails?\/\d/i.test(path) || /\/lotdetails?\/\d/i.test(hash)) return true;
      return false;
    }
    if (sourceConfig.id === 'PROGI_CA') {
      if (path.includes('/search') || path === '/' || /\/(login|signin)/.test(path)) return false;
      return /(vehicle|lot|inventory|item|detail|listing|auction|sale)/.test(path) && !path.endsWith('/search');
    }
    return false;
  }

  // ── Extract vehicle data from DOM text ───────────────────────────
  function labelValFrom(text, label) {
    const m = text.match(new RegExp(label + '[:\\s]+([^\\n\\r]{1,120})', 'i'));
    return m ? m[1].trim() : null;
  }

  function parseOdometer(text) {
    const odoKmM = text.match(/Odometer[:\s]*([\d,]+)\s*km/i)
      || (sourceConfig.country === 'CA' ? text.match(/([\d,]+)\s*km/i) : null);
    const odoMiM = text.match(/Odometer[:\s]*([\d,]+)\s*mi/i)
      || (sourceConfig.country === 'US'
        ? (text.match(/Mileage[:\s]*([\d,]+)(?![^\n]*km)/i) || text.match(/Mileage[:\s]*([\d,]+)/i))
        : text.match(/Mileage[:\s]*([\d,]+)\s*mi/i));
    let odometerKm = odoKmM ? parseInt(odoKmM[1].replace(/,/g, ''), 10) : null;
    let odometerMi = odoMiM ? parseInt(odoMiM[1].replace(/,/g, ''), 10) : null;
    if (odometerKm && !odometerMi) odometerMi = Math.round(odometerKm / 1.609344);
    if (odometerMi && !odometerKm && odoKmM === null && sourceConfig.country === 'CA') {
      odometerKm = Math.round(odometerMi * 1.609344);
    }
    const odometer = odometerMi;
    return { odometerKm, odometerMi, odometer };
  }

  function firstUrlFromSrcset(attr) {
    if (!attr || typeof attr !== 'string') return null;
    const part = attr.split(',')[0].trim();
    if (!part) return null;
    const u = part.split(/\s+/)[0];
    return /^https?:\/\//i.test(u) ? u : null;
  }

  function imageUrlFromImg(img) {
    if (!img || img.tagName !== 'IMG') return null;
    const lazy = img.getAttribute('data-src')
      || img.getAttribute('data-lazy-src')
      || img.getAttribute('data-original')
      || img.getAttribute('data-defer-src')
      || img.getAttribute('data-url');
    if (lazy) {
      const t = lazy.trim().split(/[\s,]/)[0];
      if (/^https?:\/\//i.test(t)) return t;
    }
    const fromDataSet = firstUrlFromSrcset(img.getAttribute('data-srcset') || img.getAttribute('data-lazy-srcset') || '');
    if (fromDataSet) return fromDataSet;
    if (img.currentSrc && /^https?:\/\//i.test(img.currentSrc)) return img.currentSrc;
    const fromSet = firstUrlFromSrcset(img.getAttribute('srcset') || '');
    if (fromSet) return fromSet;
    if (img.src && /^https?:\/\//i.test(img.src)) return img.src;
    return null;
  }

  function imageUrlFromSource(el) {
    if (!el || el.tagName !== 'SOURCE') return null;
    return firstUrlFromSrcset(el.getAttribute('srcset') || '');
  }

  /** querySelectorAll + otwarte ShadowRoot (Angular / Copart). */
  function queryAllDeep(root, selector) {
    const results = [];
    const seen = new Set();
    function visit(r) {
      if (!r || !r.querySelectorAll) return;
      try {
        r.querySelectorAll(selector).forEach(el => {
          if (!seen.has(el)) {
            seen.add(el);
            results.push(el);
          }
        });
        r.querySelectorAll('*').forEach(node => {
          if (node.shadowRoot) visit(node.shadowRoot);
        });
      } catch (_) { /* np. zamknięty shadow */ }
    }
    visit(root || document);
    return results;
  }

  /** Wszystkie sensowne URL-e z <img> (kolejność od „najbardziej jawnego” src). */
  function allImageUrlsFromImg(img) {
    if (!img || img.tagName !== 'IMG') return [];
    const out = [];
    const push = function (u) {
      if (!u || typeof u !== 'string') return;
      const t = u.trim().split(/[\s,]/)[0];
      if (!/^https?:\/\//i.test(t)) return;
      const clean = t.split('#')[0];
      if (out.indexOf(clean) === -1) out.push(clean);
    };
    if (img.src) push(img.src);
    if (img.currentSrc) push(img.currentSrc);
    ['srcset', 'data-srcset', 'data-lazy-srcset'].forEach(function (a) {
      const u = firstUrlFromSrcset(img.getAttribute(a) || '');
      if (u) push(u);
    });
    ['data-src', 'data-lazy-src', 'data-original', 'data-defer-src', 'data-url'].forEach(function (a) {
      const v = img.getAttribute(a);
      if (v) push(v);
    });
    return out;
  }

  const RE_COPART_CDN = /cs\.copart\.com|g2\.copart\.com|cf-\d+\.copart\.com|lotimages?\.copart|\/lotimage\/|ids-c-prod|ids-n-prod|pdoc|csx-images|vehicleimg|getimage|image-services|wssimg/i;

  function isCopartJunkUrl(u) {
    const sl = String(u).toLowerCase();
    if (/\.svg(\?|#|$|&)/i.test(sl)) return true;
    if (/\/content\//i.test(sl) && /copart\.(com|ca)/i.test(sl)) return true;
    return false;
  }

  /** Copart: wybierz URL z CDN, nie placeholder z data-src (/content/). */
  function pickBestCopartImgUrl(img) {
    const candidates = allImageUrlsFromImg(img);
    let i;
    for (i = 0; i < candidates.length; i++) {
      const u = candidates[i];
      const sl = u.toLowerCase();
      if (isCopartJunkUrl(u)) continue;
      if (!/\.(jpe?g|webp|png)(\?|&|$|#)/i.test(sl)) continue;
      if (RE_COPART_CDN.test(sl)) return u;
    }
    for (i = 0; i < candidates.length; i++) {
      const u = candidates[i];
      const sl = u.toLowerCase();
      if (isCopartJunkUrl(u)) continue;
      if (!/\.(jpe?g|webp|png)(\?|&|$|#)/i.test(sl)) continue;
      if (/copart\.(com|ca)/i.test(sl)) return u;
    }
    return null;
  }

  /** IAAI: numer stocku / inventory z URL (np. vehicle-details/2952589, VehicleDetail/45184893~US). */
  function iaaiStockIdFromLocation() {
    const href = location.href || '';
    const m = href.match(/\/vehicle[-_]?details?\/(\d+)/i)
      || href.match(/\/vehicledetail\/(\d+)/i);
    return m ? m[1] : null;
  }

  function iaaiResizerFromImageKey(key) {
    if (!key || typeof key !== 'string') return null;
    const k = key.trim();
    if (!k) return null;
    const enc = encodeURIComponent(k).replace(/%7E/gi, '~');
    return 'https://vis.iaai.com/resizer?imageKeys=' + enc + '&width=1200&height=900';
  }

  function parseDimensionsAllImageKeysAttr(raw) {
    if (!raw || typeof raw !== 'string') return [];
    try {
      const arr = JSON.parse(raw.replace(/&quot;/g, '"').trim());
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function iaaiImageKeysMatchStock(url, stockId) {
    if (!stockId) return true;
    const sid = String(stockId).toUpperCase();
    const prefix = sid + '~';
    try {
      const sp = new URL(url).searchParams;
      const raw = sp.get('imageKeys') || sp.get('imagekeys');
      if (!raw) return false;
      const dec = decodeURIComponent(String(raw).replace(/\+/g, ' '));
      return dec.toUpperCase().startsWith(prefix);
    } catch (_) {
      const m = String(url).match(/[?&]imagekeys?=([^&#]+)/i);
      if (!m) return false;
      try {
        const dec = decodeURIComponent(m[1]);
        return dec.toUpperCase().startsWith(prefix);
      } catch (_) {
        return false;
      }
    }
  }

  /** Z atrybutów dimensionsAllImageKeys / dimensionsimagekey — tylko klucze zgodne ze stockiem z URL. */
  function collectIaaiStructuredImages(stockId) {
    const out = [];
    const seen = new Set();
    const normStock = stockId ? String(stockId).trim() : '';

    function keyMatchesStock(k) {
      if (!normStock) return true;
      return String(k).toUpperCase().startsWith(normStock.toUpperCase() + '~');
    }

    function pushKey(k) {
      if (!k || !keyMatchesStock(k)) return;
      const u = iaaiResizerFromImageKey(k);
      if (!u || seen.has(u)) return;
      seen.add(u);
      out.push(u);
    }

    if (normStock) {
      queryAllDeep(document, '[dimensionsAllImageKeys], [dimensionsallimagekeys]').forEach(el => {
        const raw = el.getAttribute('dimensionsAllImageKeys') || el.getAttribute('dimensionsallimagekeys');
        parseDimensionsAllImageKeysAttr(raw).forEach(row => {
          const k = row && (row.k || row.K);
          if (k) pushKey(k);
        });
      });
    }

    const fv = document.getElementById('fullViewImg')
      || queryAllDeep(document, 'img[dimensionsimagekey], img[dimensionsImageKey]')[0]
      || document.querySelector('img[dimensionsimagekey], img[dimensionsImageKey]');
    if (fv) {
      const rawFv = fv.getAttribute('dimensionsAllImageKeys') || fv.getAttribute('dimensionsallimagekeys');
      if (rawFv) {
        parseDimensionsAllImageKeysAttr(rawFv).forEach(row => {
          const k = row && (row.k || row.K);
          if (k && keyMatchesStock(k)) pushKey(k);
        });
      }
      const k0 = fv.getAttribute('dimensionsimagekey') || fv.getAttribute('dimensionsImageKey');
      if (k0 && keyMatchesStock(k0)) pushKey(k0);
    }

    return out;
  }

  function isRelevantAuctionImageUrl(url, sc) {
    const s = String(url).split('#')[0];
    const sl = s.toLowerCase();
    if (!/^https:/i.test(s) || /data:/i.test(sl)) return false;
    if (/\.svg(\?|#|$|&)/i.test(sl)) return false;
    if (/logo|icon|sprite|favicon|placeholder|avatar|badge|banner|pixel|spacer|thumb-nav|nav-|social|payment|card-/.test(sl)) {
      return false;
    }
    try {
      const uu = new URL(s);
      const host0 = uu.hostname.replace(/^www\./i, '').toLowerCase();
      if ((host0 === 'copart.com' || host0 === 'copart.ca') && /\/content\//i.test(uu.pathname + uu.search)) {
        return false;
      }
    } catch (_) {}

    const looksFile = /\.(jpe?g|webp|png)(\?|&|$|#)/i.test(sl);
    const looksPath = /\/(image|img|media|photo|vehicle|lot|picture|lotimage|webi)\b/i.test(sl);
    const looksIaaiResizer = /vis\.iaai\.com\/resizer/i.test(sl) && /[?&]imagekeys?=/i.test(sl);
    const looksCopartLot = RE_COPART_CDN.test(sl);

    if (!looksFile && !looksPath && !looksIaaiResizer && !looksCopartLot) return false;

    try {
      const h = new URL(s).hostname.toLowerCase().replace(/^www\./, '');
      const page = location.hostname.toLowerCase().replace(/^www\./, '');
      const sameHost = h === page || h.endsWith('.' + page) || page.endsWith('.' + h);
      if (sameHost) {
        if (sc.id && String(sc.id).startsWith('COPART') && /\/content\//i.test(sl)) return false;
        if (looksIaaiResizer) return true;
        if (looksFile) return true;
        if (looksCopartLot && !/\/content\//i.test(sl)) return true;
        if (looksCopartLot && /\.(jpe?g|webp|png)(\?|&|$)/i.test(sl)) return true;
        return false;
      }
    } catch (_) {}
    if (sc.id && String(sc.id).startsWith('IAAI')) {
      if (looksIaaiResizer) return true;
      return /iaai|csx-|cs\.|vis\.|cache|akamai|cloudfront|azure|fastly|edge|image/i.test(sl);
    }
    if (sc.id && String(sc.id).startsWith('COPART')) {
      if (/\/content\//i.test(sl)) return false;
      return /copart|g2|cf-|csx|cdn|akamai|cloudfront|azure|fastly|edge|lotimage|img\.|eservices\.copart/i.test(sl);
    }
    return /iaai|copart|progi|cdn|images|cloudfront|azureedge/i.test(sl);
  }

  /** Zdjęcia lotu z CDN Copart (cs., g2., lotimage…) — przed ogólnym skanem img. */
  function collectCopartCdnImages() {
    const out = [];
    const seen = new Set();
    const sel = [
      'picture source[srcset]',
      'img[data-src]',
      'img[data-lazy-src]',
      'img[data-original]',
      'img[srcset]',
      'img[src]',
      '#zoomImgElement',
      'img.zoomImgElement',
    ];
    const els = [];
    sel.forEach(function (q) {
      queryAllDeep(document, q).forEach(function (el) { els.push(el); });
    });
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      let u = null;
      if (el.tagName === 'IMG') u = pickBestCopartImgUrl(el) || imageUrlFromImg(el);
      else if (el.tagName === 'SOURCE') u = imageUrlFromSource(el);
      if (!u) continue;
      u = u.split('#')[0];
      const sl = u.toLowerCase();
      if (isCopartJunkUrl(u)) continue;
      if (!/\.(jpe?g|webp|png)(\?|&|$|#)/i.test(sl)) continue;
      if (!RE_COPART_CDN.test(sl)) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
      if (out.length >= 14) break;
    }
    return out;
  }

  function collectStandardVehicleImages() {
    const out = [];
    const seen = new Set();
    const isIAAI = sourceConfig.id === 'IAAI_US' || sourceConfig.id === 'IAAI_CA';
    const isCopart = sourceConfig.id === 'COPART_US' || sourceConfig.id === 'COPART_CA';
    const stockId = isIAAI ? iaaiStockIdFromLocation() : null;

    if (isCopart) {
      collectCopartCdnImages().forEach(u => {
        if (seen.has(u)) return;
        seen.add(u);
        out.push(u);
      });
    }

    if (isIAAI) {
      collectIaaiStructuredImages(stockId).forEach(u => {
        if (seen.has(u)) return;
        seen.add(u);
        out.push(u);
      });
    }

    const sel = [
      'picture source[srcset]',
      'img[data-src]',
      'img[data-lazy-src]',
      'img[data-original]',
      'img[srcset]',
      'img[src]',
      '#zoomImgElement',
      'img.zoomImgElement',
    ];
    const els = [];
    sel.forEach(function (q) {
      queryAllDeep(document, q).forEach(function (el) { els.push(el); });
    });
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      let u = null;
      if (el.tagName === 'IMG') {
        u = isCopart ? (pickBestCopartImgUrl(el) || imageUrlFromImg(el)) : imageUrlFromImg(el);
      } else if (el.tagName === 'SOURCE') {
        u = imageUrlFromSource(el);
      }
      if (!u) continue;
      u = u.split('#')[0];
      if (isIAAI && stockId && /vis\.iaai\.com\/resizer/i.test(u)) {
        if (!iaaiImageKeysMatchStock(u, stockId)) continue;
      }
      if (!isRelevantAuctionImageUrl(u, sourceConfig)) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
      if (out.length >= 12) break;
    }
    return out.slice(0, 10);
  }

  function extractStandard() {
    const text = document.body ? document.body.innerText : '';
    const isIAAI = sourceConfig.id === 'IAAI_US' || sourceConfig.id === 'IAAI_CA';

    const vinM = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    const vin  = vinM ? vinM[1] : null;

    const titleEl = document.querySelector(
      'h1, [class*="vehicle-title"], [class*="vdp-title"], [class*="lot-title"], [data-testid*="title"]',
    );
    const vehicleTitle = titleEl ? titleEl.textContent.trim().substring(0, 120) : null;

    let year = null, make = null, model = null;
    if (vehicleTitle) {
      const m = vehicleTitle.match(/^(\d{4})\s+([A-Za-z\-]+)\s+(.+)/);
      if (m) {
        year  = parseInt(m[1], 10);
        make  = m[2];
        model = m[3].replace(/\s*[|#].*$/, '').trim();
      }
    }

    const lotFromUrl = isIAAI
      ? (() => {
        const id = iaaiStockIdFromLocation();
        return id ? [null, id] : null;
      })()
      : location.href.match(/\/lot\/(\d+)/i);
    const lotFromText = text.match(/\bLot[:\s#]*(\d{5,10})\b/i);
    const lotNumber   = lotFromUrl ? lotFromUrl[1] : (lotFromText ? lotFromText[1] : null);

    const primaryDamage   = labelValFrom(text, 'Primary Damage')   || labelValFrom(text, 'Primary');
    const secondaryDamage = labelValFrom(text, 'Secondary Damage') || labelValFrom(text, 'Secondary');
    const odo = parseOdometer(text);
    const rdM = text.match(/Run\s*(?:&|and|\/)\s*Drive[:\s]*(Yes|No|[A-Za-z ]{2,25})/i);
    const runDrive = rdM ? rdM[1].trim() : null;
    const sdM = text.match(/Sale Date[:\s]+([^\n]{4,40})/i)
      || text.match(/Auction Date[:\s]+([^\n]{4,40})/i);
    const saleDate = sdM ? sdM[1].trim() : null;
    const locM = text.match(/Location[:\s]+([^\n]{3,100})/i) || text.match(/Yard[:\s]+([^\n]{3,100})/i);
    const vehicleLocation = locM ? locM[1].trim() : null;
    const locMeta = FrikAuctionSources.parseLocation(vehicleLocation || '', sourceConfig);

    const evM = text.match(/Estimated.*?Value[:\s]*\$?([\d,]+)/i)
      || text.match(/Actual Cash.*?Value[:\s]*\$?([\d,]+)/i);
    const estimatedValue = evM ? parseInt(evM[1].replace(/,/g, ''), 10) : null;

    const images = collectStandardVehicleImages();

    const cleanUrl = location.href.split('?')[0];
    return {
      vin, vehicleTitle, year, make, model, lotNumber,
      primaryDamage, secondaryDamage,
      odometerKm: odo.odometerKm, odometerMi: odo.odometerMi, odometer: odo.odometer,
      runDrive, saleDate, location: vehicleLocation, locationMeta: locMeta,
      estimatedValue, images, auctionUrl: cleanUrl, source: sourceConfig.label,
      currency: sourceConfig.currency,
    };
  }

  function extractProgi() {
    const text = document.body ? document.body.innerText : '';
    const vinM = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    const vin  = vinM ? vinM[1] : null;
    const titleEl = document.querySelector('h1, h2, [class*="title"], [class*="vehicle"]');
    const vehicleTitle = titleEl ? titleEl.textContent.trim().substring(0, 120) : null;
    let year = null, make = null, model = null;
    if (vehicleTitle) {
      const m = vehicleTitle.match(/^(\d{4})\s+([A-Za-z\-]+)\s+(.+)/);
      if (m) {
        year  = parseInt(m[1], 10);
        make  = m[2];
        model = m[3].replace(/\s*[|#].*$/, '').trim();
      }
    }
    const lotFromUrl  = location.href.match(/[/-]([0-9]{4,8})(?:[/?#]|$)/);
    const lotFromText = text.match(/\b(Lot|Lotu|#)[:\s#]*([0-9]{4,8})\b/i);
    const lotNumber   = (lotFromUrl && lotFromUrl[1] !== location.hostname)
      ? lotFromUrl[1] : (lotFromText ? lotFromText[2] : null);
    const primaryDamage   = labelValFrom(text, 'Primary Damage')   || labelValFrom(text, 'Uszkodzenie');
    const secondaryDamage = labelValFrom(text, 'Secondary Damage') || labelValFrom(text, 'Dodatkowe');
    const odo = parseOdometer(text);
    const runDrive = (text.match(/Run(?:s)?\s*(?:&|and|\/)\s*Drive[:\s]*([^\n]+)/i) || [null, null])[1];
    const saleDate = (text.match(/Sale[:\s]+([^\n]{3,50})/i) || [null, null])[1];
    const locM = text.match(/Location[:\s]+([^\n]{3,100})/i) || text.match(/Lokalizacja[:\s]+([^\n]{3,100})/i);
    const vehicleLocation = locM ? locM[1].trim() : null;
    const locMeta = FrikAuctionSources.parseLocation(vehicleLocation || '', sourceConfig);
    const evM = text.match(/(?:Value|Warto|Price)[:\s]*\$?([\d,]+)/i);
    const estimatedValue = evM ? parseInt(evM[1].replace(/,/g, ''), 10) : null;
    const images = Array.from(document.querySelectorAll('img[src]'))
      .map(i => i.src)
      .filter(s => /progi|cdn|images/i.test(s) && !/logo|icon|pixel/i.test(s))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 10);
    return {
      vin, vehicleTitle, year, make, model, lotNumber,
      primaryDamage, secondaryDamage,
      odometerKm: odo.odometerKm, odometerMi: odo.odometerMi, odometer: odo.odometer,
      runDrive, saleDate, location: vehicleLocation, locationMeta: locMeta,
      estimatedValue, images, auctionUrl: location.href.split('?')[0], source: sourceConfig.label,
      currency: sourceConfig.currency,
    };
  }

  function extractData() {
    if (sourceConfig.id === 'PROGI_CA') return extractProgi();
    return extractStandard();
  }

  // ── Build COMMENTS field ─────────────────────────────────────────
  function odometerLine(d) {
    if (d.odometerKm && d.odometerMi) {
      return `Przebieg: ${d.odometerKm.toLocaleString('pl')} km (≈ ${d.odometerMi.toLocaleString('pl')} mil)`;
    }
    if (d.odometerKm) return `Przebieg: ${d.odometerKm.toLocaleString('pl')} km`;
    if (d.odometerMi) return `Przebieg: ${d.odometerMi.toLocaleString('pl')} mil`;
    if (d.odometer)   return `Przebieg: ${d.odometer.toLocaleString('pl')} mil`;
    return null;
  }

  function buildComments(d) {
    const cur = d.currency || 'USD';
    const valLbl = cur === 'CAD' ? 'CAD' : 'USD';
    const lines = [
      `=== Dane pojazdu z ${d.source} ===`,
      d.vin         ? `VIN: ${d.vin}`                             : null,
      d.lotNumber   ? `Lot: ${d.lotNumber}`                       : null,
      '',
      d.year        ? `Rok: ${d.year}`                            : null,
      d.make        ? `Marka: ${d.make}`                          : null,
      d.model       ? `Model: ${d.model}`                         : null,
      odometerLine(d),
      '',
      d.primaryDamage   ? `Uszkodzenie główne: ${d.primaryDamage}`      : null,
      d.secondaryDamage ? `Uszkodzenie dodatkowe: ${d.secondaryDamage}` : null,
      d.runDrive    ? `Czy jeździ: ${d.runDrive}`                 : null,
      '',
      d.location    ? `Lokalizacja: ${d.location}`                : null,
      d.locationMeta && d.locationMeta.country
        ? `Kraj (kod): ${d.locationMeta.country}` : null,
      d.locationMeta && d.locationMeta.region
        ? `Region: ${d.locationMeta.region}` : null,
      d.locationMeta && d.locationMeta.taxRegime
        ? `Reżim podatkowy: ${d.locationMeta.taxRegime}` : null,
      d.saleDate    ? `Data licytacji: ${d.saleDate}`             : null,
      d.estimatedValue
        ? `Szacowana wartość: $${d.estimatedValue.toLocaleString('en')} ${valLbl}` : null,
      '',
      d.auctionUrl  ? `Link aukcji: ${d.auctionUrl}`              : null,
      '',
      d.images && d.images.length
        ? `Zdjęcia:\n${d.images.join('\n')}`
        : null,
    ].filter(x => x !== null);
    return lines.join('\n');
  }

  async function getWebhookBase() {
    const { frik_webhook: u } = await chrome.storage.local.get('frik_webhook');
    if (!u || typeof u !== 'string' || !u.trim()) {
      throw new Error('Brak URL webhooka — otwórz menu wtyczki i zapisz pełny adres rest Bitrix24.');
    }
    return u.replace(/\/+$/, '');
  }

  function portalHostFromWebhookBase(base) {
    try {
      return new URL(/^https?:\/\//i.test(base) ? base : 'https://' + base).hostname;
    } catch (_) {
      return 'mrfrik.bitrix24.pl';
    }
  }

  // ── Add photos as timeline comment (non-blocking) ─────────────────
  async function addPhotosComment(quoteId, images, whBase) {
    if (!images || !images.length) return;
    const imgs = images.slice(0, 10)
      .map(u => `<img src="${u}" style="max-width:220px;margin:3px;border-radius:4px;display:inline-block">`)
      .join('');
    await fetch(whBase + '/crm.timeline.comment.add.json', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        fields: {
          ENTITY_ID:   quoteId,
          ENTITY_TYPE: 'quote',
          COMMENT:     `<p><strong>Zdjęcia pojazdu (${images.length} szt.):</strong></p>${imgs}`,
        },
      }),
    });
  }

  // ── Load recent deals with client names ──────────────────────────
  async function loadDeals(forceRefresh) {
    if (!forceRefresh) {
      const cache = await new Promise(r =>
        chrome.storage.local.get(['frik_deals_cache', 'frik_deals_ts'], r)
      );
      if (cache.frik_deals_cache && (Date.now() - (cache.frik_deals_ts || 0)) < 300000) {
        return cache.frik_deals_cache;
      }
    }
    const wh = await getWebhookBase();

    const resp = await fetch(wh + '/crm.deal.list.json', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        order:  { DATE_MODIFY: 'DESC' },
        select: ['ID', 'TITLE', 'CONTACT_ID', 'COMPANY_ID'],
        start:  0,
      }),
    });
    const dealText = await resp.text();
    let dealJson;
    try {
      dealJson = JSON.parse(dealText);
    } catch (_) {
      throw new Error(!resp.ok ? `HTTP ${resp.status}` : 'Niepoprawna odpowiedź Bitrix (deal.list)');
    }
    if (!resp.ok) {
      throw new Error(dealJson.error_description || dealJson.error || `HTTP ${resp.status}`);
    }
    if (dealJson.error) throw new Error(dealJson.error_description || dealJson.error);

    const deals = dealJson.result || [];

    // Batch-fetch contact and company names
    const contactIds = [...new Set(deals.map(d => d.CONTACT_ID).filter(Boolean))].slice(0, 25);
    const companyIds = [...new Set(deals.map(d => d.COMPANY_ID).filter(Boolean))].slice(0, 25);
    const batchCmds  = {};
    contactIds.forEach((id, i) => {
      batchCmds[`c${i}`] = `crm.contact.get?id=${id}&select[]=ID&select[]=NAME&select[]=LAST_NAME`;
    });
    companyIds.forEach((id, i) => {
      batchCmds[`co${i}`] = `crm.company.get?id=${id}&select[]=ID&select[]=TITLE`;
    });

    const contactMap = {};
    const companyMap = {};
    if (Object.keys(batchCmds).length > 0) {
      try {
        const bResp = await fetch(wh + '/batch.json', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ halt: 0, cmd: batchCmds }),
        });
        const bJson = await bResp.json();
        const res   = (bJson.result && bJson.result.result) || {};
        contactIds.forEach((id, i) => {
          const c = res[`c${i}`];
          if (c) contactMap[String(id)] = [c.NAME, c.LAST_NAME].filter(Boolean).join(' ');
        });
        companyIds.forEach((id, i) => {
          const co = res[`co${i}`];
          if (co) companyMap[String(id)] = co.TITLE;
        });
      } catch (_) { /* name lookup failed — degraded gracefully */ }
    }

    const result = deals.map(d => ({
      id:        String(d.ID),
      title:     d.TITLE || ('Deal #' + d.ID),
      contactId: d.CONTACT_ID || null,
      companyId: d.COMPANY_ID || null,
      clientName: companyMap[String(d.COMPANY_ID)] || contactMap[String(d.CONTACT_ID)] || '',
    }));

    chrome.storage.local.set({ frik_deals_cache: result, frik_deals_ts: Date.now() });
    return result;
  }

  // ── Create Quote via Bitrix24 webhook ────────────────────────────
  async function createQuote(data, dealId, poziomEnumId, contactId, companyId) {
    const wh = await getWebhookBase();
    const title = data.vehicleTitle
      || [data.year, data.make, data.model].filter(Boolean).join(' ')
      || 'Auto z aukcji';

    const cur = data.currency || 'USD';

    const fields = {
      DEAL_ID:     parseInt(dealId, 10),
      TITLE:       title,
      COMMENTS:    buildComments(data),
      STATUS_ID:   'D',
      CURRENCY_ID: cur,
    };

    if (contactId) fields.CONTACT_ID = parseInt(contactId, 10);
    if (companyId) fields.COMPANY_ID = parseInt(companyId, 10);

    // Szacunkowa wartość — tylko standardowe pole Bitrix (UF z innego portalu = HTTP 400).
    if (data.estimatedValue) {
      fields.OPPORTUNITY = data.estimatedValue;
    }

    // Kraj / region / VIN / lot są w COMMENTS (buildComments) — nie wysyłamy sztywnych UF_CRM_*
    // z obcej instancji; pole „Poziom dopasowania” tylko jeśli znaleziono po XML_ID w portalu.
    if (poziomEnumId && cachedFieldName) {
      fields[cachedFieldName] = poziomEnumId;
    }

    const endpoint = wh + '/crm.quote.add.json';
    const resp = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields }),
    });

    const raw = await resp.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch (_) {
      throw new Error(!resp.ok ? `HTTP ${resp.status}: ${raw.slice(0, 160)}` : 'Niepoprawna odpowiedź Bitrix');
    }
    if (!resp.ok) {
      throw new Error(json.error_description || json.error || `HTTP ${resp.status}`);
    }
    if (json.error) throw new Error(json.error_description || json.error);

    const quoteId = json.result;
    if (data.images && data.images.length > 0) {
      addPhotosComment(quoteId, data.images, wh).catch(() => {});
    }
    return quoteId;
  }

  // ── Poziom dopasowania — dynamic lookup & cache ──────────────────
  let cachedFieldName = null;
  let cachedLevelItems = []; // [{ id, value }]

  async function loadLevelItems() {
    if (cachedLevelItems.length > 0) return;

    // Try extension storage cache first
    const stored = await new Promise(r =>
      chrome.storage.local.get(['frik_poziom_field', 'frik_poziom_items'], r)
    );
    if (stored.frik_poziom_field && stored.frik_poziom_items && stored.frik_poziom_items.length) {
      cachedFieldName  = stored.frik_poziom_field;
      cachedLevelItems = stored.frik_poziom_items;
      return;
    }

    try {
      const wh = await getWebhookBase();
      const resp = await fetch(wh + '/crm.quote.userfield.list.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: { XML_ID: 'FRIK_POZIOM_DOPASOWANIA' } }),
      });
      const json = await resp.json();
      if (json.result && json.result.length > 0) {
        const field = json.result[0];
        cachedFieldName  = field.FIELD_NAME;
        cachedLevelItems = (field.LIST || []).map(i => ({
          id: parseInt(i.ID, 10), value: i.VALUE,
        }));
        chrome.storage.local.set({
          frik_poziom_field: cachedFieldName,
          frik_poziom_items: cachedLevelItems,
        });
      }
    } catch (_) { /* brak webhooka / pole niegotowe */ }
  }

  // ── Floating action button + panel ────────────────────────────────
  const PANEL_ID = 'frik-panel';
  const FAB_ID   = 'frik-fab';

  function removePanel() {
    const el = document.getElementById(PANEL_ID);
    if (el) el.remove();
    // Restore FAB icon
    const fab = document.getElementById(FAB_ID);
    if (fab) fab.innerHTML = FAB_ICON;
  }

  function removeFab() {
    removePanel();
    const el = document.getElementById(FAB_ID);
    if (el) el.remove();
  }

  function togglePanel() {
    if (document.getElementById(PANEL_ID)) { removePanel(); return; }
    injectPanel();
  }

  // SVG Bitrix24-style "B" icon
  const FAB_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M6 4h7.5a3.5 3.5 0 010 7H6V4z" fill="white"/>
    <path d="M6 11h8.5a3.5 3.5 0 010 7H6v-7z" fill="white"/>
  </svg>`;

  function injectFab() {
    if (!document.body) return;
    if (document.getElementById(FAB_ID)) return;
    const fab = document.createElement('button');
    fab.id    = FAB_ID;
    fab.title = 'MrFrik — Utwórz ofertę w Bitrix24';
    fab.innerHTML = FAB_ICON;
    fab.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
      'width:54px', 'height:54px', 'border-radius:50%',
      'background:' + ACCENT, 'border:none', 'cursor:pointer',
      'box-shadow:0 4px 18px rgba(0,0,0,.32)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'transition:transform .15s,box-shadow .15s',
      'padding:0',
    ].join(';');
    fab.addEventListener('mouseenter', () => {
      fab.style.transform = 'scale(1.10)';
      fab.style.boxShadow = '0 6px 24px rgba(0,0,0,.40)';
    });
    fab.addEventListener('mouseleave', () => {
      fab.style.transform = '';
      fab.style.boxShadow = '0 4px 18px rgba(0,0,0,.32)';
    });
    fab.addEventListener('click', togglePanel);
    document.body.appendChild(fab);
  }

  async function injectPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const stored = await new Promise(r => chrome.storage.local.get('frik_deal_id', r));
    await loadLevelItems();

    const hasLevel = cachedLevelItems.length > 0;
    const levelOpts = hasLevel
      ? '<option value="">— wybierz —</option>' +
        cachedLevelItems.map(i =>
          `<option value="${i.id}">${i.value}</option>`
        ).join('')
      : '';

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = [
      'position:fixed', 'bottom:84px', 'right:20px', 'z-index:2147483647',
      'width:300px', 'background:#fff', 'border-radius:10px',
      'box-shadow:0 8px 28px rgba(0,0,0,.22)', 'overflow:hidden',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'font-size:13px',
    ].join(';');

    panel.innerHTML = `
      <div id="frik-hdr" style="background:${ACCENT};color:#fff;padding:10px 14px;
           display:flex;align-items:center;justify-content:space-between;
           cursor:move;user-select:none">
        <span style="font-weight:700">&#128661; MrFrik — Utwórz ofertę</span>
        <button id="frik-x" title="Zamknij"
          style="background:none;border:none;color:#fff;font-size:20px;
                 cursor:pointer;padding:0 0 0 10px;line-height:1">×</button>
      </div>
      <div style="padding:12px 14px">

        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <span style="font-size:11px;font-weight:600;color:#666;
                         text-transform:uppercase;letter-spacing:.4px">Deal — Klient</span>
            <button id="frik-deal-refresh" title="Odśwież listę"
              style="background:none;border:1px solid #d0d7de;border-radius:4px;
                     cursor:pointer;font-size:12px;padding:2px 7px;color:#555;
                     font-family:inherit;line-height:1.5">⟳ Odśwież</button>
          </div>
          <select id="frik-deal-sel"
            style="width:100%;border:1px solid #d0d7de;border-radius:5px;
                   padding:6px 8px;font-size:12px;font-family:inherit;
                   outline:none;background:#fff">
            <option value="">⏳ Ładowanie dealów…</option>
          </select>
        </div>

        ${hasLevel ? `
        <div style="margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;color:#666;margin-bottom:4px;
                      text-transform:uppercase;letter-spacing:.4px">Poziom dopasowania</div>
          <select id="frik-level" style="width:100%;border:1px solid #d0d7de;
                  border-radius:5px;padding:6px 9px;font-size:13px;
                  font-family:inherit;outline:none;background:#fff">
            ${levelOpts}
          </select>
        </div>` : ''}

        <button id="frik-create-btn"
          style="width:100%;background:${ACCENT};color:#fff;border:none;
                 border-radius:6px;padding:10px 14px;font-size:13px;font-weight:700;
                 cursor:pointer;font-family:inherit;transition:background .15s">
          Utwórz ofertę w Bitrix24
        </button>
        <div id="frik-status"
          style="margin-top:8px;font-size:12px;display:none;padding:8px 10px;
                 border-radius:5px;line-height:1.5;word-break:break-all"></div>
      </div>`;

    document.body.appendChild(panel);

    // Close
    document.getElementById('frik-x').onclick = removePanel;

    // Draggable header
    makeDraggable(panel, document.getElementById('frik-hdr'));

    // Populate deal select
    async function populateDeals(forceRefresh) {
      const sel = document.getElementById('frik-deal-sel');
      if (!sel) return;
      sel.disabled = true;
      sel.innerHTML = '<option value="">⏳ Ładowanie…</option>';
      try {
        const deals       = await loadDeals(forceRefresh);
        const storedDeal  = await new Promise(r => chrome.storage.local.get('frik_deal_id', r));
        const currentId   = String(storedDeal.frik_deal_id || '');
        sel.innerHTML = '<option value="">— wybierz deal —</option>' +
          deals.map(d => {
            const client  = d.clientName ? ` — ${d.clientName}` : '';
            const label   = `${d.title}${client} (#${d.id})`;
            const sel_    = d.id === currentId ? 'selected' : '';
            return `<option value="${d.id}"
              data-contact-id="${d.contactId || ''}"
              data-company-id="${d.companyId || ''}"
              ${sel_}>${label}</option>`;
          }).join('');
      } catch (err) {
        sel.innerHTML = `<option value="">❌ Błąd: ${err.message.substring(0, 50)}</option>`;
      }
      sel.disabled = false;
    }

    populateDeals(false);
    const refreshBtn = document.getElementById('frik-deal-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => populateDeals(true));

    // Create button
    const createBtn = document.getElementById('frik-create-btn');
    createBtn.addEventListener('mouseenter', () => {
      if (!createBtn.disabled) createBtn.style.background = ACCENT_DARK;
    });
    createBtn.addEventListener('mouseleave', () => {
      if (!createBtn.disabled) createBtn.style.background = ACCENT;
    });

    createBtn.addEventListener('click', async () => {
      if (createBtn.disabled) return;

      const sel        = document.getElementById('frik-deal-sel');
      const dealIdVal  = sel ? sel.value : '';
      if (!dealIdVal) {
        showStatus('Wybierz deal z listy.', 'warn');
        return;
      }
      const selOpt     = sel && sel.selectedOptions[0];
      const selContactId = selOpt ? (selOpt.dataset.contactId || null) : null;
      const selCompanyId = selOpt ? (selOpt.dataset.companyId || null) : null;

      const data = extractData();
      if (!data.vin && !data.vehicleTitle && !data.year) {
        showStatus('Strona jeszcze się ładuje — poczekaj chwilę i spróbuj ponownie.', 'warn');
        return;
      }

      const levelEl = document.getElementById('frik-level');
      const poziomId = levelEl ? (parseInt(levelEl.value) || null) : null;

      createBtn.disabled = true;
      createBtn.style.background = '#888';
      createBtn.textContent = 'Tworzę ofertę…';

      try {
        const quoteId = await createQuote(data, dealIdVal, poziomId, selContactId, selCompanyId);
        createBtn.style.background = '#34b251';
        createBtn.textContent = '✓ Oferta #' + quoteId + ' utworzona!';

        const wh0 = await getWebhookBase();
        const bxH = portalHostFromWebhookBase(wh0);
        const link = `https://${bxH}/crm/quote/show/${quoteId}/`;
        showStatus(
          `<a href="${link}" target="_blank"
             style="color:${ACCENT};font-weight:600">Otwórz ofertę w Bitrix24 →</a>`,
          'ok'
        );

        // Remember this deal for next vehicle
        chrome.storage.local.set({ frik_deal_id: String(dealIdVal) });

        setTimeout(() => {
          createBtn.disabled = false;
          createBtn.style.background = ACCENT;
          createBtn.textContent = 'Utwórz ofertę w Bitrix24';
        }, 8000);
      } catch (err) {
        showStatus('Błąd: ' + err.message, 'error');
        createBtn.disabled = false;
        createBtn.style.background = ACCENT;
        createBtn.textContent = 'Utwórz ofertę w Bitrix24';
      }
    });

    function showStatus(html, type) {
      const colors = {
        ok:    ['#eaf7ec', '#34b251'],
        warn:  ['#fff8e1', '#f0a020'],
        error: ['#ffeaea', '#e53935'],
      };
      const [bg, border] = colors[type] || ['#f5f5f5', '#999'];
      const el = document.getElementById('frik-status');
      el.innerHTML = html;
      el.style.background   = bg;
      el.style.border       = '1px solid ' + border;
      el.style.display      = 'block';
    }
  }

  function makeDraggable(el, handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0;
    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      sx = e.clientX; sy = e.clientY;
      ox = el.offsetLeft || (window.innerWidth - el.offsetWidth - 20);
      oy = el.offsetTop  || (window.innerHeight - el.offsetHeight - 20);
      function onMove(m) {
        el.style.left   = Math.max(0, ox + m.clientX - sx) + 'px';
        el.style.top    = Math.max(0, oy + m.clientY - sy) + 'px';
        el.style.right  = 'auto';
        el.style.bottom = 'auto';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ── SPA navigation tracking (ścieżka + hash — Copart / IAAI bywa SPA) ──
  function pathKey() {
    return location.pathname + '\n' + (location.hash || '');
  }
  let lastPath  = pathKey();
  let injectTid = null;
  let fabPollTid = null;

  function clearFabPoll() {
    if (fabPollTid != null) {
      clearInterval(fabPollTid);
      fabPollTid = null;
    }
  }

  /** Copart SPA / wolne body: kilkanaście prób FAB po wejściu na VDP. */
  function scheduleFabPoll() {
    if (fabPollTid != null) return;
    let n = 0;
    fabPollTid = setInterval(function () {
      n += 1;
      if (n > 50) {
        clearFabPoll();
        return;
      }
      if (!isDetailPage()) return;
      if (document.getElementById(FAB_ID)) {
        clearFabPoll();
        return;
      }
      injectFab();
    }, 400);
  }

  function onNavigate() {
    if (injectTid) clearTimeout(injectTid);
    clearFabPoll();
    removeFab();
    if (isDetailPage()) {
      injectTid = setTimeout(injectFab, 2500);
      scheduleFabPoll();
    }
  }

  ['pushState', 'replaceState'].forEach(method => {
    const original = history[method].bind(history);
    history[method] = function (...args) {
      const result = original(...args);
      const pk = pathKey();
      if (pk !== lastPath) {
        lastPath = pk;
        onNavigate();
      }
      return result;
    };
  });
  window.addEventListener('popstate', function () {
    lastPath = pathKey();
    onNavigate();
  });

  // ── Initial check ────────────────────────────────────────────────
  if (isDetailPage()) {
    setTimeout(injectFab, 2500);
    scheduleFabPoll();
  }
  // Gdy document_end był przed ustawieniem URL przez SPA / pełnym load
  window.addEventListener('load', function () {
    if (isDetailPage() && !document.getElementById(FAB_ID)) {
      setTimeout(injectFab, 600);
      scheduleFabPoll();
    }
  });
  window.addEventListener('pageshow', function () {
    if (isDetailPage() && !document.getElementById(FAB_ID)) {
      setTimeout(injectFab, 800);
      scheduleFabPoll();
    }
  });

  // IAAI CA / ciężkie SPA: body i szablon mogą dojść po pierwszym przebiegu — obserwuj DOM (throttle).
  (function frikFabDomObserver() {
    let throttle = null;
    function tryFabFromDom() {
      if (!isDetailPage() || document.getElementById(FAB_ID)) return;
      if (document.body) {
        injectFab();
        scheduleFabPoll();
      }
    }
    function scheduleTry() {
      if (throttle) return;
      throttle = window.setTimeout(function () {
        throttle = null;
        tryFabFromDom();
      }, 280);
    }
    tryFabFromDom();
    let mo = null;
    try {
      mo = new MutationObserver(function () { scheduleTry(); });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) { /* brak documentElement — pomiń */ }
    window.setTimeout(function () {
      try {
        if (mo) mo.disconnect();
      } catch (_) {}
    }, 90000);
  })();

})();
