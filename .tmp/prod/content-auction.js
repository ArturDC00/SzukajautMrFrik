/* content-auction.js
 * Runs on iaai.com and copart.com pages.
 * 1. Captures bx_deal_id / bx_domain from URL params → saves to storage.
 * 2. On vehicle detail pages → injects floating "Utwórz ofertę" button.
 * 3. Button reads DOM data and creates a Quote in Bitrix24 via webhook.
 */
(function frikAuction() {
  'use strict';

  // ── Detect site ─────────────────────────────────────────────────
  const HOST   = location.hostname.replace(/^www\./, '');
  const IS_IAAI   = HOST.includes('iaai.com');
  const IS_COPART = HOST.includes('copart.com');
  const SOURCE      = IS_IAAI ? 'IAAI' : 'Copart';
  const SOURCE_ENUM = IS_IAAI ? 3089 : 3091;   // Bitrix24 source enum IDs

  // ── Capture deal params from URL (happens once per hard navigation) ──
  (function captureDealParams() {
    const p = new URLSearchParams(location.search);
    const dealId = p.get('bx_deal_id');
    const domain = p.get('bx_domain');
    if (dealId) {
      chrome.storage.local.set({ frik_deal_id: dealId, frik_domain: domain || '' });
    }
  })();

  // ── Is this a vehicle detail page? ──────────────────────────────
  function isDetailPage() {
    const path = location.pathname.toLowerCase();
    if (IS_IAAI)   return path.includes('/vehicledetail/');
    if (IS_COPART) return /\/lot\/\d/.test(path);
    return false;
  }

  // ── Extract vehicle data from DOM text ───────────────────────────
  function extractData() {
    const text = document.body ? document.body.innerText : '';

    function labelVal(label) {
      const m = text.match(new RegExp(label + '[:\\s]+([^\\n\\r]{1,120})', 'i'));
      return m ? m[1].trim() : null;
    }

    // VIN — 17-char code (ISO 3779, no I O Q)
    const vinM = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    const vin  = vinM ? vinM[1] : null;

    // Title
    const titleEl    = document.querySelector(
      'h1, [class*="vehicle-title"], [class*="vdp-title"], [class*="lot-title"], [data-testid*="title"]'
    );
    const vehicleTitle = titleEl ? titleEl.textContent.trim().substring(0, 120) : null;

    // Year / Make / Model from title
    let year = null, make = null, model = null;
    if (vehicleTitle) {
      const m = vehicleTitle.match(/^(\d{4})\s+([A-Za-z\-]+)\s+(.+)/);
      if (m) {
        year  = parseInt(m[1], 10);
        make  = m[2];
        model = m[3].replace(/\s*[|#].*$/, '').trim();
      }
    }

    // Lot number
    const lotFromUrl  = location.href.match(
      IS_IAAI ? /\/vehicledetail\/(\d+)/i : /\/lot\/(\d+)/i
    );
    const lotFromText = text.match(/\bLot[:\s#]*(\d{6,10})\b/i);
    const lotNumber   = lotFromUrl ? lotFromUrl[1] : (lotFromText ? lotFromText[1] : null);

    // Damages
    const primaryDamage   = labelVal('Primary Damage')   || labelVal('Primary');
    const secondaryDamage = labelVal('Secondary Damage') || labelVal('Secondary');

    // Odometer
    const odoM = text.match(/Odometer[:\s]*([\d,]+)\s*mi/i)
              || text.match(/Mileage[:\s]*([\d,]+)/i);
    const odometer = odoM ? parseInt(odoM[1].replace(/,/g, ''), 10) : null;

    // Run & Drive
    const rdM = text.match(/Run\s*(?:&|and|\/)\s*Drive[:\s]*(Yes|No|[A-Za-z ]{2,25})/i);
    const runDrive = rdM ? rdM[1].trim() : null;

    // Sale / Auction date
    const sdM = text.match(/Sale Date[:\s]+([^\n]{4,40})/i)
             || text.match(/Auction Date[:\s]+([^\n]{4,40})/i);
    const saleDate = sdM ? sdM[1].trim() : null;

    // Location
    const locM = text.match(/Location[:\s]+([^\n]{4,60})/i);
    const vehicleLocation = locM ? locM[1].trim() : null;

    // Estimated value
    const evM = text.match(/Estimated.*?Value[:\s]*\$?([\d,]+)/i)
             || text.match(/Actual Cash.*?Value[:\s]*\$?([\d,]+)/i);
    const estimatedValue = evM ? parseInt(evM[1].replace(/,/g, ''), 10) : null;

    // Images
    const imgEls = Array.from(document.querySelectorAll('img[src]'));
    const images = imgEls
      .map(img => img.src)
      .filter(src => /cs\.iaai\.com|cdnmedia\.copart\.com|cs\.copart\.com/i.test(src))
      .filter((v, i, a) => a.indexOf(v) === i) // dedupe
      .slice(0, 10);

    // Auction URL without our own params
    const cleanUrl = location.href.split('?')[0];

    return {
      vin, vehicleTitle, year, make, model, lotNumber,
      primaryDamage, secondaryDamage, odometer, runDrive,
      saleDate, location: vehicleLocation, estimatedValue, images,
      auctionUrl: cleanUrl, source: SOURCE,
    };
  }

  // ── Build COMMENTS field ─────────────────────────────────────────
  function buildComments(d) {
    const lines = [
      `=== Dane pojazdu z ${d.source} ===`,
      d.vin         ? `VIN: ${d.vin}`                             : null,
      d.lotNumber   ? `Lot: ${d.lotNumber}`                       : null,
      '',
      d.year        ? `Rok: ${d.year}`                            : null,
      d.make        ? `Marka: ${d.make}`                          : null,
      d.model       ? `Model: ${d.model}`                         : null,
      d.odometer    ? `Przebieg: ${d.odometer.toLocaleString('pl')} mil` : null,
      '',
      d.primaryDamage   ? `Uszkodzenie główne: ${d.primaryDamage}`      : null,
      d.secondaryDamage ? `Uszkodzenie dodatkowe: ${d.secondaryDamage}` : null,
      d.runDrive    ? `Czy jeździ: ${d.runDrive}`                 : null,
      '',
      d.location    ? `Lokalizacja: ${d.location}`                : null,
      d.saleDate    ? `Data licytacji: ${d.saleDate}`             : null,
      d.estimatedValue
        ? `Szacowana wartość: $${d.estimatedValue.toLocaleString('en')}` : null,
      '',
      d.auctionUrl  ? `Link aukcji: ${d.auctionUrl}`              : null,
      '',
      d.images && d.images.length
        ? `Zdjęcia:\n${d.images.join('\n')}`
        : null,
    ].filter(x => x !== null);
    return lines.join('\n');
  }

  // ── Webhook (hardcoded) ─────────────────────────────────────────
  const WEBHOOK_URL = 'https://mrfrik.bitrix24.pl/rest/11/z345v0f3lffrnl5h';
  const BX_DOMAIN   = 'mrfrik.bitrix24.pl';

  // ── Add photos as timeline comment (non-blocking) ─────────────────
  async function addPhotosComment(quoteId, images) {
    if (!images || !images.length) return;
    const imgs = images.slice(0, 10)
      .map(u => `<img src="${u}" style="max-width:220px;margin:3px;border-radius:4px;display:inline-block">`)
      .join('');
    await fetch(WEBHOOK_URL.replace(/\/+$/, '') + '/crm.timeline.comment.add', {
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

    const resp = await fetch(WEBHOOK_URL.replace(/\/+$/, '') + '/crm.deal.list', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        order:  { DATE_MODIFY: 'DESC' },
        select: ['ID', 'TITLE', 'CONTACT_ID', 'COMPANY_ID'],
        start:  0,
      }),
    });
    const json = await resp.json();
    if (json.error) throw new Error(json.error_description || json.error);

    const deals = json.result || [];

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
        const bResp = await fetch(WEBHOOK_URL.replace(/\/+$/, '') + '/batch', {
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
    const title = data.vehicleTitle
      || [data.year, data.make, data.model].filter(Boolean).join(' ')
      || 'Auto z aukcji';

    const fields = {
      DEAL_ID:     parseInt(dealId, 10),
      TITLE:       title,
      COMMENTS:    buildComments(data),
      STATUS_ID:   'D',
    };

    if (contactId) fields.CONTACT_ID = parseInt(contactId, 10);
    if (companyId) fields.COMPANY_ID = parseInt(companyId, 10);

    if (data.estimatedValue) {
      fields.OPPORTUNITY  = data.estimatedValue;
      fields.CURRENCY_ID  = 'USD';
      fields['UF_CRM_QUOTE_1749798603485'] = {
        VALUE: String(data.estimatedValue), CURRENCY: 'USD',
      };
    }
    fields['UF_CRM_QUOTE_1775199244953'] = SOURCE_ENUM;

    // Poziom dopasowania — dynamically looked-up field
    if (poziomEnumId && cachedFieldName) {
      fields[cachedFieldName] = poziomEnumId;
    }

    const endpoint = WEBHOOK_URL.replace(/\/+$/, '') + '/crm.quote.add';
    const resp = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.error) throw new Error(json.error_description || json.error);

    const quoteId = json.result;
    if (data.images && data.images.length > 0) {
      addPhotosComment(quoteId, data.images).catch(() => {});
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

    // Query Bitrix24 via webhook
    try {
      const resp = await fetch(
        WEBHOOK_URL.replace(/\/+$/, '') + '/crm.quote.userfield.list.json', {
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
    } catch (_) { /* field not created yet or method unavailable — degrade gracefully */ }
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
    if (document.getElementById(FAB_ID)) return;
    const fab = document.createElement('button');
    fab.id    = FAB_ID;
    fab.title = 'MrFrik — Utwórz ofertę w Bitrix24';
    fab.innerHTML = FAB_ICON;
    fab.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px', 'z-index:2147483647',
      'width:54px', 'height:54px', 'border-radius:50%',
      'background:#0b66c2', 'border:none', 'cursor:pointer',
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
      <div id="frik-hdr" style="background:#0b66c2;color:#fff;padding:10px 14px;
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
          style="width:100%;background:#0b66c2;color:#fff;border:none;
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
      if (!createBtn.disabled) createBtn.style.background = '#0955a8';
    });
    createBtn.addEventListener('mouseleave', () => {
      if (!createBtn.disabled) createBtn.style.background = '#0b66c2';
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

        const link = `https://${BX_DOMAIN}/crm/quote/show/${quoteId}/`;
        showStatus(
          `<a href="${link}" target="_blank"
             style="color:#0b66c2;font-weight:600">Otwórz ofertę w Bitrix24 →</a>`,
          'ok'
        );

        // Remember this deal for next vehicle
        chrome.storage.local.set({ frik_deal_id: String(dealIdVal) });

        setTimeout(() => {
          createBtn.disabled = false;
          createBtn.style.background = '#0b66c2';
          createBtn.textContent = 'Utwórz ofertę w Bitrix24';
        }, 8000);
      } catch (err) {
        showStatus('Błąd: ' + err.message, 'error');
        createBtn.disabled = false;
        createBtn.style.background = '#0b66c2';
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

  // ── SPA navigation tracking ──────────────────────────────────────
  let lastPath  = location.pathname;
  let injectTid = null;

  function onNavigate() {
    if (injectTid) clearTimeout(injectTid);
    removeFab();
    if (isDetailPage()) {
      injectTid = setTimeout(injectFab, 2500);
    }
  }

  ['pushState', 'replaceState'].forEach(method => {
    const original = history[method].bind(history);
    history[method] = function (...args) {
      const result = original(...args);
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        onNavigate();
      }
      return result;
    };
  });
  window.addEventListener('popstate', onNavigate);

  // ── Initial check ────────────────────────────────────────────────
  if (isDetailPage()) {
    setTimeout(injectFab, 2500);
  }

})();
