function watchCleanInBuilds(url, revision) {
  // Unpacked reloads fire onInstalled with the update reason.
  chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason !== "update") return;
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getManifest().content_scripts.flatMap(({ matches }) => matches) });
    await Promise.allSettled(tabs.filter((tab) => tab.id !== undefined).map((tab) => chrome.tabs.reload(tab.id)));
  });

  function connect() {
    const socket = new WebSocket(url);
    socket.addEventListener("message", ({ data }) => {
      if (typeof data === "string" && /^[0-9a-f-]{36}$/.test(data) && data !== revision) {
        chrome.runtime.reload();
      }
    });
    socket.addEventListener("close", () => setTimeout(connect, 1_000), { once: true });
  }

  connect();
}
