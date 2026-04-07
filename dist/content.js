// LinkedIn Feed Reducer — content script

const defaultSettings = {
  hideSuggested: false,
  hidePromoted: false,
  hideLinkedInNews: false,
  hidePuzzles: false,
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
    if (!document.getElementById(ACCORDION_ID)) {
      const list = findNavList();
      if (list) injectAccordion(list);
    }
  }, 150);
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
    waitForSortBar();
  });
}

// ---------------------------------------------------------------------------
// In-page settings accordion (injected below the "Sort by" bar)
// ---------------------------------------------------------------------------

const ACCORDION_ID = 'lfr-accordion';

function findNavList() {
  const nav = document.querySelector('nav[componentkey="primaryNavLinksComponentRef"]');
  return nav ? nav.querySelector('ul') : null;
}

function waitForSortBar() {
  if (document.getElementById(ACCORDION_ID)) {
    syncAccordionUI();
    return;
  }
  const list = findNavList();
  if (list) {
    injectAccordion(list);
    return;
  }
  const poll = setInterval(() => {
    if (document.getElementById(ACCORDION_ID)) {
      clearInterval(poll);
      return;
    }
    const list = findNavList();
    if (list) {
      clearInterval(poll);
      injectAccordion(list);
    }
  }, 500);
}

const ACCORDION_FIELDS = [
  { key: 'hideSuggested', label: 'Hide Suggested' },
  { key: 'hidePromoted', label: 'Hide Promoted' },
  { key: 'hideLinkedInNews', label: 'Hide LinkedIn News' },
  { key: 'hidePuzzles', label: 'Hide Puzzles' },
];

function injectAccordion(navList) {
  if (document.getElementById(ACCORDION_ID)) return;

  // Clone an existing nav <li> so our button inherits LinkedIn's styling.
  const sample = navList.querySelector('li');
  const li = sample
    ? sample.cloneNode(false)
    : document.createElement('li');
  li.id = ACCORDION_ID;

  li.innerHTML = `
    <style>
      #${ACCORDION_ID} {
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #${ACCORDION_ID} .lfr-navbtn {
        display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 8px 12px; background: transparent; border: 0;
        color: rgba(0,0,0,0.6); font: inherit; font-size: 12px; cursor: pointer;
        border-radius: 4px;
      }
      #${ACCORDION_ID} .lfr-navbtn:hover { color: rgba(0,0,0,0.9); background: rgba(0,0,0,0.04); }
      #${ACCORDION_ID} .lfr-navbtn svg { width: 24px; height: 24px; }
      #${ACCORDION_ID} .lfr-popover {
        display: none; position: absolute; top: 100%; right: 0; z-index: 9999;
        margin-top: 6px; width: 280px;
        background: #fff; border: 1px solid #e0e0e0; border-radius: 10px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.12);
        font-size: 14px; color: #1d1d1f; padding: 14px;
      }
      #${ACCORDION_ID}.lfr-open .lfr-popover { display: block; }
      #${ACCORDION_ID} .lfr-title {
        font-weight: 600; margin-bottom: 8px;
      }
      #${ACCORDION_ID} .lfr-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 0;
      }
      #${ACCORDION_ID} .lfr-row + .lfr-row { border-top: 1px solid #f0f0f2; }
      #${ACCORDION_ID} .lfr-chips { display: flex; gap: 6px; margin-top: 10px; }
      #${ACCORDION_ID} .lfr-chip {
        flex: 1; appearance: none; border: 1px solid #d1d1d6;
        background: #fff; color: #1d1d1f; font: inherit; font-weight: 500;
        padding: 6px 10px; border-radius: 999px; cursor: pointer;
      }
      #${ACCORDION_ID} .lfr-chip.lfr-active {
        background: #0a66c2; border-color: #0a66c2; color: #fff;
      }
      #${ACCORDION_ID} input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
      #${ACCORDION_ID} .lfr-section-label {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
        color: #6e6e73; margin-top: 12px; margin-bottom: 4px; font-weight: 600;
      }
    </style>
    <button type="button" class="lfr-navbtn" aria-label="Feed Reducer" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 5h18v2H3zm3 6h12v2H6zm4 6h4v2h-4z"/>
      </svg>
      <span>Reducer</span>
    </button>
    <div class="lfr-popover" role="dialog" aria-label="Feed Reducer settings">
      <div class="lfr-title">Feed Reducer</div>
      ${ACCORDION_FIELDS.map(
        (f) => `
        <label class="lfr-row">
          <span>${f.label}</span>
          <input type="checkbox" data-lfr-key="${f.key}" />
        </label>`
      ).join('')}
      <div class="lfr-section-label">Display Mode</div>
      <div class="lfr-chips">
        <button type="button" class="lfr-chip" data-lfr-mode="transparent">Transparent</button>
        <button type="button" class="lfr-chip" data-lfr-mode="hidden">Hidden</button>
      </div>
    </div>
  `;

  // Insert before the "Me" item if found, otherwise append.
  const meItem = [...navList.querySelectorAll('li')].find((el) =>
    /^\s*Me\b/.test(el.textContent || '')
  );
  if (meItem) {
    navList.insertBefore(li, meItem);
  } else {
    navList.appendChild(li);
  }

  const btn = li.querySelector('.lfr-navbtn');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = li.classList.toggle('lfr-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    if (!li.contains(e.target)) {
      li.classList.remove('lfr-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  const wrapper = li;

  wrapper.querySelectorAll('input[data-lfr-key]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.lfrKey;
      currentSettings = { ...currentSettings, [key]: input.checked };
      persistAndApply();
    });
  });

  wrapper.querySelectorAll('.lfr-chip[data-lfr-mode]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const transparent = chip.dataset.lfrMode === 'transparent';
      if (currentSettings.transparentMode === transparent) return;
      currentSettings = { ...currentSettings, transparentMode: transparent };
      persistAndApply();
    });
  });

  syncAccordionUI();
}

function syncAccordionUI() {
  const root = document.getElementById(ACCORDION_ID);
  if (!root) return;
  root.querySelectorAll('input[data-lfr-key]').forEach((input) => {
    input.checked = !!currentSettings[input.dataset.lfrKey];
  });
  root.querySelectorAll('.lfr-chip[data-lfr-mode]').forEach((chip) => {
    const active =
      (chip.dataset.lfrMode === 'transparent' && currentSettings.transparentMode) ||
      (chip.dataset.lfrMode === 'hidden' && !currentSettings.transparentMode);
    chip.classList.toggle('lfr-active', active);
  });
}

function persistAndApply() {
  chrome.storage.sync.set(currentSettings);
  applyFeedFilters();
  const newsWidget = findSidebarWidget('LinkedIn News', 'a[href*="/news/story/"]');
  if (newsWidget) applySidebarWidget(newsWidget, 'news');
  const puzzlesWidget = findSidebarWidget("Today\u2019s puzzles", 'a[href*="/games/"]');
  if (puzzlesWidget) applySidebarWidget(puzzlesWidget, 'puzzles');
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
  feedInterval = setInterval(applyFeedFilters, 2000);

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
    syncAccordionUI();
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

init();
setupNavigationListener();
