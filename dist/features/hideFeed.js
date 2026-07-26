globalThis.CleanInFeatures = globalThis.CleanInFeatures || {};

globalThis.CleanInFeatures.hideFeed = globalThis.CleanInFeatures.hideFeed || (() => {
  const FILTER_STYLES = {
    suggested: ['2px solid rgba(0, 100, 255, 0.4)', 'rgba(0, 100, 255, 0.06)'],
    promoted: ['2px solid rgba(220, 0, 0, 0.4)', 'rgba(220, 0, 0, 0.06)'],
    'promoted-by': ['2px solid rgba(128, 0, 255, 0.4)', 'rgba(128, 0, 255, 0.06)'],
  };
  const FILTER_KEYS = new Set(['suggested', 'promoted', 'promoted-by']);
  const FADE_DURATION = 220;

  function getFeed() {
    return document.querySelector('[data-component-type="LazyColumn"]');
  }

  function apply(settings, animateFilteredHides) {
    const posts = getPosts();

    posts.forEach((post) => {
      const filterKey = getFilterKey(post);
      if (!filterKey) {
        if (FILTER_KEYS.has(post.dataset.lfrHidden)) clearPostStyle(post, animateFilteredHides);
        return;
      }

      const shouldHide = (filterKey === 'suggested' && settings.hideSuggested) || (filterKey === 'promoted' && settings.hidePromoted) || (filterKey === 'promoted-by' && settings.hidePromotedBy);
      if (shouldHide) applyHiddenPost(post, filterKey, settings, animateFilteredHides);
      else if (post.dataset.lfrHidden === filterKey) clearPostStyle(post, animateFilteredHides);
    });
  }

  function getPosts() {
    const feed = getFeed();
    if (feed) return [...feed.children];

    const posts = [];
    [
      'main article', '[role="main"] article', 'main .feed-shared-update-v2', '[role="main"] .feed-shared-update-v2',
      'main .occludable-update', '[role="main"] .occludable-update', 'main [data-activity-urn]', '[role="main"] [data-activity-urn]',
      'main [data-id*="urn:li:activity"]', '[role="main"] [data-id*="urn:li:activity"]',
      'main [data-urn*="urn:li:activity"]', '[role="main"] [data-urn*="urn:li:activity"]',
    ].forEach((selector) => document.querySelectorAll(selector).forEach((post) => posts.push(post)));
    return [...new Set(posts)].filter(isVisible);
  }

  function getFilterKey(post) {
    if (hasLabel(post, (label) => label === 'Suggested')) return 'suggested';
    if (hasLabel(post, (label) => label.startsWith('Promoted by'))) return 'promoted-by';
    if (hasLabel(post, (label) => label === 'Promoted')) return 'promoted';
    return null;
  }

  function hasLabel(post, predicate) {
    return [...post.querySelectorAll('p, span')].some((element) => {
      const label = text(element);
      return label.length <= 80 && predicate(label);
    });
  }

  function applyHiddenPost(post, type, settings, animateFilteredHides) {
    if (post.dataset.lfrHidden === type) {
      applyPostStyle(post, type, settings, animateFilteredHides);
      return;
    }
    applyPostStyle(post, type, settings, animateFilteredHides);
  }

  function applyPostStyle(post, type, settings, animateFilteredHides) {
    post.dataset.lfrHidden = type;
    if (settings.transparentMode) {
      const colors = FILTER_STYLES[type] || FILTER_STYLES.promoted;
      const shouldAnimate = animateFilteredHides && (post.style.display === 'none' || post.style.opacity !== '0.4');
      post.style.display = 'block';
      post.style.transition = shouldAnimate ? `opacity ${FADE_DURATION}ms ease` : '';
      post.style.opacity = shouldAnimate ? '0' : '0.4';
      if (shouldAnimate) {
        requestAnimationFrame(() => { post.style.opacity = '0.4'; });
        setTimeout(() => clearAnimationStyles(post), FADE_DURATION + 20);
      }
      post.style.visibility = '';
      post.style.outline = colors[0];
      post.style.backgroundColor = colors[1];
      post.style.backgroundImage = '';
      post.style.boxShadow = '';
      post.style.filter = '';
      post.style.pointerEvents = '';
      return;
    }

    if (!animateFilteredHides || post.style.display === 'none') {
      clearStyles(post);
      post.style.display = 'none';
      return;
    }

    const height = post.getBoundingClientRect().height;
    post.style.overflow = 'hidden';
    post.style.height = `${height}px`;
    post.style.transition = `height ${FADE_DURATION}ms ease, opacity ${FADE_DURATION}ms ease`;
    post.style.opacity = post.style.opacity || '1';
    post.style.pointerEvents = 'none';
    requestAnimationFrame(() => {
      post.style.height = '0px';
      post.style.opacity = '0';
    });
    setTimeout(() => {
      if (!settings.transparentMode && post.dataset.lfrHidden) post.style.display = 'none';
    }, FADE_DURATION + 20);
  }

  function clearPostStyle(post, animate) {
    delete post.dataset.lfrHidden;
    if (!animate) {
      clearStyles(post);
      return;
    }

    post.style.display = '';
    post.style.overflow = 'hidden';
    post.style.height = '';
    const height = post.scrollHeight;
    post.style.height = '0px';
    post.style.transition = `height ${FADE_DURATION}ms ease, opacity ${FADE_DURATION}ms ease`;
    post.style.opacity = '0';
    requestAnimationFrame(() => {
      post.style.height = `${height}px`;
      post.style.opacity = '1';
    });
    setTimeout(() => {
      if (!post.dataset.lfrHidden) clearAnimationStyles(post);
    }, FADE_DURATION + 20);
  }

  function clearAnimationStyles(element) {
    element.style.transition = '';
    element.style.opacity = '';
    element.style.height = '';
    element.style.overflow = '';
  }

  function clearStyles(element) {
    element.style.display = '';
    element.style.transition = '';
    element.style.opacity = '';
    element.style.height = '';
    element.style.overflow = '';
    element.style.visibility = '';
    element.style.outline = '';
    element.style.backgroundColor = '';
    element.style.backgroundImage = '';
    element.style.boxShadow = '';
    element.style.filter = '';
    element.style.pointerEvents = '';
  }

  function isVisible(element) {
    if (!element || !(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function text(element) {
    return (element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  return { apply, getFeed };
})();
