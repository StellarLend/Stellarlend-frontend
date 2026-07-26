import type { Meta, StoryObj } from "@storybook/react";
// ...existing code...
import "@testing-library/jest-dom";
// ...existing code...
import NavLink from "../shared/layout/NavLink";

const meta: Meta<typeof NavLink> = {
  title: "Design System/NavLink",
  component: NavLink,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    componentSubtitle: "Navigation link for menus, sidebars, and tabs",
  },
  argTypes: {
    href: { control: "text" },
    isActive: { control: "boolean" },

    children: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof NavLink>;

export const Default: Story = {
  args: {
    href: "/dashboard",
    children: "Dashboard",
  },
};

export const Active: Story = {
  args: {
    href: "/dashboard",
    children: "Dashboard",
  },
  parameters: { docs: { storyDescription: "Current route indicator" } },
};

export const WithIcon: Story = {
  args: {
    href: "/wallet",
    children: "Wallet",
  },
};

export const Hover: Story = {
  args: {
    href: "/markets",
    children: "Markets",
  },
  parameters: { pseudo: { hover: true } },
};

export const Focus: Story = {
  args: {
    href: "/settings",
    children: "Settings",
  },
  parameters: { pseudo: { focus: true } },
};

export const Disabled: Story = {
  args: {
    href: "/admin",
    children: "Admin",
  },
  play: async ({ canvasElement }) => {
    const link = canvasElement.querySelector("a");
    expect(link).toHaveAttribute("aria-disabled", "true");
  },
};

export const Loading: Story = {
  args: {
    href: "/data",
    children: "Analytics",
  },
  play: async ({ canvasElement }) => {
    const spinner = canvasElement.querySelector('[role="status"]');
    expect(spinner).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: {
    href: "/broken",
    children: "Broken Link",
  },
  parameters: {
    docs: { storyDescription: "Route failed to load or is unreachable" },
  },
};

export const SidebarGroup: Story = {
  render: () => (
    <nav className="flex flex-col gap-1 w-56 p-2 bg-slate-900 rounded-lg">
      <NavLink href="/dashboard">Dashboard</NavLink>
      <NavLink href="/markets">Markets</NavLink>
      <NavLink href="/lend">Lend</NavLink>
      <NavLink href="/borrow">Borrow</NavLink>
      <NavLink href="/wallet">Wallet</NavLink>
      <div className="my-1 border-t border-slate-700" />
      <NavLink href="/settings">Settings</NavLink>
      <NavLink href="/help">Help</NavLink>
    </nav>
  ),
  parameters: {
    docs: { storyDescription: "Realistic sidebar navigation group" },
  },
};

export const StateMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-48">
      <NavLink href="/a">Default</NavLink>
      <NavLink href="/b">Active</NavLink>
      <NavLink href="/c">Disabled</NavLink>
      <NavLink href="/d">Loading</NavLink>
      <NavLink href="/e">Error</NavLink>
    </div>
  ),
};
