import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  BackupSection,
  Button,
  ExtensionShell,
  SettingsSection,
  FilterActionField,
  TabsContent,
} from "@petercoxhatesbridges/extension-ui";
import {
  House,
  PanelsTopLeft,
  Settings as SettingsIcon,
  Sparkles,
  Megaphone,
  BriefcaseBusiness,
  Image,
  Video,
  Newspaper,
  Puzzle,
  PanelRight,
} from "lucide-react";
import {
  createSettingsStore,
  SettingsController,
  getFilterAction,
  actionPatch,
  type FilterKey,
  type FilterAction,
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
    description: "Hide suggested/promoted posts from your feed.",
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
    description: "Back up and restore your preferences.",
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
  const row = (
    label: string,
    key: FilterKey,
    icon: React.ReactNode,
    keys: readonly FilterKey[] = [key],
  ) => {
    const value =
      keys
        .map((key) => getFilterAction(state.settings, key))
        .find((action) => action !== "show") ?? "show";
    return (
      <SettingsSection className="cleanin-setting">
        <FilterActionField
          label={label}
          subject={label}
          context={
            activeTab === "sidebar"
              ? "your LinkedIn sidebar"
              : "your LinkedIn feed"
          }
          icon={icon}
          value={value}
          onChange={(action: FilterAction) =>
            void controller.update(actionPatch(state.settings, keys, action))
          }
        />
      </SettingsSection>
    );
  };
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
            {row("Suggested posts", "hideSuggested", <Sparkles />)}
            {row("Promoted posts", "hidePromoted", <Megaphone />, [
              "hidePromoted",
              "hidePromotedBy",
            ])}
            {row(
              "New position images",
              "hideNewPositionPosts",
              <BriefcaseBusiness />,
            )}
            {row("Photos", "hidePhotos", <Image />)}
            {row("Videos", "hideVideos", <Video />)}
          </TabsContent>
          <TabsContent value="sidebar">
            {row("News", "hideLinkedInNews", <Newspaper />)}
            {row("Puzzles", "hidePuzzles", <Puzzle />)}
            {row("Sidebar ads", "hideSidebarAds", <PanelRight />)}
          </TabsContent>
          <TabsContent value="settings">
            <BackupSection
              confirmRestore
              extensionId="cleanin"
              extensionName="CleanIn"
              extensionVersion={extensionVersion}
              exportData={controller.exportData}
              importData={controller.importData}
            />
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
