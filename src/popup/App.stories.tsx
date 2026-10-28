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
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("switch", { name: "Hide suggested posts" }),
    ).toHaveAttribute("aria-checked", "true");
  },
};
export const Sidebar: Story = { args: { initialTab: "sidebar" } };
export const Settings: Story = { args: { initialTab: "settings" } };
export const Loading: Story = { args: { scenario: "loading" } };
export const LoadError: Story = { args: { scenario: "load-error" } };
export const SaveError: Story = {
  args: { scenario: "save-error" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("switch", { name: "Hide suggested posts" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "Retry saving preferences" }),
    ).toBeVisible();
  },
};
export const Saved: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("switch", { name: "Hide suggested posts" }),
    );
    await expect(await canvas.findByText("Saved")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Sidebar" }));
    await expect(
      await canvas.findByRole("switch", { name: "Hide news" }),
    ).toHaveAttribute("aria-checked", "true");
  },
};
export const CssCheck: Story = {
  play: async ({ canvas }) => {
    const control = await canvas.findByRole("switch", {
      name: "Hide suggested posts",
    });
    await expect(getComputedStyle(control).backgroundColor).toBe(
      "rgb(10, 102, 194)",
    );
  },
};
