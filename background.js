chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !tab.url.includes("photos.google.com")) {
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "toggleTriage" });
  } catch {
    // Content script not loaded yet
  }
});
