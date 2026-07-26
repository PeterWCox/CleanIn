// CleanIn — content script

if (!globalThis.__cleanInContentScriptLoaded) {
globalThis.__cleanInContentScriptLoaded = true;

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

let currentSettings = { ...defaultSettings };
let feedObserver = null;
let observedFeed = null;
let feedRootCheckTimer = null;
let feedPollTimer = null;
let applyDebounceTimer = null;
let wakeApplyTimers = [];
let lastWakeApplyAt = 0;
let lastRouteKey = getRouteKey();
let animateFilteredHides = false;

const FEED_PATH_PATTERN = /^\/feed(?:\/|$)/;
const STATUS_MENU_ICON_ATTR = 'data-lfr-status-icon';
const PENCIL_ICON_PATH =
  'M13.62 3.38a2.12 2.12 0 0 0-3 0L3 11v3h3l7.62-7.62a2.12 2.12 0 0 0 0-3M5.17 12H5v-.17l5.04-5.04.17.17zm6.45-6.45-.17.17-.17-.17.17-.17a.12.12 0 0 1 .17.17';

function getElementText(element) {
  return (element.textContent || '').replace(/\s+/g, ' ').trim();
}

function scheduleApply() {
  if (!isLinkedInFeedPage()) {
    teardownFiltering();
    return;
  }
  if (document.visibilityState !== 'visible') return;
  if (applyDebounceTimer) return;
  applyDebounceTimer = setTimeout(() => {
    applyDebounceTimer = null;
    CleanInFeatures.hideFeed.apply(currentSettings, animateFilteredHides);
  }, 150);
}

function applyAllFilters() {
  if (!isLinkedInFeedPage()) {
    teardownFiltering();
    return;
  }
  CleanInFeatures.hideFeed.apply(currentSettings, animateFilteredHides);
  CleanInFeatures.hideSidebar.apply(currentSettings);
  applyStatusMenuPencilIcons();
}

function scheduleWakeApply() {
  if (!isLinkedInFeedPage()) {
    teardownFiltering();
    return;
  }
  wakeApplyTimers.forEach(clearTimeout);
  wakeApplyTimers = [];

  const now = Date.now();
  if (now - lastWakeApplyAt > 500) {
    lastWakeApplyAt = now;
    applyAllFilters();
  }

  // LinkedIn often hydrates/recycles feed cards after a hidden tab becomes
  // visible again, so run a short burst after wake instead of waiting for
  // throttled background timers to catch up.
  wakeApplyTimers = [250, 1000, 3000, 8000].map((ms) => setTimeout(applyAllFilters, ms));
}

function setupLifecycleListeners() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') handleRouteChange({ refreshFeed: true });
  });
  window.addEventListener('focus', () => handleRouteChange({ refreshFeed: true }));
  window.addEventListener('pageshow', () => handleRouteChange({ refreshFeed: true }));
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function init() {
  if (!isLinkedInFeedPage()) {
    teardownFiltering();
    removeInjectedNavButton();
    return;
  }

  CleanInFeatures.scanHighlights.ensureStyles();
  loadSettings().then((settings) => {
    if (!isLinkedInFeedPage()) return;
    currentSettings = settings;
    waitForFeed();
    CleanInFeatures.hideSidebar.start(currentSettings);
    applyAllFilters();
    removeInjectedNavButton();
  });
}

function isLinkedInFeedPage() {
  return location.hostname === 'www.linkedin.com' && (location.pathname === '/' || FEED_PATH_PATTERN.test(location.pathname));
}

function getRouteKey() {
  return `${location.pathname}${location.search}`;
}

function handleRouteChange({ refreshFeed = false } = {}) {
  const routeKey = getRouteKey();
  const routeChanged = routeKey !== lastRouteKey;
  lastRouteKey = routeKey;

  if (!isLinkedInFeedPage()) {
    teardownFiltering();
    removeInjectedNavButton();
    return;
  }

  if (routeChanged || !feedObserver) {
    teardownFiltering();
    init();
    return;
  }

  if (refreshFeed) scheduleWakeApply();
}

function teardownFiltering() {
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }
  observedFeed = null;
  if (feedRootCheckTimer) {
    clearInterval(feedRootCheckTimer);
    feedRootCheckTimer = null;
  }
  if (feedPollTimer) {
    clearInterval(feedPollTimer);
    feedPollTimer = null;
  }
  if (applyDebounceTimer) {
    clearTimeout(applyDebounceTimer);
    applyDebounceTimer = null;
  }
  wakeApplyTimers.forEach(clearTimeout);
  wakeApplyTimers = [];
  CleanInFeatures.hideSidebar.stop();
  CleanInFeatures.scanHighlights.stop();
  clearFilteredPageStyles();
}

function clearFilteredPageStyles() {
  document.querySelectorAll('[data-lfr-hidden]').forEach((element) => {
    delete element.dataset.lfrHidden;
    clearFilteredElementStyle(element);
  });
}

// ---------------------------------------------------------------------------
// Cleanup any previously injected navbar control
// ---------------------------------------------------------------------------

const ACCORDION_ID = 'lfr-accordion';

