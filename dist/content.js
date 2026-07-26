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
let sidebarPollTimers = [];
let lastWakeApplyAt = 0;
let lastRouteKey = getRouteKey();
let animateFilteredHides = false;
let scanClearTimer = null;
let scannedPosts = new WeakSet();

const FILTER_STYLES = {
  suggested: {
    outline: '2px solid rgba(0, 100, 255, 0.4)',
    backgroundColor: 'rgba(0, 100, 255, 0.06)',
  },
  promoted: {
    outline: '2px solid rgba(220, 0, 0, 0.4)',
    backgroundColor: 'rgba(220, 0, 0, 0.06)',
  },
  'promoted-by': {
    outline: '2px solid rgba(128, 0, 255, 0.4)',
    backgroundColor: 'rgba(128, 0, 255, 0.06)',
  },
  news: {
    outline: '2px solid rgba(0, 153, 102, 0.4)',
    backgroundColor: 'rgba(0, 153, 102, 0.06)',
  },
  puzzles: {
    outline: '2px solid rgba(204, 122, 0, 0.4)',
    backgroundColor: 'rgba(204, 122, 0, 0.06)',
  },
  ad: {
    outline: '2px solid rgba(220, 0, 0, 0.4)',
    backgroundColor: 'rgba(220, 0, 0, 0.06)',
  },
};

const POST_FILTER_KEYS = new Set(['suggested', 'promoted', 'promoted-by']);
const SIDEBAR_FILTER_KEYS = new Set(['suggested', 'promoted', 'promoted-by']);
const SIDEBAR_ROOT_SELECTOR = 'aside, [role="complementary"], .scaffold-layout__aside';
const FEED_PATH_PATTERN = /^\/feed(?:\/|$)/;
const SIDEBAR_WIDGET_MAX_WIDTH = 420;
const SIDEBAR_WIDGET_MAX_HEIGHT = 900;
const STATUS_MENU_ICON_ATTR = 'data-lfr-status-icon';
const SCANNING_ATTR = 'data-lfr-scanning';
const PENCIL_ICON_PATH =
  'M13.62 3.38a2.12 2.12 0 0 0-3 0L3 11v3h3l7.62-7.62a2.12 2.12 0 0 0 0-3M5.17 12H5v-.17l5.04-5.04.17.17zm6.45-6.45-.17.17-.17-.17.17-.17a.12.12 0 0 1 .17.17';

function getFeed() {
  return document.querySelector('[data-component-type="LazyColumn"]');
}

function getPostLabelText(el) {
  return getElementText(el);
}

function getElementText(el) {
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

function isSuggestedPost(postEl) {
  return hasPostLabel(postEl, (label) => label === 'Suggested');
}

function isPromotedPost(postEl) {
  return hasPostLabel(postEl, (label) => label === 'Promoted');
}

function isPromotedByPost(postEl) {
  return hasPostLabel(postEl, (label) => label.startsWith('Promoted by'));
}

function hasPostLabel(postEl, predicate) {
  return [...postEl.querySelectorAll('p, span')].some((el) => {
    const label = getPostLabelText(el);
    if (label.length > 80) return false;
    return predicate(label);
  });
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
    applyFeedFilters();
  }, 150);
}

function applyAllFilters() {
  if (!isLinkedInFeedPage()) {
    teardownFiltering();
    return;
  }
  applyFeedFilters();
  applySidebarWidgets();
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

function applySidebarWidgets() {
  syncExistingHiddenSidebarWidgets();

  const newsWidget = findSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]');
  if (newsWidget) applySidebarWidget(newsWidget, 'news');
  const puzzlesWidget = findSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]');
  if (puzzlesWidget) applySidebarWidget(puzzlesWidget, 'puzzles');
  applySidebarAdWidgets();
  applySidebarCardFilters();
}

