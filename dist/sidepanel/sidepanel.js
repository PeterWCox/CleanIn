const toggleSuggested = document.getElementById('toggle-suggested');
const togglePromoted = document.getElementById('toggle-promoted');
const toggleLinkedInNews = document.getElementById('toggle-linkedin-news');
const togglePuzzles = document.getElementById('toggle-puzzles');
const toggleSidebarAds = document.getElementById('toggle-sidebar-ads');
const toggleTransparentMode = document.getElementById('toggle-transparent-mode');
const toggleScanHighlights = document.getElementById('toggle-scan-highlights');

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

let transparentMode = defaultSettings.transparentMode;

// ---------------------------------------------------------------------------
// Load persisted settings and reflect them in the UI
// ---------------------------------------------------------------------------

chrome.storage.sync.get(defaultSettings, (settings) => {
  toggleSuggested.checked = settings.hideSuggested;
  togglePromoted.checked = settings.hidePromoted || settings.hidePromotedBy;
  toggleLinkedInNews.checked = settings.hideLinkedInNews;
  togglePuzzles.checked = settings.hidePuzzles;
  toggleSidebarAds.checked = settings.hideSidebarAds;
  transparentMode = settings.transparentMode;
  toggleTransparentMode.checked = transparentMode;
  toggleScanHighlights.checked = settings.showScanHighlights;
});

// ---------------------------------------------------------------------------
// Persist changes and notify the background script
// ---------------------------------------------------------------------------

function onToggleChange() {
  const settings = {
    hideSuggested: toggleSuggested.checked,
    hidePromoted: togglePromoted.checked,
    hidePromotedBy: togglePromoted.checked,
    hideLinkedInNews: toggleLinkedInNews.checked,
    hidePuzzles: togglePuzzles.checked,
    hideSidebarAds: toggleSidebarAds.checked,
    transparentMode,
    showScanHighlights: toggleScanHighlights.checked,
  };

  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
}

toggleSuggested.addEventListener('change', onToggleChange);
togglePromoted.addEventListener('change', onToggleChange);
toggleLinkedInNews.addEventListener('change', onToggleChange);
togglePuzzles.addEventListener('change', onToggleChange);
toggleSidebarAds.addEventListener('change', onToggleChange);
toggleTransparentMode.addEventListener('change', () => {
  transparentMode = toggleTransparentMode.checked;
  onToggleChange();
});
toggleScanHighlights.addEventListener('change', onToggleChange);
