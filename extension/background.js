chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "OPEN_RELEASE") {
    chrome.tabs.create({ url: "https://github.com/khahdihdz/vietsub/releases/latest" });
    sendResponse({ ok: true });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ installedAt: Date.now() });
});