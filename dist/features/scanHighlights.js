globalThis.CleanInFeatures = globalThis.CleanInFeatures || {};

globalThis.CleanInFeatures.scanHighlights = globalThis.CleanInFeatures.scanHighlights || (() => {
  const SCANNING_ATTR = 'data-lfr-scanning';
  let scannedPosts = new WeakSet();
  let clearTimer = null;

  function ensureStyles() {
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

  function markNew(posts, enabled) {
    if (!enabled) return;
    let hasNewPosts = false;
    posts.forEach((post) => {
      if (scannedPosts.has(post)) return;
      scannedPosts.add(post);
      post.dataset.lfrScanning = 'true';
      hasNewPosts = true;
    });
    if (!hasNewPosts) return;
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(clear, 450);
  }

  function clear() {
    clearTimer = null;
    document.querySelectorAll(`[${SCANNING_ATTR}]`).forEach((post) => delete post.dataset.lfrScanning);
  }

  function stop() {
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = null;
    clear();
  }

  function reset() {
    scannedPosts = new WeakSet();
  }

  return { ensureStyles, markNew, reset, stop };
})();
