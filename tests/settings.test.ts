import { describe, it, expect, vi } from "vitest";
import {
  SettingsController,
  defaultSettings,
  readSettings,
  createSettingsStore,
  type Settings,
  type SettingsStore,
} from "../src/popup/settings";
function fixture(initial: Partial<Settings> = {}) {
  let settings = { ...defaultSettings, ...initial };
  const listeners = new Set<() => void>();
  const store: SettingsStore = {
    read: vi.fn(async () => ({ ...settings })),
    save: vi.fn(async (next) => {
      settings = { ...next };
      listeners.forEach((l) => l());
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    store,
    controller: new SettingsController(store),
    external(next: Partial<Settings>) {
      settings = { ...settings, ...next };
      listeners.forEach((l) => l());
    },
  };
}
describe("preferences persistence", () => {
  it("retains defaults and valid legacy values", () => {
    expect(
      readSettings({
        hidePromoted: false,
        hidePromotedBy: true,
        hidePuzzles: false,
        transparentMode: "false",
      }),
    ).toEqual({ ...defaultSettings, hidePromoted: false, hidePuzzles: false });
  });
  it("loads existing values without writing storage", async () => {
    const { controller, store } = fixture({
      hideSuggested: false,
      transparentMode: true,
    });
    await controller.load();
    expect(controller.getSnapshot().settings.hideSuggested).toBe(false);
    expect(controller.getSnapshot().settings.transparentMode).toBe(true);
    expect(store.save).not.toHaveBeenCalled();
  });
  it("queues rapid changes so an older write cannot overwrite a newer one", async () => {
    const { controller, store } = fixture();
    await controller.load();
    let release!: () => void;
    vi.mocked(store.save).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = controller.update({ hideSuggested: false });
    const second = controller.update({ hidePuzzles: false });
    await Promise.resolve();
    expect(store.save).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(store.save).toHaveBeenLastCalledWith({
      ...defaultSettings,
      hideSuggested: false,
      hidePuzzles: false,
    });
    expect(controller.getSnapshot().status).toBe("Saved");
  });
  it("shows a load failure and supports retry", async () => {
    const { controller, store } = fixture();
    vi.mocked(store.read).mockRejectedValueOnce(new Error("Read failed"));
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      loading: false,
      ready: false,
      loadError: true,
    });
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      ready: true,
      loadError: false,
    });
  });
  it("shows save failures and can retry the same preferences", async () => {
    const { controller, store } = fixture();
    await controller.load();
    vi.mocked(store.save).mockRejectedValueOnce(new Error("Quota"));
    await controller.update({ transparentMode: true });
    expect(controller.getSnapshot().saveError).toBe(true);
    await controller.update({});
    expect(controller.getSnapshot().status).toBe("Saved");
    expect(store.save).toHaveBeenLastCalledWith({
      ...defaultSettings,
      transparentMode: true,
    });
  });
  it("continues the save queue after a rejected earlier write", async () => {
    const { controller, store } = fixture();
    await controller.load();
    vi.mocked(store.save).mockRejectedValueOnce(new Error("Offline"));
    await Promise.all([
      controller.update({ hideSuggested: false }),
      controller.update({ hideSidebarAds: false }),
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      status: "Saved",
      saveError: false,
    });
    expect(store.save).toHaveBeenLastCalledWith({
      ...defaultSettings,
      hideSuggested: false,
      hideSidebarAds: false,
    });
  });
  it("reflects sync-storage updates from another popup and unsubscribes", async () => {
    const { controller, external } = fixture();
    const stop = controller.start();
    await Promise.resolve();
    external({ hidePuzzles: false });
    await Promise.resolve();
    expect(controller.getSnapshot().settings.hidePuzzles).toBe(false);
    stop();
    external({ hidePuzzles: true });
    await Promise.resolve();
    expect(controller.getSnapshot().settings.hidePuzzles).toBe(false);
  });
  it("uses the existing Chrome message contract and propagates storage errors", async () => {
    const sendMessage = vi.fn((_message, callback) =>
      callback({ ok: false, error: "Quota exceeded" }),
    );
    vi.stubGlobal("chrome", {
      runtime: { id: "cleanin", sendMessage },
      storage: {
        sync: {
          get: (_defaults: unknown, callback: (s: Settings) => void) =>
            callback(defaultSettings),
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    });
    try {
      const store = createSettingsStore();
      expect(await store.read()).toEqual(defaultSettings);
      await expect(store.save(defaultSettings)).rejects.toThrow(
        "Quota exceeded",
      );
      expect(sendMessage.mock.calls[0][0]).toEqual({
        type: "UPDATE_SETTINGS",
        settings: defaultSettings,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
