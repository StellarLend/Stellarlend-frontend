import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { userEvent } from "@storybook/test";
import "@testing-library/jest-dom";
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
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
    error: { control: "boolean" },
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
    isActive: true,
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
href: "/admin",
    disabled: true,
    children: "Admin",
    isActive: false,
  },
  play: async ({ canvasElement }) => {
const canvas = within(canvasElement);
    const link = canvas.getByRole("link");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(link).not.toHaveAttribute("aria-current");
  },
};

export const InvalidHref: Story = {
  args: {
href: "/data",
    loading: true,
    children: "Analytics",
  },
  play: async ({ canvasElement }) => {
const canvas = within(canvasElement);
    const spinner = canvas.getByRole("status");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("aria-live", "polite");
    expect(canvasElement.querySelector("a")).toBeNull();
  },
};

export const HashLink: Story = {
  args: {
href: "/broken",
    error: true,
    children: "Broken Link",
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link");
    expect(link).toHaveAttribute("data-state", "error");
  },
};

export const MissingHref: Story = {
  args: {
    href: "",
    children: "No Destination",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link");
    expect(link).toHaveAttribute("aria-disabled", "true");
  },
};

export const EmptyChildren: Story = {
  args: {
    href: "/empty",
    children: "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link");
    expect(link).toHaveAttribute("aria-label");
  },
};

export const ExternalLink: Story = {
  args: {
    href: "https://example.com/docs",
    children: "External Docs",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  },
};

export const KeyboardNavigation: Story = {
  args: {
    href: "/keyboard",
    children: "Keyboard",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole("link");
    link.focus();
    expect(link).toHaveFocus();
    await userEvent.keyboard("{Enter}");
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
      <NavLink href="/b" isActive>Active</NavLink>
      <NavLink href="/c" disabled>Disabled</NavLink>
      <NavLink href="/d" loading>Loading</NavLink>
      <NavLink href="/e" error>Error</NavLink>
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
