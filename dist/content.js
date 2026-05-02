// CleanIn — content script

const defaultSettings = {
  hideSuggested: true,
  hidePromoted: true,
  hidePromotedBy: true,
  hideLinkedInNews: true,
  hidePuzzles: true,
  transparentMode: false,
};

let currentSettings = { ...defaultSettings };
let feedObserver = null;
let feedInterval = null;
let applyDebounceTimer = null;

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
};

const POST_FILTER_KEYS = new Set(['suggested', 'promoted', 'promoted-by']);

function getFeed() {
  return document.querySelector('[data-component-type="LazyColumn"]');
}

function getPostLabelText(el) {
  return el.textContent.replace(/\s+/g, ' ').trim();
}

function isSuggestedPost(postEl) {
  return [...postEl.querySelectorAll('p')].some((p) => getPostLabelText(p) === 'Suggested');
}

function isPromotedPost(postEl) {
  return [...postEl.querySelectorAll('p')].some((p) => getPostLabelText(p) === 'Promoted');
}

function isPromotedByPost(postEl) {
  return [...postEl.querySelectorAll('p')].some((p) => getPostLabelText(p).startsWith('Promoted by'));
}

function scheduleApply() {
  if (applyDebounceTimer) return;
  applyDebounceTimer = setTimeout(() => {
    applyDebounceTimer = null;
    applyFeedFilters();
    applySidebarWidgets();
  }, 150);
}

function applySidebarWidgets() {
  const newsWidget = findSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]');
  if (newsWidget) applySidebarWidget(newsWidget, 'news');
  const puzzlesWidget = findSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]');
  if (puzzlesWidget) applySidebarWidget(puzzlesWidget, 'puzzles');
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function init() {
  loadSettings().then((settings) => {
    currentSettings = settings;
    waitForFeed();
    waitForSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]', 'news');
    waitForSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]', 'puzzles');
    removeInjectedNavButton();
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
  history.pushState = (...args) => {
    originalPushState(...args);
    setTimeout(init, 300);
  };
  window.addEventListener('popstate', () => setTimeout(init, 300));
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaultSettings, (settings) => {
      resolve(settings);
    });
  });
}

// ---------------------------------------------------------------------------
// Feed container — wait for LazyColumn then observe it
// ---------------------------------------------------------------------------

function waitForFeed() {
  const feed = getFeed();
  if (feed) {
    console.log('[LFR] Feed container found, attaching observer.');
    attachFeedObserver();
    applyFeedFilters();
    return;
  }

  const poll = setInterval(() => {
    if (getFeed()) {
      clearInterval(poll);
      console.log('[LFR] Feed container found (after poll), attaching observer.');
      attachFeedObserver();
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
    applyFeedFilters();
    applySidebarWidgets();
  }, 2000);

  // Apply a few times shortly after attach to handle posts that render
  // asynchronously after the container exists.
  [100, 500, 1500, 3000].forEach((ms) => {
    setTimeout(applyFeedFilters, ms);
  });
}

// ---------------------------------------------------------------------------
// Sidebar widgets — LinkedIn News & Puzzles
// ---------------------------------------------------------------------------

function findSidebarWidget(labelText, contentSelector) {
  const stopEl = document.body;
  const label = [...document.querySelectorAll('p')].find((p) => p.textContent.trim() === labelText);
  if (!label) return null;

  let el = label;
  while (el && el !== stopEl) {
    if (el.querySelector(contentSelector)) {
      return el.parentElement || el;
    }
    el = el.parentElement;
  }
  return null;
}

function waitForSidebarWidget(labelText, contentSelector, key) {
  const widget = findSidebarWidget(labelText, contentSelector);
  if (widget) {
    console.log(`[LFR] Sidebar widget "${labelText}" found.`);
    applySidebarWidget(widget, key);
    return;
  }

  const poll = setInterval(() => {
    const widget = findSidebarWidget(labelText, contentSelector);
    if (widget) {
      clearInterval(poll);
      console.log(`[LFR] Sidebar widget "${labelText}" found (after poll).`);
      applySidebarWidget(widget, key);
    }
  }, 500);
}

function applySidebarWidget(widget, key) {
  const shouldHide =
    (key === 'news' && currentSettings.hideLinkedInNews) ||
    (key === 'puzzles' && currentSettings.hidePuzzles);

  // The widget element may be nested; find the top-level card container.
  const card = findCardContainer(widget);

  if (shouldHide) {
    if (widget.dataset.lfrHidden === key) {
      // Re-apply in case transparentMode changed
      applyWidgetStyle(card, key);
      return;
    }
    console.log(`[LFR] Hiding sidebar widget: ${key}`);
    widget.dataset.lfrHidden = key;
    applyWidgetStyle(card, key);
  } else {
    if (widget.dataset.lfrHidden !== key) return;
    console.log(`[LFR] Showing sidebar widget: ${key}`);
    delete widget.dataset.lfrHidden;
    clearWidgetStyle(card);
  }
}

function findCardContainer(el) {
  // Walk up to find the card wrapper (usually a div with padding, border, shadow).
  let current = el;
  while (current && current !== document.body) {
    const parent = current.parentElement;
    if (!parent) return current;
    // If parent is a generic container (e.g., another div/section), keep walking.
    // Stop when we find a reasonable card boundary (e.g., has siblings that are other cards).
    if (parent.children.length === 1 && parent === current.parentElement) {
      current = parent;
    } else {
      break;
    }
  }
  return current;
}

function applyWidgetStyle(element, key) {
  if (currentSettings.transparentMode) {
    const style = FILTER_STYLES[key] || FILTER_STYLES.promoted;
    element.style.display = 'block';
    element.style.opacity = '0.4';
    element.style.outline = style.outline;
    element.style.backgroundColor = style.backgroundColor;
  } else {
    element.style.display = 'none';
    element.style.opacity = '';
    element.style.outline = '';
    element.style.backgroundColor = '';
  }
}

function clearWidgetStyle(element) {
  element.style.display = '';
  element.style.opacity = '';
  element.style.outline = '';
  element.style.backgroundColor = '';
}

// ---------------------------------------------------------------------------
// Feed filter application
// ---------------------------------------------------------------------------

function applyFeedFilters() {
  const feed = getFeed();
  if (!feed) return;
  const posts = [...feed.children];

  posts.forEach((post) => {
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
}

function applyPostStyle(post, type) {
  post.dataset.lfrHidden = type;
  if (currentSettings.transparentMode) {
    const style = FILTER_STYLES[type] || FILTER_STYLES.promoted;
    post.style.display = 'block';
    post.style.opacity = '0.4';
    post.style.outline = style.outline;
    post.style.backgroundColor = style.backgroundColor;
  } else {
    post.style.display = 'none';
    post.style.opacity = '';
    post.style.outline = '';
    post.style.backgroundColor = '';
  }
}

function clearPostStyle(post) {
  delete post.dataset.lfrHidden;
  post.style.display = '';
  post.style.opacity = '';
  post.style.outline = '';
  post.style.backgroundColor = '';
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
    currentSettings = message.settings;
    applyFeedFilters();

    const newsWidget = findSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]');
    if (newsWidget) applySidebarWidget(newsWidget, 'news');

    const puzzlesWidget = findSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]');
    if (puzzlesWidget) applySidebarWidget(puzzlesWidget, 'puzzles');
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

init();
setupNavigationListener();
