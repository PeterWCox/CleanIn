globalThis.CleanInFeatures = globalThis.CleanInFeatures || {};

globalThis.CleanInFeatures.scanHighlights = globalThis.CleanInFeatures.scanHighlights || (() => {
  let scannedPosts = new WeakSet();
  let clearTimer = null;

  const BADGE_ID = 'cleanin-scanning-badge';

  function ensureStyles() {
    if (document.getElementById('cleanin-scan-styles')) return;
    const style = document.createElement('style');
    style.id = 'cleanin-scan-styles';
    style.textContent = `
      #${BADGE_ID} {
        position: fixed !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 2147483647 !important;
        background: rgba(245, 184, 46, 0.92) !important;
        color: #1a1a1a !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 1.2px !important;
        padding: 5px 12px !important;
        border-radius: 4px !important;
        pointer-events: none !important;
        opacity: 0 !important;
        transform: translateY(-4px) !important;
        transition: opacity 180ms ease, transform 180ms ease !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.18) !important;
      }
      #${BADGE_ID}.visible {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }
    `;
    document.head?.append(style);
  }

  function getBadge() {
    let badge = document.getElementById(BADGE_ID);
    if (!badge) {
      badge = document.createElement('div');
      badge.id = BADGE_ID;
      badge.textContent = 'SCANNING';
      document.body?.append(badge);
    }
    return badge;
  }

  function showBadge() {
    getBadge().classList.add('visible');
  }

  function hideBadge() {
    const badge = document.getElementById(BADGE_ID);
    if (badge) badge.classList.remove('visible');
  }

  function markNew(posts, enabled) {
    if (!enabled) return;
    let hasNewPosts = false;
    posts.forEach((post) => {
      if (scannedPosts.has(post)) return;
      scannedPosts.add(post);
      hasNewPosts = true;
    });
    if (!hasNewPosts) return;
    showBadge();
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(hide, 450);
  }

  function hide() {
    clearTimer = null;
    hideBadge();
  }

  function stop() {
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = null;
    hideBadge();
  }

  function reset() {
    scannedPosts = new WeakSet();
  }

  return { ensureStyles, markNew, reset, stop };
})();
