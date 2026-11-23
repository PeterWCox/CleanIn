globalThis.CleanInFeatures = globalThis.CleanInFeatures || {};
globalThis.CleanInFeatures.getFilterAction = globalThis.CleanInFeatures.getFilterAction || ((settings, key, fadeInTransparentMode = true) => {
  if (!key) return 'show';
  const override = settings.filterActions?.[key];
  if (override === 'show' || override === 'fade' || override === 'hide') return override;
  if (!settings[key]) return 'show';
  return settings.transparentMode && fadeInTransparentMode ? 'fade' : 'hide';
});

globalThis.CleanInFeatures.hideFeed = globalThis.CleanInFeatures.hideFeed || (() => {
  const FILTER_STYLES = {
    suggested: ['2px solid rgba(0, 100, 255, 0.4)', 'rgba(0, 100, 255, 0.06)'],
    promoted: ['2px solid rgba(220, 0, 0, 0.4)', 'rgba(220, 0, 0, 0.06)'],
    'promoted-by': ['2px solid rgba(128, 0, 255, 0.4)', 'rgba(128, 0, 255, 0.06)'],
  };
  const FILTER_KEYS = {
    suggested: 'hideSuggested',
    promoted: 'hidePromoted',
    'promoted-by': 'hidePromotedBy',
  };
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
  const DOCUMENT_SLIDE = 'img:is([src*="/feedshare-document-images"], [src*="/ads-document-images"], [srcset*="/feedshare-document-images"], [srcset*="/ads-document-images"])';
  const DOCUMENT_PREVIEW = 'div:has(> div > button[aria-label="Full screen" i])';
  const EVENT_COVER = 'img:is([src*="/video-liveannouncement-"], [srcset*="/video-liveannouncement-"])';
  const MEDIA = `${PHOTO}, ${VIDEO}, ${PHOTO_TILE}, ${PLAY_VIDEO}, ${CELEBRATION_IMAGE}, ${MORE_PHOTOS_LABEL}, ${DOCUMENT_SLIDE}, ${EVENT_COVER}`;
  const MARKER = 'data-cleanin-media-marker';
  const HIDDEN_MEDIA = 'data-cleanin-hidden-media';
  const FADED_MEDIA = 'data-cleanin-faded-media';
  const markers = new Map();
  const fadedMedia = new Set();
  const postAnimations = new WeakMap();
  let mediaObserver;
  let mediaFrame = null;
  let photoAction = 'show';
  let videoAction = 'show';
  let newPositionAction = 'show';

  function applyMediaFilters(settings) {
    const photos = CleanInFeatures.getFilterAction(settings, 'hidePhotos', false);
    const videos = CleanInFeatures.getFilterAction(settings, 'hideVideos', false);
    const newPositions = CleanInFeatures.getFilterAction(settings, 'hideNewPositionPosts', false);
    if (photos === photoAction && videos === videoAction && newPositions === newPositionAction) return;
    photoAction = photos;
    videoAction = videos;
    newPositionAction = newPositions;

    if ([photos, videos, newPositions].some((action) => action !== 'show')) {
      if (!mediaObserver) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(`
          [${HIDDEN_MEDIA}] { display: none !important; }
          [${FADED_MEDIA}] { opacity: 0.4 !important; }
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
    const filtered = new Map();
    if (videoAction !== 'show') collectMedia(VIDEO, 'video', videoAction, filtered);
    if (photoAction !== 'show') {
      collectDocumentPreviews(filtered);
      collectPhotoGrids(filtered);
      collectMedia(PHOTO, 'photo', photoAction, filtered);
      collectMedia(`:is(figure:has(> ${EVENT_COVER}), ${EVENT_COVER})`, 'photo', photoAction, filtered);
    }
    if (newPositionAction !== 'show') collectNewPositionImages(filtered);

    for (const media of fadedMedia) {
      if (filtered.get(media)?.action === 'fade') continue;
      media.removeAttribute(FADED_MEDIA);
      fadedMedia.delete(media);
    }

    for (const [media, marker] of markers) {
      if (filtered.get(media)?.action === 'hide' && marker.nextSibling === media) continue;
      marker.remove();
      media.removeAttribute(HIDDEN_MEDIA);
      markers.delete(media);
    }

    for (const [media, { label, action }] of filtered) {
      if (action === 'fade') {
        media.setAttribute(FADED_MEDIA, '');
        fadedMedia.add(media);
        continue;
      }
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

  function collectDocumentPreviews(filtered) {
    for (const slide of document.querySelectorAll(DOCUMENT_SLIDE)) {
      const post = slide.closest(FEED_POST);
      const carousel = slide.closest('ul')?.parentElement;
      if (!post || !carousel || !post.contains(carousel)) continue;
      const wrapper = carousel.closest(DOCUMENT_PREVIEW);
      const preview = wrapper && post.contains(wrapper) ? wrapper : carousel;
      filtered.set(preview, { label: 'document', action: photoAction });
    }
  }

  function collectNewPositionImages(filtered) {
    for (const image of document.querySelectorAll(CELEBRATION_IMAGE)) {
      const post = image.closest(FEED_POST);
      if (!post || !hasLabel(post, (label) => label === 'Starting a new position')) continue;
      const artwork = image.closest('figure, picture') ?? image;
      if ([...filtered.keys()].some((attachment) => attachment.contains(artwork))) continue;
      filtered.set(artwork, { label: 'photo', action: newPositionAction });
    }
  }

  function collectPhotoGrids(filtered) {
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
      if (![...grids].some((other) => other !== grid && other.contains(grid))) filtered.set(grid, { label: 'photos', action: photoAction });
    }
  }

  function isPhotoTile(element) {
    return element.matches(PHOTO_TILE) && (element.querySelector(PHOTO_IMAGE) ||
      (element.hostname === location.hostname && element.pathname === location.pathname));
  }

  function collectMedia(selector, label, action, filtered) {
    for (const media of document.querySelectorAll(selector)) {
      const scope = media.parentElement?.closest(MEDIA_SCOPE);
      if (!scope || media.parentElement.closest(selector)) continue;
      const wrapper = getSizedMediaWrapper(media, scope, label === 'video');
      if (![...filtered.keys()].some((attachment) => attachment.contains(wrapper))) filtered.set(wrapper, { label, action });
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

    const animate = animateFilteredHides && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    for (const post of posts) {
      const type = getFilterKey(post);
      const action = CleanInFeatures.getFilterAction(settings, FILTER_KEYS[type]);
      if (action !== 'show') applyPostStyle(post, type, action, animate);
      else if (Object.hasOwn(FILTER_KEYS, post.dataset.lfrHidden)) clearPostStyle(post, animate);
    }
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
    return [...new Set(posts)].filter((post) => Object.hasOwn(FILTER_KEYS, post.dataset.lfrHidden) || isVisible(post));
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

  function applyPostStyle(post, type, action, animate) {
    const currentAnimation = postAnimations.get(post);
    if (currentAnimation?.action === action && post.dataset.lfrHidden === type) return;
    postAnimations.delete(post);
    post.dataset.lfrHidden = type;
    if (action === 'fade') {
      const colors = FILTER_STYLES[type];
      clearStyles(post);
      post.style.opacity = '0.4';
      post.style.outline = colors[0];
      post.style.backgroundColor = colors[1];
      return;
    }

    if (!animate || post.style.display === 'none') {
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
    animatePost(post, action, type, () => {
      post.style.height = '0px';
      post.style.opacity = '0';
    }, () => {
      clearStyles(post);
      post.style.display = 'none';
    });
  }

  function clearPostStyle(post, animate) {
    postAnimations.delete(post);
    delete post.dataset.lfrHidden;
    clearStyles(post);
    if (!animate) return;

    post.style.overflow = 'hidden';
    const height = post.scrollHeight;
    post.style.height = '0px';
    post.style.transition = `height ${FADE_DURATION}ms ease, opacity ${FADE_DURATION}ms ease`;
    post.style.opacity = '0';
    animatePost(post, 'show', undefined, () => {
      post.style.height = `${height}px`;
      post.style.opacity = '1';
    }, () => clearAnimationStyles(post));
  }

  function animatePost(post, action, type, step, finish) {
    const animation = { action };
    postAnimations.set(post, animation);
    const isCurrent = () => postAnimations.get(post) === animation && post.dataset.lfrHidden === type;
    requestAnimationFrame(() => {
      if (isCurrent()) step();
    });
    setTimeout(() => {
      if (!isCurrent()) return;
      postAnimations.delete(post);
      finish();
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
