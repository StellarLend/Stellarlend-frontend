import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import NavLink from "./NavLink";

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
    isActive: true,
  },
  play: async ({ canvasElement }) => {
    const link = canvasElement.querySelector("a");
    expect(link).toHaveAttribute("aria-current", "page");
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

export const InactiveOverride: Story = {
  args: {
    href: "/markets",
    children: "Markets",
    isActive: false,
  },
  play: async ({ canvasElement }) => {
    const link = canvasElement.querySelector("a");
    expect(link).not.toHaveAttribute("aria-current");
  },
};

export const InvalidHref: Story = {
  args: {
    href: "",
    children: "Unavailable",
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector("a")).toBeNull();
  },
};

export const HashLink: Story = {
  args: {
    href: "#features",
    children: "Features",
  },
  play: async ({ canvasElement }) => {
    const link = canvasElement.querySelector("a");
    expect(link).toHaveAttribute("href", "#features");
  },
};

export const DuplicateHref: Story = {
  render: () => (
    <div className="flex flex-col gap-1">
      <NavLink href="/markets">Markets</NavLink>
      <NavLink href="/markets">Markets overview</NavLink>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const links = canvasElement.querySelectorAll('a[href="/markets"]');
    expect(links).toHaveLength(2);
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
      <NavLink href="/markets" isActive={false}>
        Inactive
      </NavLink>
      <NavLink href="/markets" isActive>
        Active
      </NavLink>
      <NavLink href="#features">Hash link</NavLink>
    </div>
  ),
};
