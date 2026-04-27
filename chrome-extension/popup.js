'use strict';

const $ = id => document.getElementById(id);

function showWebhookStatus(msg, ok) {
  const el = $('webhookStatus');
  el.textContent = msg || '';
  el.style.color = ok ? '#34b251' : (ok === false ? '#e53935' : '#888');
}

function showUfPhotosStatus(msg, ok) {
  const el = $('ufPhotosStatus');
  el.textContent = msg || '';
  el.style.color = ok ? '#34b251' : (ok === false ? '#e53935' : '#888');
}

function renderAuctionStatus(resp) {
  const line = $('auctionStatusLine');
  const hint = $('auctionDetailHint');
  const btn = $('btnSendAutomekka');
  const foot = $('auctionSendFoot');
  hint.style.display = 'none';
  foot.style.display = 'none';
  btn.style.display = 'none';
  btn.disabled = false;

  if (!resp) {
    line.textContent = '✗ Nieznana karta — otwórz stronę obsługiwanej aukcji (IAAI, Copart, Progi, Manheim/ADESA).';
    line.style.color = '#e53935';
    return;
  }

  if (resp.sending) {
    line.textContent = '⏳ Wysyłanie do Bitrix…';
    line.style.color = '#0b66c2';
    return;
  }

  if (!resp.supported) {
    line.textContent = '✗ Nieznana aukcja — ta domena nie jest na liście C3.';
    line.style.color = '#e53935';
    if (resp.host) {
      hint.textContent = 'Host: ' + resp.host;
      hint.style.display = 'block';
    }
    return;
  }

  line.style.color = '#333';
  const src = resp.sourceLabel ? ` (${resp.sourceLabel})` : '';
  if (!resp.detailPage) {
    line.textContent = '⚠️ Obsługiwana aukcja' + src + ' — otwórz kartę pojazdu (nie listę).';
    line.style.color = '#f0a020';
    hint.textContent = resp.message || '';
    hint.style.display = resp.message ? 'block' : 'none';
    return;
  }

  if (resp.parseCode === 'error') {
    line.textContent = '⚠️ Błąd parsowania: ' + (resp.message || '');
    line.style.color = '#e53935';
    return;
  }

  if (resp.parseCode === 'warn') {
    line.textContent = '⚠️ ' + (resp.message || 'Część pól może być niedostępna');
    line.style.color = '#f0a020';
  } else {
    line.textContent = '✓ Obsługiwana aukcja — dane rozpoznane' + src;
    line.style.color = '#34b251';
  }

  hint.textContent = resp.message || '';
  hint.style.display = resp.message && resp.parseCode === 'warn' ? 'block' : 'none';

  if (resp.canSend) {
    btn.style.display = 'block';
    foot.style.display = 'block';
  }
}

function refreshAuctionTabStatus() {
  $('auctionStatusLine').textContent = '⏳ Sprawdzam aktywną kartę…';
  $('auctionStatusLine').style.color = '#888';
  $('btnSendAutomekka').style.display = 'none';

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) {
      renderAuctionStatus(null);
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'FRIK_GET_STATUS' }, function (resp) {
      if (chrome.runtime.lastError) {
        renderAuctionStatus(null);
        return;
      }
      renderAuctionStatus(resp);
    });
  });
}

$('btnSendAutomekka').addEventListener('click', function () {
  const btn = $('btnSendAutomekka');
  btn.disabled = true;
  $('auctionStatusLine').textContent = '⏳ Wysyłanie do Bitrix…';
  $('auctionStatusLine').style.color = '#0b66c2';

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0];
    if (!tab || tab.id == null) {
      btn.disabled = false;
      renderAuctionStatus(null);
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'FRIK_CREATE_QUOTE' }, function (resp) {
      btn.disabled = false;
      if (chrome.runtime.lastError) {
        $('auctionStatusLine').textContent = '✗ ' + chrome.runtime.lastError.message;
        $('auctionStatusLine').style.color = '#e53935';
        return;
      }
      if (resp && resp.ok) {
        $('auctionStatusLine').textContent = '✓ Wysłano — oferta #' + resp.quoteId + ' w Bitrix24';
        $('auctionStatusLine').style.color = '#34b251';
        $('btnSendAutomekka').style.display = 'none';
      } else {
        $('auctionStatusLine').textContent = '⚠️ ' + ((resp && resp.error) ? resp.error : 'Błąd wysyłki');
        $('auctionStatusLine').style.color = '#e53935';
        refreshAuctionTabStatus();
      }
    });
  });
});

chrome.storage.local.get(['frik_webhook', 'frik_deal_id', 'frik_domain', 'frik_quote_auction_photos_uf'], data => {
  if (data.frik_webhook) {
    $('webhookInput').value = data.frik_webhook;
    showWebhookStatus('Zapisano ✓', true);
  }
  if (data.frik_quote_auction_photos_uf) {
    $('ufAuctionPhotos').value = data.frik_quote_auction_photos_uf;
    showUfPhotosStatus('Zapisano ✓', true);
  }
  const el = $('dealIdVal');
  if (data.frik_deal_id) {
    el.textContent = '#' + data.frik_deal_id;
    el.classList.remove('none');
  } else {
    el.textContent = 'Brak — otwórz zakładkę "Szukaj aut" w dealu';
    el.classList.add('none');
  }
  if (data.frik_domain) {
    $('portalVal').textContent = data.frik_domain;
  }
});

refreshAuctionTabStatus();

$('saveWebhook').addEventListener('click', () => {
  const v = ($('webhookInput').value || '').trim();
  if (!v) {
    chrome.storage.local.remove('frik_webhook', () => {
      showWebhookStatus('Wyczyszczono — dodaj URL webhooka przed tworzeniem ofert.', false);
    });
    return;
  }
  try {
    const u = new URL(v.match(/^https?:\/\//i) ? v : 'https://' + v);
    if (!u.hostname) throw new Error('Nieprawidłowy URL');
  } catch (e) {
    showWebhookStatus('Nieprawidłowy URL — użyj https://…/rest/…', false);
    return;
  }
  chrome.storage.local.set({ frik_webhook: v }, () => {
    showWebhookStatus('Zapisano ✓', true);
  });
});

$('saveUfPhotos').addEventListener('click', () => {
  const v = ($('ufAuctionPhotos').value || '').trim();
  if (!v) {
    chrome.storage.local.remove('frik_quote_auction_photos_uf', () => {
      showUfPhotosStatus('Wyczyszczono — zdjęcia: timeline + bez listy w komentarzu.', false);
    });
    return;
  }
  const norm = v.replace(/^uf_crm_/i, 'UF_CRM_');
  if (!/^UF_CRM_[A-Z0-9_]+$/i.test(norm)) {
    showUfPhotosStatus('Format: UF_CRM_QUOTE_… (litery, cyfry, _)', false);
    return;
  }
  chrome.storage.local.set({ frik_quote_auction_photos_uf: norm }, () => {
    $('ufAuctionPhotos').value = norm;
    showUfPhotosStatus('Zapisano ✓', true);
  });
});

$('clearDeal').addEventListener('click', () => {
  chrome.storage.local.remove(['frik_deal_id', 'frik_domain'], () => {
    const el = $('dealIdVal');
    el.textContent = 'Brak — otwórz zakładkę "Szukaj aut" w dealu';
    el.classList.add('none');
  });
});
