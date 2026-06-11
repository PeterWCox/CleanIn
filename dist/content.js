// CleanIn — content script

const defaultSettings = {
  hideSuggested: true,
  hidePromoted: true,
  hidePromotedBy: true,
  hideLinkedInNews: true,
  hidePuzzles: true,
  hideSidebarAds: true,
  hideSidebarPhrases: [],
  transparentMode: false,
};

let currentSettings = { ...defaultSettings };
let feedObserver = null;
let feedInterval = null;
let feedPollTimer = null;
let applyDebounceTimer = null;
let wakeApplyTimers = [];
let sidebarPollTimers = [];
let lastWakeApplyAt = 0;
let phraseHighlightSignature = null;
let animateFilteredHides = false;

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
  phrase: {
    outline: '2px solid rgba(102, 102, 102, 0.4)',
    backgroundColor: 'rgba(102, 102, 102, 0.06)',
  },
};

const POST_FILTER_KEYS = new Set(['suggested', 'promoted', 'promoted-by', 'phrase']);
const SIDEBAR_FILTER_KEYS = new Set(['suggested', 'promoted', 'promoted-by']);
const SIDEBAR_ROOT_SELECTOR = 'aside, [role="complementary"], .scaffold-layout__aside';
const FEED_PATH_PATTERN = /^\/feed(?:\/|$)/;
const SIDEBAR_WIDGET_MAX_WIDTH = 420;
const SIDEBAR_WIDGET_MAX_HEIGHT = 900;
const PHRASE_HIGHLIGHT_ATTR = 'data-lfr-phrase-highlight';
const PHRASE_HIGHLIGHT_STYLE = {
  backgroundColor: 'rgba(255, 214, 10, 0.45)',
  boxShadow: '0 0 0 2px rgba(255, 214, 10, 0.25)',
  borderRadius: '3px',
  color: 'inherit',
};
const STATUS_MENU_ICON_ATTR = 'data-lfr-status-icon';
const PENCIL_ICON_PATH =
  'M13.62 3.38a2.12 2.12 0 0 0-3 0L3 11v3h3l7.62-7.62a2.12 2.12 0 0 0 0-3M5.17 12H5v-.17l5.04-5.04.17.17zm6.45-6.45-.17.17-.17-.17.17-.17a.12.12 0 0 1 .17.17';

function getFeed() {
  return document.querySelector('[data-component-type="LazyColumn"]');
}

function getPostLabelText(el) {
  return getElementText(el);
}

function getElementText(el) {
  return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
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
  if (applyDebounceTimer) return;
  applyDebounceTimer = setTimeout(() => {
    applyDebounceTimer = null;
    applyAllFilters();
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
    if (document.visibilityState === 'visible') scheduleWakeApply();
  });
  window.addEventListener('focus', scheduleWakeApply);
  window.addEventListener('pageshow', scheduleWakeApply);
}

function applySidebarWidgets() {
  syncExistingHiddenSidebarWidgets();

  const newsWidget = findSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]');
  if (newsWidget) applySidebarWidget(newsWidget, 'news');
  const puzzlesWidget = findSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]');
  if (puzzlesWidget) applySidebarWidget(puzzlesWidget, 'puzzles');
  applySidebarAdWidgets();
  applySidebarCardFilters();
  applySidebarPhraseFilters();
}

function syncExistingHiddenSidebarWidgets() {
  document
    .querySelectorAll('[data-lfr-hidden="news"], [data-lfr-hidden="puzzles"], [data-lfr-hidden="ad"], [data-lfr-hidden="phrase"], [data-lfr-hidden="suggested"], [data-lfr-hidden="promoted"], [data-lfr-hidden="promoted-by"]')
    .forEach((card) => {
      if (!card.closest(SIDEBAR_ROOT_SELECTOR)) return;

      const key = card.dataset.lfrHidden;
      const shouldKeepHidden =
        (key === 'news' && currentSettings.hideLinkedInNews) ||
        (key === 'puzzles' && currentSettings.hidePuzzles) ||
        (key === 'ad' && currentSettings.hideSidebarAds) ||
        (key === 'phrase' && getMatchingSidebarPhrase(card, normalizePhraseList(currentSettings.hideSidebarPhrases))) ||
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

  loadSettings().then((settings) => {
    if (!isLinkedInFeedPage()) return;
    currentSettings = settings;
    waitForFeed();
    waitForSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]', 'news');
    waitForSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]', 'puzzles');
    removeInjectedNavButton();
  });
}

