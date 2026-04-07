// LinkedIn Feed Reducer — content script

const defaultSettings = {
  hideSuggested: false,
  hidePromoted: false,
  hideLinkedInNews: false,
  hidePuzzles: false,
};

let currentSettings = { ...defaultSettings };
let feedObserver = null;
let debounceTimer = null;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function init() {
  loadSettings().then((settings) => {
    currentSettings = settings;
    waitForFeed();
    waitForSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]', 'news');
    waitForSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]', 'puzzles');
  });
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
  const feed = document.querySelector('[data-component-type="LazyColumn"]');
  if (feed) {
    console.log('[LFR] Feed container found, attaching observer.');
    observeFeed(feed);
    applyFeedFilters(feed);
    return;
  }

  const poll = setInterval(() => {
    const feed = document.querySelector('[data-component-type="LazyColumn"]');
    if (feed) {
      clearInterval(poll);
      console.log('[LFR] Feed container found (after poll), attaching observer.');
      observeFeed(feed);
      applyFeedFilters(feed);
      // Retry to catch posts that finish rendering after the feed appears
      [500, 1500].forEach((delay) => { setTimeout(() => applyFeedFilters(feed), delay); });
    }
  }, 500);
}

function observeFeed(feed) {
  if (feedObserver) feedObserver.disconnect();

  feedObserver = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFeedFilters(feed), 100);
  });

  // subtree catches content loading inside newly added post skeletons
  feedObserver.observe(feed, { childList: true, subtree: true });
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

  if (shouldHide) {
    if (widget.dataset.lfrHidden === key) return;
    console.log(`[LFR] Hiding sidebar widget: ${key}`);
    widget.dataset.lfrHidden = key;
    widget.style.display = 'none';
  } else {
    if (widget.dataset.lfrHidden !== key) return;
    console.log(`[LFR] Showing sidebar widget: ${key}`);
    delete widget.dataset.lfrHidden;
    widget.style.display = '';
  }
}

// ---------------------------------------------------------------------------
// Feed filter application
// ---------------------------------------------------------------------------

function applyFeedFilters(feed) {
  const posts = feed
    ? [...feed.children]
    : [...(document.querySelector('[data-component-type="LazyColumn"]')?.children ?? [])];

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

function hideSuggestedPost(post) {
  if (post.dataset.lfrHidden === 'suggested') return;
  console.log('[LFR] Hiding suggested post:', post);
  post.dataset.lfrHidden = 'suggested';
  post.style.display = 'none';
}

function showSuggestedPost(post) {
  if (post.dataset.lfrHidden !== 'suggested') return;
  console.log('[LFR] Showing suggested post:', post);
  delete post.dataset.lfrHidden;
  post.style.display = '';
}

function hidePromotedPost(post) {
  if (post.dataset.lfrHidden === 'promoted') return;
  console.log('[LFR] Hiding promoted post:', post);
  post.dataset.lfrHidden = 'promoted';
  post.style.display = 'none';
}

function showPromotedPost(post) {
  if (post.dataset.lfrHidden !== 'promoted') return;
  console.log('[LFR] Showing promoted post:', post);
  delete post.dataset.lfrHidden;
  post.style.display = '';
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
