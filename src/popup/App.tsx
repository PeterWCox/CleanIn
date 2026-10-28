import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Button,
  ExtensionShell,
  SettingsSection,
  Switch,
  TabsContent,
} from "@petercoxhatesbridges/extension-ui";
import { House, PanelsTopLeft, Settings as SettingsIcon } from "lucide-react";
import {
  createSettingsStore,
  SettingsController,
  type Settings,
  type SettingsStore,
} from "./settings";
import "./popup.css";

declare const __CLEANIN_BETA__: boolean;
declare const __CLEANIN_VERSION__: string;
const tabs = [
  {
    id: "feed",
    label: "Feed",
    icon: <House aria-hidden="true" />,
    description: "Hide suggested and promoted posts from your LinkedIn feed.",
  },
  {
    id: "sidebar",
    label: "Sidebar",
    icon: <PanelsTopLeft aria-hidden="true" />,
    description: "Hide news, puzzles and ads from your LinkedIn sidebar.",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <SettingsIcon aria-hidden="true" />,
    description: "Choose how filtered content appears.",
    secondary: true,
  },
] as const;
type TabId = (typeof tabs)[number]["id"];
export type AppProps = {
  store?: SettingsStore;
  version?: string;
  beta?: boolean;
  initialTab?: TabId;
};
export function App({ store, version, beta, initialTab = "feed" }: AppProps) {
  const controller = useMemo(
    () => new SettingsController(store ?? createSettingsStore()),
    [store],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  useEffect(() => controller.start(), [controller]);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const extensionVersion =
    version ??
    (typeof chrome !== "undefined" && chrome.runtime?.getManifest
      ? chrome.runtime.getManifest().version
      : __CLEANIN_VERSION__);
  const localBuild =
    beta ?? (typeof __CLEANIN_BETA__ !== "undefined" && __CLEANIN_BETA__);
  const toggle = (key: keyof Settings, checked: boolean) => {
    void controller.update({ [key]: checked });
  };
  const row = (
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    help?: string,
  ) => (
    <SettingsSection className="cleanin-setting">
      <div className="cleanin-setting-row">
        <span className="cleanin-setting-title">{label}</span>
        <Switch
          checked={checked}
          onCheckedChange={onChange}
          aria-label={label}
        />
      </div>
      {help && <p className="cleanin-setting-help">{help}</p>}
    </SettingsSection>
  );
  return (
    <ExtensionShell
      className="cleanin-shell"
      branding={{
        name: "CleanIn",
        subtitle: "Hide LinkedIn suggested and promoted posts",
        logo: (
          <img
            className="brand-asset"
            src="/icons/icon128.png"
            alt=""
            aria-hidden="true"
          />
        ),
      }}
      version={extensionVersion}
      beta={localBuild}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(value) => {
        if (tabs.some((tab) => tab.id === value)) setActiveTab(value as TabId);
      }}
      reviewUrl="https://chromewebstore.google.com/detail/cleanin-hide-linkedin-pro/nhnfpheccmajiphgfdehelakpblamgjp/reviews"
      loading={state.loading}
      status={state.status}
    >
      {state.loadError ? (
        <div className="cleanin-error">
          <Button onClick={() => void controller.load()}>
            Retry loading preferences
          </Button>
        </div>
      ) : (
        <>
          <TabsContent value="feed">
            {row(
              "Hide suggested posts",
              state.settings.hideSuggested,
              (checked) => toggle("hideSuggested", checked),
            )}
            {row(
              "Hide promoted posts",
              state.settings.hidePromoted || state.settings.hidePromotedBy,
              (checked) => {
                void controller.update({
                  hidePromoted: checked,
                  hidePromotedBy: checked,
                });
              },
            )}
          </TabsContent>
          <TabsContent value="sidebar">
            {row("Hide news", state.settings.hideLinkedInNews, (checked) =>
              toggle("hideLinkedInNews", checked),
            )}
            {row("Hide puzzles", state.settings.hidePuzzles, (checked) =>
              toggle("hidePuzzles", checked),
            )}
            {row("Hide sidebar ads", state.settings.hideSidebarAds, (checked) =>
              toggle("hideSidebarAds", checked),
            )}
          </TabsContent>
          <TabsContent value="settings">
            {row(
              "Show hidden content as transparent",
              state.settings.transparentMode,
              (checked) => toggle("transparentMode", checked),
              "Dim filtered content instead of removing it.",
            )}
          </TabsContent>
          {state.saveError && (
            <div className="cleanin-error">
              <Button
                variant="outline"
                onClick={() => void controller.update({})}
              >
                Retry saving preferences
              </Button>
            </div>
          )}
        </>
      )}
    </ExtensionShell>
  );
}
