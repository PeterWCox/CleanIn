import * as React from "react";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  FilterActionField,
  type FilterAction,
} from "@petercoxhatesbridges/extension-ui";
import "./popup.css";
const meta = {
  title: "Shared controls/Filter action field",
  component: FilterActionField,
  args: {
    label: "Suggested posts",
    subject: "Suggested posts",
    value: "fade",
    onChange: () => {},
  },
} satisfies Meta<typeof FilterActionField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Visibility: Story = {
  render: function Example() {
    const [value, setValue] = useState<FilterAction>("fade");
    return (
      <div style={{ width: 380 }}>
        <FilterActionField
          label="Suggested posts"
          subject="Suggested posts"
          context="your feed"
          icon={<span>▤</span>}
          value={value}
          onChange={setValue}
        />
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const select = canvas.getByRole("combobox", { name: "Suggested posts" });
    await expect(select).toHaveValue("fade");
    await userEvent.selectOptions(select, "show");
    await expect(select).toHaveValue("show");
    await userEvent.selectOptions(select, "hide");
    await expect(select).toHaveValue("hide");
    await expect(
      canvas.getByRole("button", { name: "About Suggested posts filter" }),
    ).toBeVisible();
  },
};
export const WithoutFade: Story = {
  args: {
    label: "Sidebar ads",
    subject: "Sidebar ads",
    context: "your sidebar",
    value: "hide",
    allowFade: false,
    onChange: () => {},
  },
};
export const Disabled: Story = {
  args: { ...WithoutFade.args, disabled: true },
};