function syncExistingHiddenSidebarWidgets() {
  document
    .querySelectorAll('[data-lfr-hidden="news"], [data-lfr-hidden="puzzles"], [data-lfr-hidden="ad"], [data-lfr-hidden="suggested"], [data-lfr-hidden="promoted"], [data-lfr-hidden="promoted-by"]')
    .forEach((card) => {
      if (!card.closest(SIDEBAR_ROOT_SELECTOR)) return;

      const key = card.dataset.lfrHidden;
      const shouldKeepHidden =
        (key === 'news' && currentSettings.hideLinkedInNews) ||
        (key === 'puzzles' && currentSettings.hidePuzzles) ||
        (key === 'ad' && currentSettings.hideSidebarAds) ||
        (key === 'suggested' && currentSettings.hideSuggested) ||
        (key === 'promoted' && currentSettings.hidePromoted) ||
        (key === 'promoted-by' && currentSettings.hidePromotedBy);

      if (shouldKeepHidden) {
        applyWidgetStyle(card, key);
      } else {
        clearWidgetStyle(card);
      }
    });
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

  ensureScanStyles();
  loadSettings().then((settings) => {
    if (!isLinkedInFeedPage()) return;
    currentSettings = settings;
    waitForFeed();
    waitForSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]', 'news');
    waitForSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]', 'puzzles');
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
  if (scanClearTimer) {
    clearTimeout(scanClearTimer);
    scanClearTimer = null;
  }
  wakeApplyTimers.forEach(clearTimeout);
  wakeApplyTimers = [];
  sidebarPollTimers.forEach(clearInterval);
  sidebarPollTimers = [];
  clearFilteredPageStyles();
  clearScanHighlights();
}

function clearFilteredPageStyles() {
  document.querySelectorAll('[data-lfr-hidden]').forEach((element) => {
    delete element.dataset.lfrHidden;
    clearFilteredElementStyle(element);
  });
}

function ensureScanStyles() {
  if (document.getElementById('cleanin-scan-styles')) return;

  const style = document.createElement('style');
  style.id = 'cleanin-scan-styles';
  style.textContent = `[${SCANNING_ATTR}] {
    outline: 2px solid rgba(245, 184, 46, 0.75) !important;
    background-color: rgba(245, 184, 46, 0.16) !important;
    transition: outline-color 120ms ease, background-color 120ms ease;
  }`;
  document.head?.append(style);
}

