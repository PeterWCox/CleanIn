const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

const source = readFileSync(
  new URL("../public/background.js", `file://${__filename}`),
  "utf8",
);

function loadWorker({
  tab = {},
  lookupError = false,
  contentScriptPresent = true,
  storageError = false,
} = {}) {
  const listeners = {};
  const calls = { get: 0, ping: [], inject: [], settings: [] };
  const event = (name) => ({
    addListener: (listener) => {
      listeners[name] = listener;
    },
  });
  const chrome = {
    runtime: {
      onInstalled: event("installed"),
      onStartup: event("startup"),
      onMessage: event("message"),
      lastError: undefined,
    },
    storage: {
      sync: {
        remove() {},
        set(settings, callback) {
          calls.settings.push(settings);
          chrome.runtime.lastError = storageError
            ? { message: "Quota exceeded" }
            : undefined;
          callback();
          chrome.runtime.lastError = undefined;
        },
      },
    },
    tabs: {
      onActivated: event("activated"),
      onUpdated: event("updated"),
      get(tabId, callback) {
        calls.get++;
        // Cap the old loop so a regression fails quickly without locking up Node.
        if (calls.get > 10) throw new Error("Unbounded chrome.tabs.get loop");
        setImmediate(() => {
          chrome.runtime.lastError = lookupError
            ? { message: "No tab with id" }
            : undefined;
          callback(tab);
          chrome.runtime.lastError = undefined;
        });
      },
      query(_filter, callback) {
        callback([tab]);
      },
      sendMessage(tabId, message, callback) {
        calls.ping.push({ tabId, message });
        if (!callback) return Promise.resolve();
        chrome.runtime.lastError = contentScriptPresent
          ? undefined
          : { message: "No receiver" };
        callback();
        chrome.runtime.lastError = undefined;
      },
    },
    scripting: {
      executeScript(details) {
        calls.inject.push(details);
        return Promise.resolve();
      },
    },
  };
  vm.runInNewContext(source, { chrome, URL });
  return { listeners, calls };
}

async function settle() {
  // Drain several Chrome-style asynchronous callback turns to detect repeat lookups.
  for (let i = 0; i < 15; i++) await new Promise(setImmediate);
}

test("activating a tab with an unavailable URL stops after one lookup", async () => {
  const { listeners, calls } = loadWorker({ tab: { id: 1 } });
  listeners.activated({ tabId: 1 });
  await settle();
  assert.equal(calls.get, 1);
  assert.equal(calls.ping.length, 0);
});

test("completed tabs without a visible URL do not start lookups", async () => {
  const { listeners, calls } = loadWorker();
  listeners.updated(1, { status: "complete" }, { id: 1 });
  await settle();
  assert.equal(calls.get, 0);
  assert.equal(calls.ping.length, 0);
});

test("a closed tab ends the lookup without messaging or injection", async () => {
  const { listeners, calls } = loadWorker({ lookupError: true });
  listeners.activated({ tabId: 1 });
  await settle();
  assert.equal(calls.get, 1);
  assert.equal(calls.ping.length, 0);
  assert.equal(calls.inject.length, 0);
});

for (const url of [
  "chrome://newtab/",
  "https://example.com/",
  "https://www.linkedin.com/jobs/",
]) {
  test(`activation ignores non-feed URL ${url}`, async () => {
    const { listeners, calls } = loadWorker({ tab: { id: 1, url } });
    listeners.activated({ tabId: 1 });
    await settle();
    assert.equal(calls.get, 1);
    assert.equal(calls.ping.length, 0);
    assert.equal(calls.inject.length, 0);
  });
}

test("LinkedIn activation still injects a missing content script", async () => {
  const { listeners, calls } = loadWorker({
    tab: { id: 1, url: "https://www.linkedin.com/feed/" },
    contentScriptPresent: false,
  });
  listeners.activated({ tabId: 1 });
  await settle();
  assert.equal(calls.get, 1);
  assert.equal(calls.ping.length, 1);
  assert.equal(calls.inject.length, 1);
  assert.deepEqual(Array.from(calls.inject[0].files), [
    "features/hideFeed.js",
    "features/hideSidebar.js",
    "content.js",
  ]);
});

test("LinkedIn navigation with an existing content script does not reinject", async () => {
  const { listeners, calls } = loadWorker();
  listeners.updated(
    1,
    { url: "https://www.linkedin.com/feed/" },
    {
      id: 1,
      url: "https://www.linkedin.com/feed/",
    },
  );
  await settle();
  assert.equal(calls.get, 0);
  assert.equal(calls.ping.length, 1);
  assert.equal(calls.inject.length, 0);
});

test("settings saves acknowledge success and notify content scripts", () => {
  const { listeners, calls } = loadWorker();
  let response;
  assert.equal(
    listeners.message(
      { type: "UPDATE_SETTINGS", settings: { hideSuggested: false } },
      null,
      (value) => {
        response = value;
      },
    ),
    true,
  );
  assert.equal(response.ok, true);
  assert.equal(calls.settings[0].hideSuggested, false);
  assert.equal(calls.ping[0].message.type, "SETTINGS_UPDATED");
});
test("failed settings saves report errors without notifying content scripts", () => {
  const { listeners, calls } = loadWorker({ storageError: true });
  let response;
  listeners.message(
    { type: "UPDATE_SETTINGS", settings: { hideSuggested: false } },
    null,
    (value) => {
      response = value;
    },
  );
  assert.equal(response.ok, false);
  assert.equal(response.error, "Quota exceeded");
  assert.equal(calls.ping.length, 0);
});
