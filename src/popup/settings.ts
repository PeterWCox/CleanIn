const filterDefaults = {
  hideSuggested: true,
  hideNewPositionPosts: true,
  hidePromoted: true,
  hidePromotedBy: true,
  hidePhotos: false,
  hideVideos: false,
  hideLinkedInNews: true,
  hidePuzzles: true,
  hideSidebarAds: true,
};
export type FilterKey = keyof typeof filterDefaults;
export type FilterAction = "show" | "fade" | "hide";
type FilterActions = Partial<Record<FilterKey, FilterAction>>;

export const defaultSettings = {
  ...filterDefaults,
  transparentMode: false,
  filterActions: {} as FilterActions,
};
export type Settings = typeof defaultSettings;

function isFilterAction(value: unknown): value is FilterAction {
  return value === "show" || value === "fade" || value === "hide";
}

function isActionMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const filterKeys = Object.keys(filterDefaults) as FilterKey[];

export function readSettings(raw: Record<string, unknown>): Settings {
  const settings: Settings = { ...defaultSettings, filterActions: {} };
  const actions = isActionMap(raw.filterActions) ? raw.filterActions : {};
  for (const key of filterKeys) {
    if (typeof raw[key] === "boolean") settings[key] = raw[key];
    if (isFilterAction(actions[key]))
      settings.filterActions[key] = actions[key];
  }
  if (typeof raw.transparentMode === "boolean")
    settings.transparentMode = raw.transparentMode;
  return settings;
}

export function getFilterAction(
  settings: Settings,
  key: FilterKey,
): FilterAction {
  const override = settings.filterActions[key];
  if (override) return override;
  if (!settings[key]) return "show";
  // Legacy transparent mode only applied to cards, leaving attachments collapsed.
  const attachment =
    key === "hidePhotos" ||
    key === "hideVideos" ||
    key === "hideNewPositionPosts";
  return settings.transparentMode && !attachment ? "fade" : "hide";
}

export function actionPatch(
  settings: Settings,
  key: FilterKey | readonly FilterKey[],
  action: FilterAction,
): Partial<Settings> {
  const filterActions = { ...settings.filterActions };
  const patch: Partial<Settings> = { filterActions };
  for (const filter of typeof key === "string" ? [key] : key) {
    patch[filter] = action !== "show";
    filterActions[filter] = action;
  }
  return patch;
}
export interface SettingsStore {
  read(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
  subscribe(listener: () => void): () => void;
}
export function createSettingsStore(): SettingsStore {
  if (
    typeof chrome !== "undefined" &&
    chrome.storage?.sync &&
    chrome.runtime?.id
  ) {
    return {
      read: () =>
        new Promise((resolve, reject) =>
          chrome.storage.sync.get(defaultSettings, (raw) => {
            const error = chrome.runtime.lastError;
            if (error) reject(new Error(error.message));
            else resolve(readSettings(raw));
          }),
        ),
      save: (settings) =>
        new Promise((resolve, reject) =>
          chrome.runtime.sendMessage(
            { type: "UPDATE_SETTINGS", settings },
            (response) => {
              const error = chrome.runtime.lastError;
              if (error) reject(new Error(error.message));
              else if (!response?.ok)
                reject(
                  new Error(response?.error ?? "Could not save preferences"),
                );
              else resolve();
            },
          ),
        ),
      subscribe: (listener) => {
        const onChanged = (
          changes: Record<string, chrome.storage.StorageChange>,
          area: string,
        ) => {
          if (
            area === "sync" &&
            Object.keys(changes).some((key) => key in defaultSettings)
          )
            listener();
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => chrome.storage.onChanged.removeListener(onChanged);
      },
    };
  }
  // The localhost preview owns separate demo preferences, never extension storage.
  const key = "cleanin-preview-settings";
  return {
    read: async () =>
      readSettings(JSON.parse(localStorage.getItem(key) ?? "{}")),
    save: async (settings) =>
      localStorage.setItem(key, JSON.stringify(settings)),
    subscribe: (listener) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}
export type PreferencesSnapshot = {
  settings: Settings;
  loading: boolean;
  ready: boolean;
  status: string;
  loadError: boolean;
  saveError: boolean;
};
export class SettingsController {
  private snapshot: PreferencesSnapshot = {
    settings: { ...defaultSettings },
    loading: true,
    ready: false,
    status: "",
    loadError: false,
    saveError: false,
  };
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  private revision = 0;
  private loadRevision = 0;
  constructor(private store: SettingsStore) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(patch: Partial<PreferencesSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  start = () => {
    void this.load();
    const unsubscribe = this.store.subscribe(() => {
      if (!this.pending) void this.load(false);
    });
    return () => {
      ++this.loadRevision;
      unsubscribe();
    };
  };
  load = async (initial = true) => {
    const revision = ++this.loadRevision;
    if (initial) this.set({ loading: true, loadError: false, status: "" });
    try {
      const settings = await this.store.read();
      if (revision === this.loadRevision && !this.pending)
        this.set({ settings, loading: false, ready: true, loadError: false });
    } catch {
      if (revision === this.loadRevision)
        this.set({
          loading: false,
          loadError: true,
          status: "Preferences could not be loaded.",
        });
    }
  };
  flush = async (allowFailedSave = false) => {
    await this.queue;
    if (!this.snapshot.ready || this.snapshot.loadError)
      throw new Error("Preferences are not available.");
    if (this.snapshot.saveError && !allowFailedSave)
      throw new Error("Preferences could not be saved.");
  };
  exportData = async (): Promise<Record<string, unknown>> => {
    await this.flush();
    return { ...(await this.store.read()) };
  };
  importData = async (data: Record<string, unknown>) => {
    const entries = Object.entries(data);
    if (
      !entries.length ||
      entries.some(([key, value]) => {
        if (key === "filterActions") {
          return (
            !isActionMap(value) ||
            Object.entries(value).some(
              ([filter, action]) =>
                !Object.hasOwn(filterDefaults, filter) ||
                !isFilterAction(action),
            )
          );
        }
        return (
          !Object.hasOwn(defaultSettings, key) || typeof value !== "boolean"
        );
      })
    )
      throw new Error("Backup contains invalid or unsupported settings.");
    await this.flush(true);
    const current = await this.store.read();
    const filterActions = { ...current.filterActions };
    // Legacy backups replace the settings they include, including their action overrides.
    for (const key of filterKeys) {
      if (Object.hasOwn(data, key)) delete filterActions[key];
    }
    await this.update(readSettings({ ...current, filterActions, ...data }));
    await this.flush();
  };
  update = (patch: Partial<Settings>) => {
    if (!this.snapshot.ready) return Promise.resolve();
    ++this.loadRevision;
    const revision = ++this.revision;
    const settings = { ...this.snapshot.settings, ...patch };
    this.pending++;
    this.set({ settings, status: "Saving…", saveError: false });
    const task = this.queue.then(() => this.store.save(settings));
    this.queue = task.catch(() => {});
    return task
      .then(
        () => {
          if (revision === this.revision)
            this.set({ status: "Saved", saveError: false });
        },
        () => {
          if (revision === this.revision)
            this.set({
              status: "Could not save preferences. Please try again.",
              saveError: true,
            });
        },
      )
      .finally(() => {
        this.pending--;
      });
  };
}
