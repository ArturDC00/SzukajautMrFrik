// Service worker — minimal, used only for install event
chrome.runtime.onInstalled.addListener(() => {
  console.log('[MrFrik] Rozszerzenie zainstalowane.');
});
