const toggleSuggested = document.getElementById('toggle-suggested');
const togglePromoted = document.getElementById('toggle-promoted');
const togglePromotedBy = document.getElementById('toggle-promoted-by');
const toggleLinkedInNews = document.getElementById('toggle-linkedin-news');
const togglePuzzles = document.getElementById('toggle-puzzles');
const sidebarPhrases = document.getElementById('sidebar-phrases');
const chips = [...document.querySelectorAll('.chip[data-mode]')];
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
  togglePromotedBy.checked = settings.hidePromotedBy;
  toggleLinkedInNews.checked = settings.hideLinkedInNews;
  togglePuzzles.checked = settings.hidePuzzles;
  sidebarPhrases.value = normalizePhraseList(settings.hideSidebarPhrases).join('\n');
  transparentMode = settings.transparentMode;
  renderChips();
});

// ---------------------------------------------------------------------------
// Persist changes and notify the background script
// ---------------------------------------------------------------------------

function onToggleChange() {
  clearTimeout(phraseInputTimer);

  const settings = {
    hideSuggested: toggleSuggested.checked,
    hidePromoted: togglePromoted.checked,
    hidePromotedBy: togglePromotedBy.checked,
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
togglePromotedBy.addEventListener('change', onToggleChange);
toggleLinkedInNews.addEventListener('change', onToggleChange);
togglePuzzles.addEventListener('change', onToggleChange);
sidebarPhrases.addEventListener('input', onPhraseInput);

chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const next = chip.dataset.mode === 'transparent';
    if (next === transparentMode) return;
    transparentMode = next;
    renderChips();
    onToggleChange();
  });
});