function isLinkedInFeedPage() {
  return location.hostname === 'www.linkedin.com' && (location.pathname === '/' || FEED_PATH_PATTERN.test(location.pathname));
}

function teardownFiltering() {
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }
  if (feedInterval) {
    clearInterval(feedInterval);
    feedInterval = null;
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
  sidebarPollTimers.forEach(clearInterval);
  sidebarPollTimers = [];
  clearFilteredPageStyles();
}

function clearFilteredPageStyles() {
  document.querySelectorAll('[data-lfr-hidden]').forEach((element) => {
    delete element.dataset.lfrHidden;
    delete element.dataset.lfrPhrase;
    delete element.dataset.lfrPhraseScope;
    clearFilteredElementStyle(element);
  });
  clearPhraseHighlights();
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
  history.pushState = (...args) => {
    originalPushState(...args);
    setTimeout(init, 300);
  };
  window.addEventListener('popstate', () => setTimeout(init, 300));
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
    hideSidebarPhrases: normalizePhraseList(settings.hideSidebarPhrases),
  };
}

function normalizePhraseList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((phrase) => String(phrase).trim()).filter(Boolean))];
}

// ---------------------------------------------------------------------------
// Feed container — wait for LazyColumn then observe it
// ---------------------------------------------------------------------------

function waitForFeed() {
  attachFeedObserver();
  applyFeedFilters();

  const feed = getFeed();
  if (feed) {
    console.log('[LFR] Feed observer attached.');
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
      console.log('[LFR] Feed container found (after poll).');
      applyFeedFilters();
    }
  }, 500);
}

function attachFeedObserver() {
  if (feedObserver) feedObserver.disconnect();
  if (feedInterval) clearInterval(feedInterval);

  // Observe the whole document body so we survive LinkedIn replacing
  // the LazyColumn container during SPA navigation / feed refreshes.
  feedObserver = new MutationObserver(scheduleApply);
  feedObserver.observe(document.body, { childList: true, subtree: true });

  // Safety-net interval: catches anything the observer debounce misses.
  feedInterval = setInterval(() => {
    applyAllFilters();
  }, 2000);

  // Apply a few times shortly after attach to handle posts that render
  // asynchronously after the container exists.
  [100, 500, 1500, 3000].forEach((ms) => {
    setTimeout(applyAllFilters, ms);
  });
}

