globalThis.CleanInFeatures = globalThis.CleanInFeatures || {};

globalThis.CleanInFeatures.hideSidebar = globalThis.CleanInFeatures.hideSidebar || (() => {
  const ROOT_SELECTOR = 'aside, [role="complementary"], .scaffold-layout__aside';
  const MAX_WIDTH = 420;
  const MAX_HEIGHT = 900;
  const FILTER_KEYS = new Set(['suggested', 'promoted', 'promoted-by']);
  const pollTimers = new Set();

  function start(settings) {
    stop();
    apply(settings);
    waitForWidget('LinkedIn News', 'a[href*="/news/story/"]', 'news', settings);
    waitForWidget("Today\u2019s puzzles", 'a[href*="/games/"]', 'puzzles', settings);
  }

  function stop() {
    pollTimers.forEach(clearInterval);
    pollTimers.clear();
  }

  function apply(settings) {
    syncExisting(settings);
    const news = findWidget('LinkedIn News', 'a[href*="/news/story/"]');
    const puzzles = findWidget("Today\u2019s puzzles", 'a[href*="/games/"]');
    if (news) applyWidget(news, 'news', settings);
    if (puzzles) applyWidget(puzzles, 'puzzles', settings);
    applyAds(settings);
    applyCards(settings);
  }

  function waitForWidget(label, selector, key, settings) {
    const timer = setInterval(() => {
      if (!isFeedPage()) {
        clearInterval(timer);
        pollTimers.delete(timer);
        return;
      }
      const widget = findWidget(label, selector);
      if (!widget) return;
      clearInterval(timer);
      pollTimers.delete(timer);
      applyWidget(widget, key, settings);
    }, 500);
    pollTimers.add(timer);
  }

  function findWidget(label, selector) {
    for (const root of roots()) {
      for (const content of root.querySelectorAll(selector)) {
        let current = content;
        while (current && current !== root && current !== document.body) {
          if (reasonable(current) && text(current).includes(label)) return current;
          current = current.parentElement;
        }
        if (reasonable(root) && text(root).includes(label)) return root;
      }
    }
    return null;
  }

  function roots() {
    return [...document.querySelectorAll(ROOT_SELECTOR)].filter((root) => {
      const rect = root.getBoundingClientRect();
      return rect.width > 0 && rect.width <= MAX_WIDTH && !isFeedRoot(root);
    });
  }

  function isFeedRoot(root) {
    return Boolean(root.closest('[data-component-type="LazyColumn"], [role="feed"]') || root.querySelector('[data-activity-urn], .feed-shared-update-v2, .occludable-update'));
  }

  function reasonable(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.width <= MAX_WIDTH && rect.height > 0 && rect.height <= MAX_HEIGHT;
  }

  function isVisibleElement(element) {
    if (!element || !(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function applyWidget(widget, key, settings) {
    const card = cardContainer(widget);
    const shouldHide = (key === 'news' && settings.hideLinkedInNews) || (key === 'puzzles' && settings.hidePuzzles) || (key === 'ad' && settings.hideSidebarAds);
    if (shouldHide) {
      card.dataset.lfrHidden = key;
      style(card, key, settings);
    } else if (card.dataset.lfrHidden === key) {
      clear(card);
    }
  }

  function applyAds(settings) {
    const active = new Set();
    roots().flatMap((root) => [...root.querySelectorAll('iframe')].filter(isVisibleElement)).forEach((frame) => {
      const card = cardContainer(frame);
      if (!card || !reasonable(card)) return;
      active.add(card);
      applyWidget(frame, 'ad', settings);
    });
    document.querySelectorAll('[data-lfr-hidden="ad"]').forEach((card) => {
      if (!card.closest(ROOT_SELECTOR) || active.has(card)) return;
      if (card.querySelector('iframe') && settings.hideSidebarAds) style(card, 'ad', settings);
      else clear(card);
    });
  }

  function applyCards(settings) {
    const active = new Set();
    cards().forEach((card) => {
      const key = filterKey(card);
      if (!key) {
        if (FILTER_KEYS.has(card.dataset.lfrHidden)) clear(card);
        return;
      }
      const shouldHide = (key === 'suggested' && settings.hideSuggested) || (key === 'promoted' && settings.hidePromoted) || (key === 'promoted-by' && settings.hidePromotedBy);
      if (shouldHide) {
        active.add(card);
        card.dataset.lfrHidden = key;
        style(card, key, settings);
      } else if (card.dataset.lfrHidden === key) clear(card);
    });
    document.querySelectorAll('[data-lfr-hidden="suggested"], [data-lfr-hidden="promoted"], [data-lfr-hidden="promoted-by"]').forEach((card) => {
      if (!card.closest(ROOT_SELECTOR) || active.has(card)) return;
      const key = filterKey(card);
      const shouldHide = key && ((key === 'suggested' && settings.hideSuggested) || (key === 'promoted' && settings.hidePromoted) || (key === 'promoted-by' && settings.hidePromotedBy));
      if (shouldHide) style(card, key, settings);
      else clear(card);
    });
  }

  function cards() {
    const sidebarRoots = roots();
    const links = [...document.querySelectorAll(`${ROOT_SELECTOR} a[href]`)].filter((link) => {
      const root = link.closest(ROOT_SELECTOR);
      return root && sidebarRoots.includes(root);
    });
    return [...new Set(links.map(cardContainer).filter(Boolean))];
  }

  function isFeedPage() {
    return location.hostname === 'www.linkedin.com' && (location.pathname === '/' || /^\/feed(?:\/|$)/.test(location.pathname));
  }

  function filterKey(card) {
    if (hasLabel(card, (label) => label.startsWith('Promoted by'))) return 'promoted-by';
    if (hasLabel(card, (label) => label === 'Promoted')) return 'promoted';
    if (hasLabel(card, (label) => label === 'Suggested' || label.startsWith('Suggested for'))) return 'suggested';
    return null;
  }

  function hasLabel(card, predicate) {
    return [...card.querySelectorAll('p, span, div')].some((element) => {
      const label = text(element);
      return label && label.length <= 80 && predicate(label);
    });
  }

  function cardContainer(element) {
    const root = element.closest(ROOT_SELECTOR);
    let current = element;
    let best = element;
    while (current && current !== root && current !== document.body) {
      if (reasonable(current)) best = current;
      const parent = current.parentElement;
      if (!parent || parent === root || !reasonable(parent)) break;
      current = parent;
    }
    return best;
  }

  function syncExisting(settings) {
    document.querySelectorAll('[data-lfr-hidden="news"], [data-lfr-hidden="puzzles"], [data-lfr-hidden="ad"], [data-lfr-hidden="suggested"], [data-lfr-hidden="promoted"], [data-lfr-hidden="promoted-by"]').forEach((card) => {
      if (!card.closest(ROOT_SELECTOR)) return;
      const key = card.dataset.lfrHidden;
      const keep = (key === 'news' && settings.hideLinkedInNews) || (key === 'puzzles' && settings.hidePuzzles) || (key === 'ad' && settings.hideSidebarAds) || (key === 'suggested' && settings.hideSuggested) || (key === 'promoted' && settings.hidePromoted) || (key === 'promoted-by' && settings.hidePromotedBy);
      if (keep) style(card, key, settings);
      else clear(card);
    });
  }

  function style(element, key, settings) {
    if (key === 'ad' && !settings.transparentMode) {
      clearFilteredElementStyle(element);
      element.style.opacity = '0';
      element.style.visibility = 'hidden';
      element.style.pointerEvents = 'none';
      return;
    }
    if (!settings.transparentMode) {
      clearFilteredElementStyle(element);
      element.style.display = 'none';
      return;
    }
    const colors = {
      suggested: ['2px solid rgba(0, 100, 255, 0.4)', 'rgba(0, 100, 255, 0.06)'],
      promoted: ['2px solid rgba(220, 0, 0, 0.4)', 'rgba(220, 0, 0, 0.06)'],
      'promoted-by': ['2px solid rgba(128, 0, 255, 0.4)', 'rgba(128, 0, 255, 0.06)'],
      news: ['2px solid rgba(0, 153, 102, 0.4)', 'rgba(0, 153, 102, 0.06)'],
      puzzles: ['2px solid rgba(204, 122, 0, 0.4)', 'rgba(204, 122, 0, 0.06)'],
      ad: ['2px solid rgba(220, 0, 0, 0.4)', 'rgba(220, 0, 0, 0.06)'],
    }[key];
    element.style.display = 'block';
    element.style.opacity = '0.4';
    element.style.visibility = '';
    element.style.outline = colors[0];
    element.style.backgroundColor = colors[1];
    element.style.pointerEvents = '';
  }

  function clear(element) {
    delete element.dataset.lfrHidden;
    clearFilteredElementStyle(element);
  }

  function text(element) {
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
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

  return { apply, start, stop };
})();