function removeInjectedNavButton() {
  const existingButton = document.getElementById(ACCORDION_ID);
  if (existingButton) existingButton.remove();
}

// Re-run init on SPA navigation (LinkedIn swaps content without a full page reload)
function setupNavigationListener() {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPushState(...args);
    setTimeout(handleRouteChange, 300);
  };
  history.replaceState = (...args) => {
    originalReplaceState(...args);
    setTimeout(handleRouteChange, 300);
  };

  window.addEventListener('popstate', () => setTimeout(handleRouteChange, 300));
  window.addEventListener('hashchange', () => setTimeout(handleRouteChange, 300));

  setInterval(() => {
    if (getRouteKey() !== lastRouteKey) handleRouteChange();
  }, 1000);
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaultSettings, (settings) => {
      resolve(normalizeSettings(settings));
    });
  });
}

function normalizeSettings(settings) {
  return {
    ...defaultSettings,
    ...settings,
  };
}

// ---------------------------------------------------------------------------
// Feed container — wait for LazyColumn then observe it
// ---------------------------------------------------------------------------

function waitForFeed() {
  attachFeedObserver();

  const feed = CleanInFeatures.hideFeed.getFeed();
  if (feed && !feedRootCheckTimer) {
    feedRootCheckTimer = setInterval(() => {
      if (!isLinkedInFeedPage()) {
        teardownFiltering();
        return;
      }

      const currentFeed = CleanInFeatures.hideFeed.getFeed();
      if (currentFeed !== observedFeed) {
        attachFeedObserver();
        CleanInFeatures.hideFeed.apply(currentSettings, animateFilteredHides);
      }
    }, 2000);
    return;
  }

  if (feedPollTimer) clearInterval(feedPollTimer);
  feedPollTimer = setInterval(() => {
    if (!isLinkedInFeedPage()) {
      clearInterval(feedPollTimer);
      feedPollTimer = null;
      return;
    }
    if (CleanInFeatures.hideFeed.getFeed()) {
      clearInterval(feedPollTimer);
      feedPollTimer = null;
      waitForFeed();
    }
  }, 500);
}

function attachFeedObserver() {
  const feed = CleanInFeatures.hideFeed.getFeed();
  if (!feed || feed === observedFeed) return;

  if (feedObserver) feedObserver.disconnect();
  observedFeed = feed;
  feedObserver = new MutationObserver(scheduleApply);
  feedObserver.observe(feed, { childList: true, subtree: true });
}

function applyStatusMenuPencilIcons() {
  document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"]').forEach((menu) => {
    menu.querySelectorAll('[role="menuitem"], [role="option"], li, button').forEach((item) => {
      if (!isStatusMenuItem(item)) return;
      const icon = getMenuItemIcon(item);
      if (!icon || icon.getAttribute(STATUS_MENU_ICON_ATTR) === 'pencil') return;
      replaceSvgWithPencil(icon);
    });
  });
}

function isStatusMenuItem(item) {
  const text = `${item.getAttribute('aria-label') || ''} ${getElementText(item)}`.toLowerCase();
  return /\bstatus\b/.test(text);
}

function getMenuItemIcon(item) {
  return [...item.querySelectorAll('svg')].find(isTickIcon) || null;
}

function isTickIcon(svg) {
  const id = svg.getAttribute('id') || '';
  const ariaLabel = svg.getAttribute('aria-label') || '';
  const text = `${id} ${ariaLabel}`.toLowerCase();
  if (/\b(edit|pencil)\b/.test(text)) return false;
  return /\b(check|checkmark|tick)\b/.test(text);
}

function replaceSvgWithPencil(svg) {
  svg.setAttribute('id', 'edit-pencil-small');
  svg.setAttribute(STATUS_MENU_ICON_ATTR, 'pencil');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', svg.getAttribute('width') || '16');
  svg.setAttribute('height', svg.getAttribute('height') || '16');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.removeAttribute('aria-label');
  svg.replaceChildren(createSvgPath(PENCIL_ICON_PATH));
}

function createSvgPath(d) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  return path;
}

function clearFilteredElementStyle(element) {
  element.style.display = '';
  element.style.transition = '';
  element.style.opacity = '';
  element.style.visibility = '';
  element.style.outline = '';
  element.style.backgroundColor = '';
  element.style.backgroundImage = '';
  element.style.boxShadow = '';
  element.style.filter = '';
  element.style.pointerEvents = '';
}

// Message listener — receives SETTINGS_UPDATED from background
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'SETTINGS_UPDATED') {
    const wasShowingScanHighlights = currentSettings.transparentMode && currentSettings.showScanHighlights;
    currentSettings = normalizeSettings(message.settings);
    const shouldShowScanHighlights = currentSettings.transparentMode && currentSettings.showScanHighlights;
    if (!shouldShowScanHighlights) CleanInFeatures.scanHighlights.stop();
    if (shouldShowScanHighlights && !wasShowingScanHighlights) CleanInFeatures.scanHighlights.reset();
    animateFilteredHides = true;
    applyAllFilters();
    animateFilteredHides = false;
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

init();
setupNavigationListener();
setupLifecycleListeners();
}
