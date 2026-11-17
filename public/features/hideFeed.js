globalThis.CleanInFeatures = globalThis.CleanInFeatures || {};

globalThis.CleanInFeatures.hideFeed = globalThis.CleanInFeatures.hideFeed || (() => {
  const FILTER_STYLES = {
    suggested: ['2px solid rgba(0, 100, 255, 0.4)', 'rgba(0, 100, 255, 0.06)'],
    promoted: ['2px solid rgba(220, 0, 0, 0.4)', 'rgba(220, 0, 0, 0.06)'],
    'promoted-by': ['2px solid rgba(128, 0, 255, 0.4)', 'rgba(128, 0, 255, 0.06)'],
  };
  const FILTER_KEYS = new Set(['suggested', 'promoted', 'promoted-by']);
  const FADE_DURATION = 220;
  const FEED_POST = ':is([data-component-type="LazyColumn"] > *, main article, [role="main"] article, .feed-shared-update-v2, .occludable-update, [data-activity-urn], [data-id*="urn:li:activity"], [data-urn*="urn:li:activity"])';
  const PHOTO_IMAGE = `:is(${[
    'img:is([src*="/feedshare-shrink"], [src*="/feedshare-image-"], [srcset*="/feedshare-shrink"], [srcset*="/feedshare-image-"])',
    'img[alt="View image" i]:is([src*="/image-shrink_"], [srcset*="/image-shrink_"])',
  ].join(', ')})`;
  const PHOTO = `:is(.update-components-image, .feed-shared-image, a:has(> figure > ${PHOTO_IMAGE}), figure:has(> ${PHOTO_IMAGE}), picture:has(> ${PHOTO_IMAGE}), ${PHOTO_IMAGE})`;
  const VIDEO_POSTER = 'img:is([src*="/videocover-"], [srcset*="/videocover-"])';
  const VIDEO = `:is(.update-components-video, .feed-shared-video, [role="region"][aria-label="Video Player" i], video, picture:has(> ${VIDEO_POSTER}), ${VIDEO_POSTER})`;
  const MEDIA_SCOPE = `${FEED_POST}, .comments-comment-item, .comments-comment-entity, main, [role="main"], [role="dialog"]`;
  const PHOTO_TILE = 'a:has(> figure img)';
  const MORE_PHOTOS_LABEL = ':is([aria-label$="more image" i], [aria-label$="more images" i])';
  const MORE_PHOTOS = `a:is(${MORE_PHOTOS_LABEL}, :has(> ${MORE_PHOTOS_LABEL}))`;
  const PLAY_VIDEO = 'button[aria-label="Play video" i]';
  const CELEBRATION_IMAGE = 'img[alt="View celebration image" i]';
  const MEDIA = `${PHOTO}, ${VIDEO}, ${PHOTO_TILE}, ${PLAY_VIDEO}, ${CELEBRATION_IMAGE}, ${MORE_PHOTOS_LABEL}`;
  const MARKER = 'data-cleanin-media-marker';
  const HIDDEN_MEDIA = 'data-cleanin-hidden-media';
  const markers = new Map();
  let mediaObserver;
  let mediaFrame = null;
  let filterPhotos = false;
  let filterVideos = false;
  let filterNewPositionImages = false;

  function applyMediaFilters({ hidePhotos = false, hideVideos = false, hideNewPositionPosts = false }) {
    if (hidePhotos === filterPhotos && hideVideos === filterVideos && hideNewPositionPosts === filterNewPositionImages) return;
    filterPhotos = hidePhotos;
    filterVideos = hideVideos;
    filterNewPositionImages = hideNewPositionPosts;

    if (hidePhotos || hideVideos || hideNewPositionPosts) {
      if (!mediaObserver) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(`
          [${HIDDEN_MEDIA}] { display: none !important; }
          [${MARKER}] {
            display: inline-grid;
            place-items: center;
            box-sizing: border-box;
            inline-size: 56px;
            block-size: 56px;
            margin: 4px 8px;
            padding: 4px;
            border: 1px solid;
            border-radius: 6px;
            font: 600 11px/1.2 system-ui, sans-serif;
            text-align: center;
            background: Canvas;
            color: CanvasText;
            cursor: pointer;
          }
          [${MARKER}]:hover { background: ButtonFace; }
          [${MARKER}]:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
          [${MARKER}][aria-expanded="true"] { inline-size: auto; block-size: auto; }
        `);
        document.adoptedStyleSheets.push(sheet);
        mediaObserver = new MutationObserver((records) => {
          if (mediaFrame !== null || !records.some(affectsMedia)) return;
          mediaFrame = requestAnimationFrame(() => {
            mediaFrame = null;
            updateMediaMarkers();
          });
        });
      }
      mediaObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'aria-label', 'alt'],
      });
    } else {
      mediaObserver?.disconnect();
      if (mediaFrame !== null) cancelAnimationFrame(mediaFrame);
      mediaFrame = null;
    }

    updateMediaMarkers();
  }

  function affectsMedia(record) {
    if (record.type === 'attributes') {
      return record.target.matches(`img, [role="region"], button, ${MORE_PHOTOS_LABEL}`) && !record.target.hasAttribute(MARKER);
    }
    if ([...record.removedNodes].some((node) => node instanceof Element && node.hasAttribute(MARKER))) return true;
    return [...record.addedNodes, ...record.removedNodes].some((node) =>
      node instanceof Element && (node.matches(MEDIA) || node.querySelector(MEDIA))
    );
  }

  function updateMediaMarkers() {
    const hidden = new Map();
    if (filterVideos) collectMedia(VIDEO, 'video', hidden);
    if (filterPhotos) {
      collectPhotoGrids(hidden);
      collectMedia(PHOTO, 'photo', hidden);
    }
    if (filterNewPositionImages) collectNewPositionImages(hidden);

    for (const [media, marker] of markers) {
      if (hidden.has(media) && marker.nextSibling === media) continue;
      marker.remove();
      media.removeAttribute(HIDDEN_MEDIA);
      markers.delete(media);
    }

    for (const [media, label] of hidden) {
      if (markers.has(media)) continue;
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.setAttribute(MARKER, '');
      marker.setAttribute('aria-expanded', 'false');
      marker.textContent = `Show ${label}`;
      marker.addEventListener('click', (event) => {
        event.stopPropagation();
        const expanded = media.hasAttribute(HIDDEN_MEDIA);
        if (!expanded && label === 'video') {
          if (media instanceof HTMLVideoElement) media.pause();
          else media.querySelectorAll('video').forEach((video) => video.pause());
        }
        media.toggleAttribute(HIDDEN_MEDIA, !expanded);
        marker.setAttribute('aria-expanded', String(expanded));
        marker.textContent = `${expanded ? 'Hide' : 'Show'} ${label}`;
      });
      media.before(marker);
      media.setAttribute(HIDDEN_MEDIA, '');
      markers.set(media, marker);
    }
  }

  function collectNewPositionImages(hidden) {
    for (const image of document.querySelectorAll(CELEBRATION_IMAGE)) {
      const post = image.closest(FEED_POST);
      if (!post || !hasLabel(post, (label) => label === 'Starting a new position')) continue;
      const artwork = image.closest('figure, picture') ?? image;
      if ([...hidden.keys()].some((attachment) => attachment.contains(artwork))) continue;
      hidden.set(artwork, 'photo');
    }
  }

  function collectPhotoGrids(hidden) {
    const grids = new Set();
    for (const tile of document.querySelectorAll(PHOTO_TILE)) {
      if (!isPhotoTile(tile)) continue;
      const scope = tile.parentElement?.closest(MEDIA_SCOPE);
      let grid;
      for (let parent = tile.parentElement;
        scope && parent && parent !== scope && parent.matches('div:not([role])');
        parent = parent.parentElement) {
        if (parent.querySelector(VIDEO)) break;
        const textBlocks = parent.querySelectorAll('p, h1, h2, h3');
        if ([...textBlocks].some((block) => !block.closest(MORE_PHOTOS))) break;
        if ([...parent.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) break;
        const branches = [...parent.children].filter((child) => !child.hasAttribute(MARKER));
        if (!branches.every((child) => isPhotoTile(child) || child.matches(MORE_PHOTOS) ||
          [...child.querySelectorAll(PHOTO_TILE)].some(isPhotoTile))) break;
        const tiles = [...parent.querySelectorAll(PHOTO_TILE)].filter(isPhotoTile);
        if (tiles.length > 1) grid = parent;
      }
      if (grid) grids.add(grid);
    }
    for (const grid of grids) {
      if (![...grids].some((other) => other !== grid && other.contains(grid))) hidden.set(grid, 'photos');
    }
  }

  function isPhotoTile(element) {
    return element.matches(PHOTO_TILE) && (element.querySelector(PHOTO_IMAGE) ||
      (element.hostname === location.hostname && element.pathname === location.pathname));
  }

  function collectMedia(selector, label, hidden) {
    for (const media of document.querySelectorAll(selector)) {
      const scope = media.parentElement?.closest(MEDIA_SCOPE);
      if (!scope || media.parentElement.closest(selector)) continue;
      const wrapper = getSizedMediaWrapper(media, scope, label === 'video');
      if (![...hidden.keys()].some((attachment) => attachment.contains(wrapper))) hidden.set(wrapper, label);
    }
  }

  function getSizedMediaWrapper(media, scope, isVideo) {
    let wrapper = media;
    for (let child = media, parent = media.parentElement;
      parent && parent !== scope && parent.matches('div:not([role])');
      child = parent, parent = parent.parentElement) {
      // Only climb through wrappers dedicated to this attachment.
      const siblings = [...parent.children].filter((element) => element !== child && !element.hasAttribute(MARKER));
      const hasPlayOverlay = isVideo && siblings.length > 0 && siblings.every((element) => element.matches(PLAY_VIDEO));
      if (siblings.length && !hasPlayOverlay) break;
      if ([...parent.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) break;

      const style = getComputedStyle(parent);
      if (hasPlayOverlay || (isVideo && markers.has(parent)) ||
          style.aspectRatio !== 'auto' || parent.style.height || parent.style.blockSize ||
          parseFloat(style.minHeight) > 0 || parseFloat(style.paddingBottom) > 0) {
        wrapper = parent;
      }
    }
    return wrapper;
  }

  function getFeed() {
    return document.querySelector('[data-component-type="LazyColumn"]');
  }

  function apply(settings, animateFilteredHides) {
    applyMediaFilters(settings);
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
    return [...new Set(posts)].filter((post) => FILTER_KEYS.has(post.dataset.lfrHidden) || isVisible(post));
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
      clearAnimationStyles(post);
      post.style.display = 'block';
      post.style.opacity = '0.4';
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

  return { apply, getFeed, clearMediaFilters: () => applyMediaFilters({}) };
})();
