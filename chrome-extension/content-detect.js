// Runs only on /mrfrik/* (zakładki Bitrix) — nie ładuje się na głównej stronie klienta (document_start, all frames).
// Sets a DOM attribute AND dispatches a CustomEvent so the page can detect
// that the extension is installed — at any point during page lifecycle.

document.documentElement.setAttribute('data-frik-ext', '1');

// ── Receive deal ID via DOM attribute (crosses isolated-world boundary reliably) ──
// Page script sets: document.documentElement.setAttribute('data-frik-deal-id', '123')
// MutationObserver in content script (isolated world) picks it up immediately.
new MutationObserver(function (mutations) {
  for (var i = 0; i < mutations.length; i++) {
    if (mutations[i].attributeName === 'data-frik-deal-id') {
      var dealId = document.documentElement.getAttribute('data-frik-deal-id');
      if (dealId) {
        chrome.storage.local.set({
          frik_deal_id: String(dealId),
          frik_domain:  document.documentElement.getAttribute('data-frik-domain') || 'mrfrik.bitrix24.pl',
        });
      }
    }
  }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-frik-deal-id'] });

// ── Also support CustomEvent as secondary channel ──
window.addEventListener('frik-set-deal', function (e) {
  if (e && e.detail && e.detail.dealId) {
    chrome.storage.local.set({
      frik_deal_id: String(e.detail.dealId),
      frik_domain:  (e.detail.domain) || 'mrfrik.bitrix24.pl',
    });
  }
});

// ── Signal to page that extension is active ──
function pingPage() {
  window.dispatchEvent(new CustomEvent('frik-ext-ping', { detail: { v: 1 } }));
}

// document_start — od razu; potem po DOMContentLoaded (strona może zarejestrować listener późno)
pingPage();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', pingPage);
} else {
  setTimeout(pingPage, 0);
}
