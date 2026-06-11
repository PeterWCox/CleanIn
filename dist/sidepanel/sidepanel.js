const toggleSuggested = document.getElementById('toggle-suggested');
const togglePromoted = document.getElementById('toggle-promoted');
const toggleLinkedInNews = document.getElementById('toggle-linkedin-news');
const togglePuzzles = document.getElementById('toggle-puzzles');
const toggleTransparentMode = document.getElementById('toggle-transparent-mode');
const sidebarPhrases = document.getElementById('sidebar-phrases');
const tabButtons = document.querySelectorAll('.mui-tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const PHRASE_INPUT_DEBOUNCE_MS = 600;

const defaultSettings = {
  hideSuggested: true,
  hidePromoted: true,
  hidePromotedBy: true,
  hideLinkedInNews: true,
  hidePuzzles: true,
  hideSidebarPhrases: [],
  transparentMode: false,
};

let transparentMode = defaultSettings.transparentMode;
let phraseInputTimer = null;

// ---------------------------------------------------------------------------
// Load persisted settings and reflect them in the UI
// ---------------------------------------------------------------------------

chrome.storage.sync.get(defaultSettings, (settings) => {
  toggleSuggested.checked = settings.hideSuggested;
  togglePromoted.checked = settings.hidePromoted || settings.hidePromotedBy;
  toggleLinkedInNews.checked = settings.hideLinkedInNews;
  togglePuzzles.checked = settings.hidePuzzles;
  sidebarPhrases.value = normalizePhraseList(settings.hideSidebarPhrases).join('\n');
  transparentMode = settings.transparentMode;
  toggleTransparentMode.checked = transparentMode;
});

// ---------------------------------------------------------------------------
// Persist changes and notify the background script
// ---------------------------------------------------------------------------

function onToggleChange() {
  clearTimeout(phraseInputTimer);

  const settings = {
    hideSuggested: toggleSuggested.checked,
    hidePromoted: togglePromoted.checked,
    hidePromotedBy: togglePromoted.checked,
    hideLinkedInNews: toggleLinkedInNews.checked,
    hidePuzzles: togglePuzzles.checked,
    hideSidebarPhrases: getSidebarPhrases(),
    transparentMode,
  };

  chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
}

function onPhraseInput() {
  clearTimeout(phraseInputTimer);
  phraseInputTimer = setTimeout(onToggleChange, PHRASE_INPUT_DEBOUNCE_MS);
}

function getSidebarPhrases() {
  return normalizePhraseList(sidebarPhrases.value.split('\n'));
}

function normalizePhraseList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((phrase) => String(phrase).trim()).filter(Boolean))];
}

toggleSuggested.addEventListener('change', onToggleChange);
togglePromoted.addEventListener('change', onToggleChange);
toggleLinkedInNews.addEventListener('change', onToggleChange);
togglePuzzles.addEventListener('change', onToggleChange);
sidebarPhrases.addEventListener('input', onPhraseInput);
toggleTransparentMode.addEventListener('change', () => {
  transparentMode = toggleTransparentMode.checked;
  onToggleChange();
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetPanelId = button.dataset.tabTarget;

    tabButtons.forEach((tabButton) => {
      const isActive = tabButton === button;
      tabButton.classList.toggle('active', isActive);
      tabButton.setAttribute('aria-selected', String(isActive));
    });

    tabPanels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== targetPanelId);
    });
  });
});
