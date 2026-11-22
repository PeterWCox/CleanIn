import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readSettings, type Settings } from "../src/popup/settings";

const sources = ["hideFeed", "hideSidebar"].map((feature) =>
  readFileSync(resolve(`public/features/${feature}.js`), "utf8"),
);

function loadFilters() {
  const context = {
    document,
    location,
    Element,
    Node,
    CSSStyleSheet,
    MutationObserver,
    HTMLVideoElement,
    getComputedStyle,
    setTimeout,
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 16),
    cancelAnimationFrame: clearTimeout,
  };
  for (const source of sources) runInNewContext(source, context);
  return runInNewContext("CleanInFeatures", context) as {
    hideFeed: {
      apply(settings: Settings, animate?: boolean): void;
      clearMediaFilters(): void;
    };
    hideSidebar: { apply(settings: Settings): void };
  };
}

const element = (id: string) => document.getElementById(id)!;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const visible = this.style.display !== "none";
      return new DOMRect(0, 0, visible ? 250 : 0, visible ? 240 : 0);
    },
  );
});

afterEach(() => {
  document.body.replaceChildren();
  document.adoptedStyleSheets = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("keeps simultaneous fade, hide and show choices in the feed after rapid updates", () => {
  vi.useFakeTimers();
  document.body.innerHTML = `<main data-component-type="LazyColumn">
    <article id="suggested"><p>Suggested</p></article>
    <article id="promoted"><p>Promoted</p></article>
    <article id="promoted-by"><p>Promoted by Example</p></article>
  </main>`;
  const { hideFeed } = loadFilters();
  hideFeed.apply(
    readSettings({ filterActions: { hideSuggested: "hide" } }),
    true,
  );
  hideFeed.apply(
    readSettings({
      filterActions: {
        hideSuggested: "fade",
        hidePromoted: "hide",
        hidePromotedBy: "show",
      },
    }),
  );
  vi.advanceTimersByTime(300);
  expect(element("suggested").style.opacity).toBe("0.4");
  expect(element("suggested").style.display).toBe("");
  expect(element("promoted").style.display).toBe("none");
  expect(element("promoted-by").dataset.lfrHidden).toBeUndefined();
});

it("fades media independently and preserves click-to-show for collapsed attachments", () => {
  document.body.innerHTML = `<main data-component-type="LazyColumn">
    <article><p>Example photo</p><figure id="photo"><img src="/feedshare-shrink/photo.jpg"></figure></article>
    <article><p>Example video</p><video id="video"></video></article>
    <article><p>Starting a new position</p><figure id="artwork"><img alt="View celebration image"></figure></article>
  </main>`;
  const { hideFeed } = loadFilters();
  try {
    hideFeed.apply(
      readSettings({
        transparentMode: true,
        filterActions: {
          hidePhotos: "fade",
          hideVideos: "hide",
          hideNewPositionPosts: "show",
        },
      }),
    );
    expect(element("photo").hasAttribute("data-cleanin-faded-media")).toBe(
      true,
    );
    expect(element("video").hasAttribute("data-cleanin-hidden-media")).toBe(
      true,
    );
    expect(element("artwork").hasAttribute("data-cleanin-hidden-media")).toBe(
      false,
    );
    const marker = element("video").previousElementSibling as HTMLElement;
    expect(marker.textContent).toBe("Show video");
    marker.click();
    expect(element("video").hasAttribute("data-cleanin-hidden-media")).toBe(
      false,
    );

    hideFeed.apply(
      readSettings({
        filterActions: { hideNewPositionPosts: "fade", hideVideos: "hide" },
      }),
    );
    expect(element("photo").hasAttribute("data-cleanin-faded-media")).toBe(
      false,
    );
    expect(element("artwork").hasAttribute("data-cleanin-faded-media")).toBe(
      true,
    );
    expect(element("video").previousElementSibling).toBe(marker);
    expect(marker.getAttribute("aria-expanded")).toBe("true");
  } finally {
    hideFeed.clearMediaFilters();
  }
});

it("updates sidebar actions independently even after a widget is hidden", () => {
  document.body.innerHTML = `<aside><div>
    <section id="news">LinkedIn News <a href="/news/story/story/">News item</a></section>
    <section id="puzzles">Today’s puzzles <a href="/games/game/">Game</a></section>
    <section id="ad"><iframe></iframe></section>
  </div></aside>`;
  const { hideSidebar } = loadFilters();
  hideSidebar.apply(
    readSettings({
      filterActions: {
        hideLinkedInNews: "hide",
        hidePuzzles: "fade",
        hideSidebarAds: "show",
      },
    }),
  );
  expect(element("news").style.display).toBe("none");
  expect(element("puzzles").style.opacity).toBe("0.4");
  expect(element("ad").style.visibility).toBe("");

  hideSidebar.apply(
    readSettings({
      filterActions: {
        hideLinkedInNews: "fade",
        hidePuzzles: "show",
        hideSidebarAds: "hide",
      },
    }),
  );
  expect(element("news").style.display).toBe("");
  expect(element("news").style.opacity).toBe("0.4");
  expect(element("puzzles").style.opacity).toBe("");
  expect(element("ad").style.visibility).toBe("hidden");
});
