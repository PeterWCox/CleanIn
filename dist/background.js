// Open the side panel when the extension action button is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Set side panel behavior to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Listen for messages from content script or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SETTINGS") {
    chrome.storage.sync.get(defaultSettings, (settings) => {
      sendResponse({ settings });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === "UPDATE_SETTINGS") {
    chrome.storage.sync.set(message.settings, () => {
      // Notify content scripts on LinkedIn tabs to re-apply filters
      notifyLinkedInTabs(message.settings);
      sendResponse({ ok: true });
    });
    return true;
  }
});

function notifyLinkedInTabs(settings) {
  chrome.tabs.query(
    {
      url: [
        "https://www.linkedin.com/feed",
        "https://www.linkedin.com/feed/",
        "https://www.linkedin.com/feed/*",
      ],
    },
    (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: "SETTINGS_UPDATED", settings }).catch(() => {
          // Tab may not have content script loaded yet — safe to ignore
        });
      }
    }
  );
}

const defaultSettings = {
  hideSuggested: true,
  hidePromoted: true,
  hideLinkedInNews: true,
  hidePuzzles: true,
  transparentMode: true,
};
