import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { App, type AppProps } from "./App";
import { demoStore, type DemoScenario } from "./demoStore";

type Args = AppProps & { scenario?: DemoScenario };
const meta = {
  component: App,
  tags: ["ai-generated"],
  args: {
    version: "1.5.2",
    beta: true,
    initialTab: "feed",
    scenario: "normal",
  },
  parameters: { layout: "fullscreen" },
  render: function Preview({ scenario, ...args }: Args) {
    const store = useMemo(() => demoStore(scenario), [scenario]);
    return <App {...args} store={store} />;
  },
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Feed: Story = {
  play: async ({ canvas, userEvent }) => {
    const suggested = await canvas.findByRole("combobox", {
      name: "Suggested posts",
    });
    const photos = canvas.getByRole("combobox", { name: "Photos" });
    await expect(suggested).toHaveValue("hide");
    await expect(photos).toHaveValue("show");
    await userEvent.selectOptions(suggested, "fade");
    await expect(suggested).toHaveValue("fade");
    await expect(photos).toHaveValue("show");
    await userEvent.selectOptions(photos, "hide");
    await expect(photos).toHaveValue("hide");
    await expect(suggested).toHaveValue("fade");
    await userEvent.selectOptions(photos, "show");
    await userEvent.selectOptions(suggested, "hide");
  },
};
export const Sidebar: Story = { args: { initialTab: "sidebar" } };
export const Settings: Story = {
  args: { initialTab: "settings" },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("button", { name: "Export backup" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Import backup" }),
    ).toBeVisible();
  },
};
export const Loading: Story = { args: { scenario: "loading" } };
export const LoadError: Story = { args: { scenario: "load-error" } };
export const SaveError: Story = {
  args: { scenario: "save-error" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(
      await canvas.findByRole("combobox", { name: "Suggested posts" }),
      "show",
    );
    await expect(
      await canvas.findByRole("button", { name: "Retry saving preferences" }),
    ).toBeVisible();
  },
};
export const Saved: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(
      await canvas.findByRole("combobox", { name: "Suggested posts" }),
      "show",
    );
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Sidebar" }));
    await expect(
      await canvas.findByRole("combobox", { name: "News" }),
    ).toHaveValue("hide");
  },
};
export const CssCheck: Story = {
  play: async ({ canvas }) => {
    const control = await canvas.findByRole("combobox", {
      name: "Suggested posts",
    });
    await expect(control).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "About Suggested posts filter" }),
    ).toBeVisible();
  },
};
