import { afterEach, it, expect } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/popup/App";
import { demoStore } from "../src/popup/demoStore";
afterEach(cleanup);
function selectValue(element: HTMLElement) {
  if (!(element instanceof HTMLSelectElement))
    throw new Error("Expected select");
  return element.value;
}
it("shows the feed, sidebar, and settings controls with a fixed version and footer", async () => {
  const view = render(<App store={demoStore()} version="1.5.2" beta />);
  const user = userEvent.setup();
  await waitFor(() => expect(view.getAllByRole("combobox")).toHaveLength(5));
  expect(
    selectValue(view.getByRole("combobox", { name: "Suggested posts" })),
  ).toBe("hide");
  await user.selectOptions(
    view.getByRole("combobox", { name: "Suggested posts" }),
    "show",
  );
  await waitFor(() => expect(view.getByText("Saved")).toBeDefined());
  await user.click(view.getByRole("tab", { name: "Sidebar" }));
  expect(view.getAllByRole("combobox")).toHaveLength(3);
  for (const name of ["News", "Puzzles", "Sidebar ads"]) {
    await user.selectOptions(view.getByRole("combobox", { name }), "show");
    await waitFor(() =>
      expect(selectValue(view.getByRole("combobox", { name }))).toBe("show"),
    );
  }
  await user.click(view.getByRole("tab", { name: "Settings" }));
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
    selectValue(view.getByRole("combobox", { name: "Suggested posts" })),
  ).toBe("show");
});
it("combines legacy promoted flags only when the promoted control changes", async () => {
  const store = demoStore("normal", {
    hidePromoted: false,
    hidePromotedBy: true,
  });
  const view = render(<App store={store} />);
  const user = userEvent.setup();
  const promoted = await view.findByRole("combobox", {
    name: "Promoted posts",
  });
  expect(selectValue(promoted)).toBe("hide");
  await user.selectOptions(
    view.getByRole("combobox", { name: "Suggested posts" }),
    "show",
  );
  await waitFor(() => expect(view.getByText("Saved")).toBeDefined());
  expect(await store.read()).toMatchObject({
    hidePromoted: false,
    hidePromotedBy: true,
  });
  await user.selectOptions(promoted, "show");
  await waitFor(() => expect(selectValue(promoted)).toBe("show"));
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
    await view.findByRole("combobox", { name: "Suggested posts" }),
  ).toBeDefined();
  view.unmount();
  const failed = render(<App store={demoStore("save-error")} />);
  await userEvent.selectOptions(
    await failed.findByRole("combobox", { name: "Suggested posts" }),
    "show",
  );
  expect(
    await failed.findByRole("button", { name: "Retry saving preferences" }),
  ).toBeDefined();
});
it("restores a backup and updates the displayed preference", async () => {
  const store = demoStore();
  const view = render(
    <App store={store} version="1.5.2" initialTab="settings" />,
  );
  const user = userEvent.setup();
  const input = await view.findByLabelText("Choose backup file");
  const file = new File([""], "cleanin.json", { type: "application/json" });
  file.text = async () =>
    JSON.stringify({
      format: "petercox-extension-backup",
      version: 1,
      extensionId: "cleanin",
      extensionVersion: "1.5.2",
      createdAt: new Date().toISOString(),
      data: { transparentMode: true },
    });
  await user.upload(input, file);
  await user.click(await view.findByRole("button", { name: "Restore backup" }));
  expect(await view.findByText("Backup restored.")).toBeDefined();
  expect((await store.read()).transparentMode).toBe(true);
});
it("reports a failed restore without claiming success", async () => {
  const view = render(
    <App
      store={demoStore("save-error")}
      version="1.5.2"
      initialTab="settings"
    />,
  );
  const user = userEvent.setup();
  const input = await view.findByLabelText("Choose backup file");
  const file = new File([""], "cleanin.json", { type: "application/json" });
  file.text = async () =>
    JSON.stringify({
      format: "petercox-extension-backup",
      version: 1,
      extensionId: "cleanin",
      extensionVersion: "1.5.2",
      createdAt: new Date().toISOString(),
      data: { transparentMode: true },
    });
  await user.upload(input, file);
  await user.click(await view.findByRole("button", { name: "Restore backup" }));
  expect(await view.findByText(/Could not restore backup/)).toBeDefined();
  expect(view.queryByText("Backup restored.")).toBeNull();
});
