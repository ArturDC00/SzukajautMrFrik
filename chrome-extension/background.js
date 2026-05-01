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
