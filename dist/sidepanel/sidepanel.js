const toggleSuggested = document.getElementById('toggle-suggested');
const togglePromoted = document.getElementById('toggle-promoted');
const toggleLinkedInNews = document.getElementById('toggle-linkedin-news');
const togglePuzzles = document.getElementById('toggle-puzzles');
const chips = [...document.querySelectorAll('.chip[data-mode]')];

const defaultSettings = {
  hideSuggested: true,
  hidePromoted: true,
  hideLinkedInNews: true,
  hidePuzzles: true,
  transparentMode: true,
};

let transparentMode = defaultSettings.transparentMode;

function renderChips() {
  chips.forEach((chip) => {
    const active =
      (chip.dataset.mode === 'transparent' && transparentMode) ||
      (chip.dataset.mode === 'hidden' && !transparentMode);
    chip.classList.toggle('chip-active', active);
    chip.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

// ---------------------------------------------------------------------------
// Load persisted settings and reflect them in the UI
// ---------------------------------------------------------------------------

chrome.storage.sync.get(defaultSettings, (settings) => {
  toggleSuggested.checked = settings.hideSuggested;
  togglePromoted.checked = settings.hidePromoted;
  toggleLinkedInNews.checked = settings.hideLinkedInNews;
  togglePuzzles.checked = settings.hidePuzzles;
  transparentMode = settings.transparentMode;
  renderChips();
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
    transparentMode,
  };

  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
}

toggleSuggested.addEventListener('change', onToggleChange);
togglePromoted.addEventListener('change', onToggleChange);
toggleLinkedInNews.addEventListener('change', onToggleChange);
togglePuzzles.addEventListener('change', onToggleChange);

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const next = chip.dataset.mode === 'transparent';
    if (next === transparentMode) return;
    transparentMode = next;
    renderChips();
    onToggleChange();
  });
});