function clearScanHighlights() {
  document.querySelectorAll(`[${SCANNING_ATTR}]`).forEach((post) => {
    delete post.dataset.lfrScanning;
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

  const feed = getFeed();
  if (feed && !feedRootCheckTimer) {
    feedRootCheckTimer = setInterval(() => {
      if (!isLinkedInFeedPage()) {
        teardownFiltering();
        return;
      }

      const currentFeed = getFeed();
      if (currentFeed !== observedFeed) {
        attachFeedObserver();
        applyFeedFilters();
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
    if (getFeed()) {
      clearInterval(feedPollTimer);
      feedPollTimer = null;
      waitForFeed();
    }
  }, 500);
}

function attachFeedObserver() {
  const feed = getFeed();
  if (!feed || feed === observedFeed) return;

  if (feedObserver) feedObserver.disconnect();
  observedFeed = feed;
  feedObserver = new MutationObserver(scheduleApply);
  feedObserver.observe(feed, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// Sidebar widgets — LinkedIn News, Puzzles & ads
// ---------------------------------------------------------------------------

function findSidebarWidget(labelText, contentSelector) {
  const sidebarRoots = [...document.querySelectorAll(SIDEBAR_ROOT_SELECTOR)].filter(isEligibleSidebarRoot);

  for (const root of sidebarRoots) {
    const contentElements = [...root.querySelectorAll(contentSelector)];
    for (const contentEl of contentElements) {
      const widget = findSidebarWidgetFromContent(root, contentEl, labelText);
      if (widget) return widget;
    }
  }

  return null;
}

function findSidebarWidgetFromContent(root, contentEl, labelText) {
  let current = contentEl;
  while (current && current !== root && current !== document.body) {
    if (isReasonableSidebarWidget(current) && getElementText(current).includes(labelText)) {
      return current;
    }
    current = current.parentElement;
  }

  if (isReasonableSidebarWidget(root) && getElementText(root).includes(labelText)) {
    return root;
  }

  return null;
}

function isNarrowSidebarRoot(root) {
  const rect = root.getBoundingClientRect();
  return rect.width > 0 && rect.width <= SIDEBAR_WIDGET_MAX_WIDTH;
}

function isEligibleSidebarRoot(root) {
  return isNarrowSidebarRoot(root) && !isFeedContentRoot(root);
}

function isFeedContentRoot(root) {
  return Boolean(
    root.closest('[data-component-type="LazyColumn"], [role="feed"]') ||
      root.querySelector('[data-activity-urn], .feed-shared-update-v2, .occludable-update')
  );
}

function isReasonableSidebarWidget(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.width <= SIDEBAR_WIDGET_MAX_WIDTH &&
    rect.height > 0 &&
    rect.height <= SIDEBAR_WIDGET_MAX_HEIGHT
  );
}

function findSidebarCardContainer(el) {
  const root = el.closest(SIDEBAR_ROOT_SELECTOR);
  let current = el;

  while (current && current !== root && current !== document.body) {
    const parent = current.parentElement;
    if (!parent || parent === root) return current;
    if (parent.children.length === 1 && isReasonableSidebarWidget(parent)) {
      current = parent;
      continue;
    }
    break;
  }

  return current;
}

function waitForSidebarWidget(labelText, contentSelector, key) {
  const widget = findSidebarWidget(labelText, contentSelector);
  if (widget) {
    applySidebarWidget(widget, key);
    return;
  }

  const poll = setInterval(() => {
    if (!isLinkedInFeedPage()) {
      clearInterval(poll);
      sidebarPollTimers = sidebarPollTimers.filter((timer) => timer !== poll);
      return;
    }
    const widget = findSidebarWidget(labelText, contentSelector);
    if (widget) {
      clearInterval(poll);
      sidebarPollTimers = sidebarPollTimers.filter((timer) => timer !== poll);
      applySidebarWidget(widget, key);
    }
  }, 500);
  sidebarPollTimers.push(poll);
}

function applySidebarWidget(widget, key) {
  const shouldHide =
    (key === 'news' && currentSettings.hideLinkedInNews) ||
    (key === 'puzzles' && currentSettings.hidePuzzles) ||
    (key === 'ad' && currentSettings.hideSidebarAds);

  // The widget element may be nested; find the top-level card container.
  const card = findSidebarCardContainer(widget);

  if (shouldHide) {
    if (card.dataset.lfrHidden === key) {
      // Re-apply in case transparentMode changed
      applyWidgetStyle(card, key);
      return;
    }
    card.dataset.lfrHidden = key;
    applyWidgetStyle(card, key);
  } else {
    if (card.dataset.lfrHidden !== key) return;
    clearWidgetStyle(card);
  }
}

function applySidebarAdWidgets() {
  const adFrames = [...document.querySelectorAll(SIDEBAR_ROOT_SELECTOR)]
    .filter(isEligibleSidebarRoot)
    .flatMap((root) => [...root.querySelectorAll('iframe')].filter(isVisibleElement));

  const activeCards = new Set();

  adFrames.forEach((frame) => {
    const card = findSidebarCardContainer(frame);
    if (!card || !isReasonableSidebarWidget(card)) return;
    activeCards.add(card);
    applySidebarWidget(frame, 'ad');
  });

  [...document.querySelectorAll('[data-lfr-hidden="ad"]')]
    .filter((card) => card.closest(SIDEBAR_ROOT_SELECTOR))
    .forEach((card) => {
      if (activeCards.has(card)) return;
      if (card.querySelector('iframe') && currentSettings.hideSidebarAds) {
        applyWidgetStyle(card, 'ad');
      } else {
        clearWidgetStyle(card);
      }
    });
}

function applySidebarCardFilters() {
  const sidebarCards = getSidebarCards();
  const activeCards = new Set();

  sidebarCards.forEach((card) => {
    const filterKey = getSidebarCardFilterKey(card);
    if (!filterKey) {
      if (SIDEBAR_FILTER_KEYS.has(card.dataset.lfrHidden)) clearWidgetStyle(card);
      return;
    }

    const shouldHide =
      (filterKey === 'suggested' && currentSettings.hideSuggested) ||
      (filterKey === 'promoted' && currentSettings.hidePromoted) ||
      (filterKey === 'promoted-by' && currentSettings.hidePromotedBy);

    if (shouldHide) {
      activeCards.add(card);
      applySidebarFilteredCard(card, filterKey);
      return;
    }

    if (card.dataset.lfrHidden === filterKey) clearWidgetStyle(card);
  });

  [...document.querySelectorAll('[data-lfr-hidden="suggested"], [data-lfr-hidden="promoted"], [data-lfr-hidden="promoted-by"]')]
    .filter((card) => card.closest(SIDEBAR_ROOT_SELECTOR))
    .forEach((card) => {
      if (activeCards.has(card)) return;

      const filterKey = getSidebarCardFilterKey(card);
      const shouldHide =
        (filterKey === 'suggested' && currentSettings.hideSuggested) ||
        (filterKey === 'promoted' && currentSettings.hidePromoted) ||
        (filterKey === 'promoted-by' && currentSettings.hidePromotedBy);

      if (filterKey && shouldHide) {
        applySidebarFilteredCard(card, filterKey);
      } else {
        clearWidgetStyle(card);
      }
    });
}

function getSidebarCards() {
  const sidebarLinks = [...document.querySelectorAll(`${SIDEBAR_ROOT_SELECTOR} a[href]`)].filter((link) => {
    const root = link.closest(SIDEBAR_ROOT_SELECTOR);
    return root && isEligibleSidebarRoot(root);
  });
  return [...new Set(sidebarLinks.map(findCardContainer).filter(Boolean))];
}

function getSidebarCardFilterKey(card) {
  if (hasSidebarCardLabel(card, (label) => label.startsWith('Promoted by'))) return 'promoted-by';
  if (hasSidebarCardLabel(card, (label) => label === 'Promoted')) return 'promoted';
  if (hasSidebarCardLabel(card, (label) => label === 'Suggested' || label.startsWith('Suggested for'))) return 'suggested';
  return null;
}

function hasSidebarCardLabel(card, predicate) {
  return [...card.querySelectorAll('p, span, div')].some((el) => {
    const label = getElementText(el);
    if (!label || label.length > 80) return false;
    return predicate(label);
  });
}

function applySidebarFilteredCard(card, key) {
  card.dataset.lfrHidden = key;
  applyWidgetStyle(card, key);
}

function findCardContainer(el) {
  // Walk up to the largest reasonable sidebar card wrapper, not just the clicked link.
  const root = el.closest(SIDEBAR_ROOT_SELECTOR);
  let current = el;
  let best = el;

  while (current && current !== root && current !== document.body) {
    if (isReasonableSidebarWidget(current)) best = current;

    const parent = current.parentElement;
    if (!parent || parent === root || !isReasonableSidebarWidget(parent)) break;
    current = parent;
  }

  return best;
}

function applyWidgetStyle(element, key) {
  if (key === 'ad') {
    applySidebarAdStyle(element);
    return;
  }

  if (currentSettings.transparentMode) {
    applyTransparentFilterStyle(element, key);
  } else {
    applyHiddenFilterStyle(element);
  }
}

function applySidebarAdStyle(element) {
  if (currentSettings.transparentMode) {
    applyTransparentFilterStyle(element, 'ad');
    return;
  }

  clearFilteredElementStyle(element);
  element.style.opacity = '0';
  element.style.visibility = 'hidden';
  element.style.pointerEvents = 'none';
}

function clearWidgetStyle(element) {
  delete element.dataset.lfrHidden;
  clearFilteredElementStyle(element);
}

// ---------------------------------------------------------------------------
// Feed filter application
// ---------------------------------------------------------------------------

function applyFeedFilters() {
  const posts = getFeedPosts();
  let hasNewPosts = false;

  posts.forEach((post) => {
    if (currentSettings.transparentMode && currentSettings.showScanHighlights && !scannedPosts.has(post)) {
      scannedPosts.add(post);
      post.dataset.lfrScanning = 'true';
      hasNewPosts = true;
    }

    const filterKey = getPostFilterKey(post);
    if (!filterKey) {
      if (POST_FILTER_KEYS.has(post.dataset.lfrHidden)) clearPostStyle(post);
      return;
    }

    const shouldHide =
      (filterKey === 'suggested' && currentSettings.hideSuggested) ||
      (filterKey === 'promoted' && currentSettings.hidePromoted) ||
      (filterKey === 'promoted-by' && currentSettings.hidePromotedBy);

    if (shouldHide) {
      applyHiddenPost(post, filterKey);
      return;
    }

    if (post.dataset.lfrHidden === filterKey) clearPostStyle(post);
  });

  if (hasNewPosts) scheduleScanHighlightClear();
}

function scheduleScanHighlightClear() {
  if (scanClearTimer) clearTimeout(scanClearTimer);
  scanClearTimer = setTimeout(() => {
    scanClearTimer = null;
    document.querySelectorAll(`[${SCANNING_ATTR}]`).forEach((post) => {
      delete post.dataset.lfrScanning;
    });
  }, 450);
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

function getFeedPosts() {
  const feed = getFeed();
  if (feed) return [...feed.children];

  const posts = [];
  const fallbackSelectors = [
    'main article',
    '[role="main"] article',
    'main .feed-shared-update-v2',
    '[role="main"] .feed-shared-update-v2',
    'main .occludable-update',
    '[role="main"] .occludable-update',
    'main [data-activity-urn]',
    '[role="main"] [data-activity-urn]',
    'main [data-id*="urn:li:activity"]',
    '[role="main"] [data-id*="urn:li:activity"]',
    'main [data-urn*="urn:li:activity"]',
    '[role="main"] [data-urn*="urn:li:activity"]',
  ];

  fallbackSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((post) => posts.push(post));
  });

  return [...new Set(posts)].filter(isVisibleElement);
}

function isVisibleElement(el) {
  if (!el || !(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function applyPostStyle(post, type) {
  post.dataset.lfrHidden = type;
  if (currentSettings.transparentMode) {
    applyTransparentFilterStyle(post, type);
  } else {
    applyHiddenFilterStyle(post);
  }
}

function clearPostStyle(post) {
  delete post.dataset.lfrHidden;
  clearFilteredElementStyle(post);
}

function applyTransparentFilterStyle(element, key) {
  const style = FILTER_STYLES[key] || FILTER_STYLES.promoted;
  element.style.display = 'block';
  element.style.transition = '';
  element.style.opacity = '0.4';
  element.style.visibility = '';
  element.style.outline = style.outline;
  element.style.backgroundColor = style.backgroundColor;
  element.style.backgroundImage = '';
  element.style.boxShadow = '';
  element.style.filter = '';
  element.style.pointerEvents = '';
}

function applyHiddenFilterStyle(element) {
  if (!animateFilteredHides || element.style.display === 'none') {
    clearFilteredElementStyle(element);
    element.style.display = 'none';
    return;
  }

  element.style.transition = 'opacity 220ms ease';
  element.style.opacity = element.style.opacity || '1';
  element.style.pointerEvents = 'none';

  requestAnimationFrame(() => {
    element.style.opacity = '0';
  });

  setTimeout(() => {
    if (!currentSettings.transparentMode && element.dataset.lfrHidden) {
      element.style.display = 'none';
    }
  }, 240);
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

function getPostFilterKey(post) {
  if (isSuggestedPost(post)) return 'suggested';
  if (isPromotedByPost(post)) return 'promoted-by';
  if (isPromotedPost(post)) return 'promoted';
  return null;
}

function applyHiddenPost(post, type) {
  if (post.dataset.lfrHidden === type) {
    // Re-apply in case transparentMode changed
    applyPostStyle(post, type);
    return;
  }
  applyPostStyle(post, type);
}

// ---------------------------------------------------------------------------
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
    if (!shouldShowScanHighlights) clearScanHighlights();
    if (shouldShowScanHighlights && !wasShowingScanHighlights) scannedPosts = new WeakSet();
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
