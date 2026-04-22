'use strict';

const $ = id => document.getElementById(id);

function showWebhookStatus(msg, ok) {
  const el = $('webhookStatus');
  el.textContent = msg || '';
  el.style.color = ok ? '#34b251' : (ok === false ? '#e53935' : '#888');
}

chrome.storage.local.get(['frik_webhook', 'frik_deal_id', 'frik_domain'], data => {
  if (data.frik_webhook) {
    $('webhookInput').value = data.frik_webhook;
    showWebhookStatus('Zapisano ✓', true);
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

$('clearDeal').addEventListener('click', () => {
  chrome.storage.local.remove(['frik_deal_id', 'frik_domain'], () => {
    const el = $('dealIdVal');
    el.textContent = 'Brak — otwórz zakładkę "Szukaj aut" w dealu';
    el.classList.add('none');
  });
});