// ---------------------------------------------------------------------------
// Sidebar widgets — LinkedIn News, Puzzles & configured phrases
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
    console.log(`[LFR] Sidebar widget "${labelText}" found.`);
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
      console.log(`[LFR] Sidebar widget "${labelText}" found (after poll).`);
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
    console.log(`[LFR] Hiding sidebar widget: ${key}`);
    card.dataset.lfrHidden = key;
    applyWidgetStyle(card, key);
  } else {
    if (card.dataset.lfrHidden !== key) return;
    console.log(`[LFR] Showing sidebar widget: ${key}`);
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

function applySidebarPhraseFilters() {
  const phrases = normalizePhraseList(currentSettings.hideSidebarPhrases);
  resetPhraseHighlightsIfChanged(phrases);
  const sidebarCards = getSidebarCards();
  const activeCards = new Set();

  sidebarCards.forEach((card) => {
    const matchedPhrase = getMatchingSidebarPhrase(card, phrases);
    if (!matchedPhrase) {
      if (card.dataset.lfrHidden === 'phrase') clearWidgetStyle(card);
      return;
    }

    activeCards.add(card);
    card.dataset.lfrPhrase = matchedPhrase;
    card.dataset.lfrPhraseScope = 'sidebar';
    applySidebarPhraseWidget(card);
  });

  [...document.querySelectorAll('[data-lfr-hidden="phrase"][data-lfr-phrase-scope="sidebar"]')].forEach((card) => {
    if (activeCards.has(card)) return;

    const matchedPhrase = getMatchingSidebarPhrase(card, phrases);
    if (matchedPhrase) {
      card.dataset.lfrPhrase = matchedPhrase;
      applySidebarPhraseWidget(card);
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
  if (card.dataset.lfrHidden !== key) {
    console.log(`[LFR] Filtering sidebar ${key} card:`, card);
  }
  card.dataset.lfrHidden = key;
  applyWidgetStyle(card, key);
}

function getMatchingSidebarPhrase(card, phrases) {
  if (!phrases.length) return null;
  return getMatchingPhrase(getElementText(card), phrases);
}

function applySidebarPhraseWidget(card) {
  if (!card.querySelector(`[${PHRASE_HIGHLIGHT_ATTR}="sidebar"]`)) {
    console.log(`[LFR] Filtering sidebar phrase: ${card.dataset.lfrPhrase}`);
  }
  highlightPhrases(card, normalizePhraseList(currentSettings.hideSidebarPhrases), 'sidebar');
  card.dataset.lfrHidden = 'phrase';
  applyWidgetStyle(card, 'phrase');
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
  delete element.dataset.lfrPhrase;
  delete element.dataset.lfrPhraseScope;
  clearPhraseHighlights(element);
  clearFilteredElementStyle(element);
}

// ---------------------------------------------------------------------------
// Feed filter application
// ---------------------------------------------------------------------------

function applyFeedFilters() {
  const phrases = normalizePhraseList(currentSettings.hideSidebarPhrases);
  const posts = getFeedPosts();

  posts.forEach((post) => {
    const filterKey = getPostFilterKey(post);
    if (!filterKey) {
      if (post.dataset.lfrHidden === 'phrase') return;
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

  applyFeedPhraseFilters(phrases);
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

function applyFeedPhraseFilters(phrases) {
  resetPhraseHighlightsIfChanged(phrases);
  const activeCards = new Set();
  const cardsToFilter = new Set();

  if (phrases.length) {
    const walker = document.createTreeWalker(getFeedPhraseRoot(), NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!getMatchingPhrase(node.nodeValue, phrases)) return NodeFilter.FILTER_REJECT;
        if (shouldIgnorePhraseTextNode(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node) {
      const matchedPhrase = getMatchingPhrase(node.nodeValue, phrases);
      const card = findLinkedInFeedCard(node.parentElement);

      if (card) {
        activeCards.add(card);
        card.dataset.lfrPhrase = matchedPhrase;
        card.dataset.lfrPhraseScope = 'feed';
        cardsToFilter.add(card);
      }

      node = walker.nextNode();
    }
  }

  cardsToFilter.forEach((card) => applyFeedPhrasePost(card, phrases));

  [...document.querySelectorAll('[data-lfr-hidden="phrase"][data-lfr-phrase-scope="feed"]')].forEach((post) => {
    if (!activeCards.has(post)) clearPostStyle(post);
  });
}

function getFeedPhraseRoot() {
  return getFeed() || document.querySelector('main, [role="main"]') || document.body;
}

function applyFeedPhrasePost(card, phrases) {
  if (!card.querySelector(`[${PHRASE_HIGHLIGHT_ATTR}="feed"]`)) {
    console.log(`[LFR] Filtering feed phrase: ${card.dataset.lfrPhrase}`);
  }
  highlightPhrases(card, phrases, 'feed');
  if (isPostFilteredByNonPhrase(card)) return;
  applyPostStyle(card, 'phrase');
}

function isPostFilteredByNonPhrase(post) {
  return post.dataset.lfrHidden && post.dataset.lfrHidden !== 'phrase';
}

function shouldIgnorePhraseTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest('script, style, noscript, svg, nav, header, footer, aside')) return true;
  if (parent.closest('[contenteditable="true"], input, textarea, select')) return true;
  return false;
}

function findLinkedInFeedCard(startEl) {
  let current = startEl;
  while (current && current !== document.body) {
    if (current.dataset?.lfrHidden === 'phrase' && current.dataset.lfrPhraseScope === 'feed') return current;
    if (isLikelyFeedCard(current)) return current;
    current = current.parentElement;
  }
  return null;
}

function isLikelyFeedCard(el) {
  if (!isVisibleElement(el)) return false;
  if (el.closest('aside, nav, header, footer')) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width < 300 || rect.height < 80) return false;
  if (rect.height > Math.max(window.innerHeight * 1.5, 1400)) return false;

  const text = getElementText(el);
  if (text.length < 30 || text.length > 12000) return false;

  if (
    el.matches(
      'article, .feed-shared-update-v2, .occludable-update, [data-activity-urn], [data-id*="urn:li:activity"], [data-urn*="urn:li:activity"]'
    )
  ) {
    return true;
  }

  return hasFeedActionControls(el, text);
}

function hasFeedActionControls(el, text) {
  const lowerText = text.toLowerCase();
  if (/\blike\b/.test(lowerText) && /\b(comment|repost|send)\b/.test(lowerText)) return true;

  return [...el.querySelectorAll('button, a, [role="button"]')].some((control) => {
    const label = `${control.getAttribute('aria-label') || ''} ${getElementText(control)}`.toLowerCase();
    return /\blike\b/.test(label) || /\bcomment\b/.test(label) || /\brepost\b/.test(label) || /\bsend\b/.test(label);
  });
}

function isVisibleElement(el) {
  if (!el || !(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getMatchingPhrase(text, phrases) {
  const normalizedText = normalizeMatchText(text);
  return phrases.find((phrase) => normalizedText.includes(normalizeMatchText(phrase))) || null;
}

function normalizeMatchText(value) {
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function highlightPhrases(root, phrases, scope) {
  const pattern = getPhraseHighlightPattern(phrases);
  if (!pattern) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!pattern.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      pattern.lastIndex = 0;
      if (shouldIgnoreHighlightTextNode(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }

  nodes.forEach((textNode) => wrapPhraseMatches(textNode, pattern, scope));
}

function clearPhraseHighlights(root = document, scope = null) {
  const selector = scope ? `[${PHRASE_HIGHLIGHT_ATTR}="${scope}"]` : `[${PHRASE_HIGHLIGHT_ATTR}]`;
  root.querySelectorAll(selector).forEach((highlight) => {
    const parent = highlight.parentNode;
    if (!parent) return;
    highlight.replaceWith(document.createTextNode(highlight.textContent || ''));
    parent.normalize();
  });
}

function resetPhraseHighlightsIfChanged(phrases) {
  const nextSignature = normalizePhraseList(phrases).map(normalizeMatchText).sort().join('\n');
  if (nextSignature === phraseHighlightSignature) return;
  phraseHighlightSignature = nextSignature;
  clearPhraseHighlights();
}

function shouldIgnoreHighlightTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(`[${PHRASE_HIGHLIGHT_ATTR}]`)) return true;
  if (parent.closest('script, style, noscript, svg')) return true;
  if (parent.closest('[contenteditable="true"], input, textarea, select')) return true;
  return false;
}

function wrapPhraseMatches(textNode, pattern, scope) {
  const text = textNode.nodeValue;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  pattern.lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchText = match[0];
    if (!matchText) continue;

    if (match.index > lastIndex) {
      fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const highlight = document.createElement('mark');
    highlight.setAttribute(PHRASE_HIGHLIGHT_ATTR, scope);
    Object.assign(highlight.style, PHRASE_HIGHLIGHT_STYLE);
    highlight.textContent = matchText;
    fragment.append(highlight);
    lastIndex = match.index + matchText.length;
  }

  if (lastIndex === 0) return;
  if (lastIndex < text.length) fragment.append(document.createTextNode(text.slice(lastIndex)));
  textNode.replaceWith(fragment);
}

function getPhraseHighlightPattern(phrases) {
  const parts = normalizePhraseList(phrases)
    .sort((a, b) => b.length - a.length)
    .map(getPhrasePatternPart);

  if (!parts.length) return null;
  return new RegExp(parts.join('|'), 'giu');
}

function getPhrasePatternPart(phrase) {
  return String(phrase)
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join('\\s+')
    .replace(/'/g, "['\\u2018\\u2019]")
    .replace(/"/g, '["\\u201C\\u201D]');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  delete post.dataset.lfrPhrase;
  delete post.dataset.lfrPhraseScope;
  clearPhraseHighlights(post);
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
  console.log(`[LFR] Filtering ${type} post:`, post);
  applyPostStyle(post, type);
}

// ---------------------------------------------------------------------------
// Message listener — receives SETTINGS_UPDATED from background
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    currentSettings = normalizeSettings(message.settings);
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
