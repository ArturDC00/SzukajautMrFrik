'use strict';

const $ = id => document.getElementById(id);

// Load saved deal info
chrome.storage.local.get(['frik_deal_id'], data => {
  const el = $('dealIdVal');
  if (data.frik_deal_id) {
    el.textContent = '#' + data.frik_deal_id;
    el.classList.remove('none');
  } else {
    el.textContent = 'Brak — otwórz zakładkę "Szukaj aut" w dealu';
    el.classList.add('none');
  }
});

// Clear deal
$('clearDeal').addEventListener('click', () => {
  chrome.storage.local.remove(['frik_deal_id', 'frik_domain'], () => {
    const el = $('dealIdVal');
    el.textContent = 'Brak — otwórz zakładkę "Szukaj aut" w dealu';
    el.classList.add('none');
  });
});
