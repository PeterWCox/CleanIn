import { defaultSettings, type Settings, type SettingsStore } from "./settings";
export type DemoScenario = "normal" | "loading" | "load-error" | "save-error";
export function demoStore(
  scenario: DemoScenario = "normal",
  initial: Partial<Settings> = {},
): SettingsStore {
  let settings = { ...defaultSettings, ...initial };
  let reads = 0;
  const listeners = new Set<() => void>();
  return {
    read: async () => {
      if (scenario === "loading") return new Promise<Settings>(() => {});
      if (scenario === "load-error" && reads++ === 0)
        throw new Error("Unavailable");
      return { ...settings };
    },
    save: async (next) => {
      if (scenario === "save-error") throw new Error("Save failed");
      settings = { ...next };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
