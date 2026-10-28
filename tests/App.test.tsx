import { afterEach, it, expect } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/popup/App";
import { demoStore } from "../src/popup/demoStore";
afterEach(cleanup);
it("preserves all six controls across tabs with fixed version and footer", async () => {
  const view = render(<App store={demoStore()} version="1.5.2" beta />);
  const user = userEvent.setup();
  await waitFor(() => expect(view.getAllByRole("switch")).toHaveLength(2));
  expect(
    view
      .getByRole("switch", { name: "Hide suggested posts" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  await user.click(view.getByRole("switch", { name: "Hide suggested posts" }));
  await waitFor(() => expect(view.getByText("Saved")).toBeDefined());
  await user.click(view.getByRole("tab", { name: "Sidebar" }));
  expect(view.getAllByRole("switch")).toHaveLength(3);
  for (const name of ["Hide news", "Hide puzzles", "Hide sidebar ads"]) {
    await user.click(view.getByRole("switch", { name }));
    await waitFor(() =>
      expect(
        view.getByRole("switch", { name }).getAttribute("aria-checked"),
      ).toBe("false"),
    );
  }
  await user.click(view.getByRole("tab", { name: "Settings" }));
  const transparent = view.getByRole("switch", {
    name: "Show hidden content as transparent",
  });
  expect(transparent.getAttribute("aria-checked")).toBe("false");
  await user.click(transparent);
  await waitFor(() =>
    expect(transparent.getAttribute("aria-checked")).toBe("true"),
  );
  expect(view.getByText("v1.5.2")).toBeDefined();
  expect(view.getByLabelText("Beta build")).toBeDefined();
  expect(
    view.getByRole("link", { name: "Review" }).getAttribute("href"),
  ).toContain("nhnfpheccmajiphgfdehelakpblamgjp");
  expect(
    view.getByRole("link", { name: "About me" }).getAttribute("href"),
  ).toBe("https://www.linkedin.com/in/peter-w-cox");
  await user.click(view.getByRole("tab", { name: "Feed" }));
  expect(
    view
      .getByRole("switch", { name: "Hide suggested posts" })
      .getAttribute("aria-checked"),
  ).toBe("false");
});
it("combines legacy promoted flags only when the promoted control changes", async () => {
  const store = demoStore("normal", {
    hidePromoted: false,
    hidePromotedBy: true,
  });
  const view = render(<App store={store} />);
  const user = userEvent.setup();
  const promoted = await view.findByRole("switch", {
    name: "Hide promoted posts",
  });
  expect(promoted.getAttribute("aria-checked")).toBe("true");
  await user.click(view.getByRole("switch", { name: "Hide suggested posts" }));
  await waitFor(() => expect(view.getByText("Saved")).toBeDefined());
  expect(await store.read()).toMatchObject({
    hidePromoted: false,
    hidePromotedBy: true,
  });
  await user.click(promoted);
  await waitFor(() =>
    expect(promoted.getAttribute("aria-checked")).toBe("false"),
  );
  await waitFor(async () =>
    expect(await store.read()).toMatchObject({
      hidePromoted: false,
      hidePromotedBy: false,
    }),
  );
});
it("supports load and save retries", async () => {
  const view = render(<App store={demoStore("load-error")} />);
  await userEvent.click(
    await view.findByRole("button", { name: "Retry loading preferences" }),
  );
  expect(
    await view.findByRole("switch", { name: "Hide suggested posts" }),
  ).toBeDefined();
  view.unmount();
  const failed = render(<App store={demoStore("save-error")} />);
  await userEvent.click(
    await failed.findByRole("switch", { name: "Hide suggested posts" }),
  );
  expect(
    await failed.findByRole("button", { name: "Retry saving preferences" }),
  ).toBeDefined();
});
