// Service worker — domyślny webhook z install-defaults.js (obok tego bundle w dist/)
try {
  importScripts('install-defaults.js');
} catch (e) {
  console.warn('[MrFrik] Brak install-defaults.js obok workers — opcjonalny.');
}

function defaultWebhookFromInstall() {
  try {
    const v = self.FRIK_DEFAULT_WEBHOOK;
    return typeof v === 'string' && v.trim() ? v.trim().replace(/\/+$/, '') : '';
  } catch (_) {
    return '';
  }
}

async function seedDefaultWebhookIfEmpty() {
  const def = defaultWebhookFromInstall();
  if (!def) return;
  const cur = await chrome.storage.local.get('frik_webhook');
  if (cur.frik_webhook && String(cur.frik_webhook).trim()) return;
  await chrome.storage.local.set({ frik_webhook: def });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[MrFrik] Rozszerzenie zainstalowane.');
  seedDefaultWebhookIfEmpty();
});

chrome.runtime.onStartup.addListener(() => {
  seedDefaultWebhookIfEmpty();
});

// Pobieranie zdjęć przez background (omija CORS content-script)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'FETCH_IMAGE_BASE64') return false;
  const url = msg.url;
  if (!url || typeof url !== 'string') {
    sendResponse({ error: 'brak url' });
    return false;
  }
  fetch(url, { headers: { Accept: 'image/*' } })
    .then(async (res) => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      const buf = await res.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      sendResponse({ base64: b64, contentType: ct });
    })
    .catch((e) => sendResponse({ error: String(e) }));
  return true; // async response
});
