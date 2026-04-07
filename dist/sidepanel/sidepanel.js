const toggleSuggested = document.getElementById('toggle-suggested');
const togglePromoted = document.getElementById('toggle-promoted');
const toggleLinkedInNews = document.getElementById('toggle-linkedin-news');
const togglePuzzles = document.getElementById('toggle-puzzles');
const toggleTransparent = document.getElementById('toggle-transparent');

const defaultSettings = {
  hideSuggested: false,
  hidePromoted: false,
  hideLinkedInNews: false,
  hidePuzzles: false,
  transparentMode: false,
};

// ---------------------------------------------------------------------------
// Load persisted settings and reflect them in the UI
// ---------------------------------------------------------------------------

chrome.storage.sync.get(defaultSettings, (settings) => {
  toggleSuggested.checked = settings.hideSuggested;
  togglePromoted.checked = settings.hidePromoted;
  toggleLinkedInNews.checked = settings.hideLinkedInNews;
  togglePuzzles.checked = settings.hidePuzzles;
  toggleTransparent.checked = settings.transparentMode;
});

// ---------------------------------------------------------------------------
// Persist changes and notify the background script
// ---------------------------------------------------------------------------

function onToggleChange() {
  const settings = {
    hideSuggested: toggleSuggested.checked,
    hidePromoted: togglePromoted.checked,
    hideLinkedInNews: toggleLinkedInNews.checked,
    hidePuzzles: togglePuzzles.checked,
    transparentMode: toggleTransparent.checked,
  };

  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
}

toggleSuggested.addEventListener('change', onToggleChange);
togglePromoted.addEventListener('change', onToggleChange);
toggleLinkedInNews.addEventListener('change', onToggleChange);
togglePuzzles.addEventListener('change', onToggleChange);
toggleTransparent.addEventListener('change', onToggleChange);
