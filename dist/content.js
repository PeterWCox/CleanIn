// CleanIn — content script

const defaultSettings = {
  hideSuggested: true,
  hidePromoted: true,
  hideLinkedInNews: true,
  hidePuzzles: true,
  transparentMode: true,
};

let currentSettings = { ...defaultSettings };
let feedObserver = null;
let feedInterval = null;
let applyDebounceTimer = null;

function getFeed() {
  return document.querySelector('[data-component-type="LazyColumn"]');
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
  const label = [...document.querySelectorAll('p')].find(
    (p) => p.textContent.trim() === labelText
  );
  if (!label) return null;

  // Walk up until we find the ancestor that contains the widget's content links,
  // then return its parent as the full card wrapper.
  let el = label;
  while (el && el !== document.body) {
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
      applyWidgetStyle(card, 'promoted');
      return;
    }
    console.log(`[LFR] Hiding sidebar widget: ${key}`);
    widget.dataset.lfrHidden = key;
    applyWidgetStyle(card, 'promoted');
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

function applyWidgetStyle(element) {
  if (currentSettings.transparentMode) {
    element.style.display = 'block';
    element.style.opacity = '0.4';
    element.style.outline = '2px solid rgba(220, 0, 0, 0.4)';
    element.style.backgroundColor = 'rgba(220, 0, 0, 0.06)';
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
    if (isSuggestedPost(post)) {
      currentSettings.hideSuggested ? hideSuggestedPost(post) : showSuggestedPost(post);
    }
    if (isPromotedPost(post)) {
      currentSettings.hidePromoted ? hidePromotedPost(post) : showPromotedPost(post);
    }
  });
}

function isSuggestedPost(postEl) {
  return [...postEl.querySelectorAll('p')].some(
    (p) => p.textContent.trim() === 'Suggested'
  );
}

function isPromotedPost(postEl) {
  return [...postEl.querySelectorAll('p')].some(
    (p) => p.textContent.trim() === 'Promoted'
  );
}

function applyPostStyle(post, type) {
  post.dataset.lfrHidden = type;
  if (currentSettings.transparentMode) {
    post.style.display = 'block';
    post.style.opacity = '0.4';
    post.style.outline = type === 'suggested'
      ? '2px solid rgba(0, 100, 255, 0.4)'
      : '2px solid rgba(220, 0, 0, 0.4)';
    post.style.backgroundColor = type === 'suggested'
      ? 'rgba(0, 100, 255, 0.06)'
      : 'rgba(220, 0, 0, 0.06)';
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

function hideSuggestedPost(post) {
  if (post.dataset.lfrHidden === 'suggested') {
    // Re-apply in case transparentMode changed
    applyPostStyle(post, 'suggested');
    return;
  }
  console.log('[LFR] Filtering suggested post:', post);
  applyPostStyle(post, 'suggested');
}

function showSuggestedPost(post) {
  if (post.dataset.lfrHidden !== 'suggested') return;
  console.log('[LFR] Showing suggested post:', post);
  clearPostStyle(post);
}

function hidePromotedPost(post) {
  if (post.dataset.lfrHidden === 'promoted') {
    // Re-apply in case transparentMode changed
    applyPostStyle(post, 'promoted');
    return;
  }
  console.log('[LFR] Filtering promoted post:', post);
  applyPostStyle(post, 'promoted');
}

function showPromotedPost(post) {
  if (post.dataset.lfrHidden !== 'promoted') return;
  console.log('[LFR] Showing promoted post:', post);
  clearPostStyle(post);
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
