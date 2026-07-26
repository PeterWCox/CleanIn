// Open the side panel when the extension action button is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Set side panel behavior to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(ensureContentScriptsOnLinkedInTabs);
chrome.runtime.onStartup.addListener(ensureContentScriptsOnLinkedInTabs);
chrome.runtime.onInstalled.addListener(() => chrome.storage.sync.remove('hideSidebarPhrases'));

chrome.tabs.onActivated.addListener(({ tabId }) => {
  ensureContentScriptOnTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    ensureContentScriptOnTab(tabId, tab);
  }
});

// Listen for messages from content script or side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

function ensureContentScriptsOnLinkedInTabs() {
  chrome.tabs.query(
    {
      url: [
        "https://www.linkedin.com/",
        "https://www.linkedin.com/feed",
        "https://www.linkedin.com/feed/",
        "https://www.linkedin.com/feed/*",
      ],
    },
    (tabs) => {
      for (const tab of tabs) {
        ensureContentScriptOnTab(tab.id, tab);
      }
    }
  );
}

function ensureContentScriptOnTab(tabId, tab = null) {
  if (!tabId) return;

  if (!tab?.url) {
    chrome.tabs.get(tabId, (currentTab) => {
      if (chrome.runtime.lastError) return;
      ensureContentScriptOnTab(tabId, currentTab);
    });
    return;
  }

  if (!isLinkedInFeedUrl(tab.url)) return;

  chrome.tabs.sendMessage(tabId, { type: "PING" }, () => {
    if (!chrome.runtime.lastError) return;

    chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }).catch(() => {
      // The tab may be gone, still loading, or outside the extension's host permissions.
    });
  });
}

function isLinkedInFeedUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "www.linkedin.com" && (parsed.pathname === "/" || /^\/feed(?:\/|$)/.test(parsed.pathname));
  } catch {
    return false;
  }
}

function notifyLinkedInTabs(settings) {
  chrome.tabs.query(
    {
      url: [
        "https://www.linkedin.com/",
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
  hidePromotedBy: true,
  hideLinkedInNews: true,
  hidePuzzles: true,
  hideSidebarAds: true,
  transparentMode: false,
  showScanHighlights: true,
};
