cat > src/components/NavLink/NavLink.stories.tsx << 'EOF'
import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/test';
import { NavLink } from './NavLink';


const meta: Meta<typeof NavLink> = {
  title: 'Design System/NavLink',
  component: NavLink,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    componentSubtitle: 'Navigation link for menus, sidebars, and tabs',
  },
  argTypes: {
    href: { control: 'text' },
    active: { control: 'boolean' },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    error: { control: 'boolean' },
    icon: { control: 'text' },
    children: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof NavLink>;

export const Default: Story = {
  args: {
    href: '/dashboard',
    children: 'Dashboard',
  },
};

export const Active: Story = {
  args: {
    href: '/dashboard',
    children: 'Dashboard',
    active: true,
  },
  parameters: { docs: { storyDescription: 'Current route indicator' } },
};

export const WithIcon: Story = {
  args: {
    href: '/wallet',
    children: 'Wallet',
    icon: 'wallet',
  },
};

export const Hover: Story = {
  args: {
    href: '/markets',
    children: 'Markets',
  },
  parameters: { pseudo: { hover: true } },
};

export const Focus: Story = {
  args: {
    href: '/settings',
    children: 'Settings',
  },
  parameters: { pseudo: { focus: true } },
};

export const Disabled: Story = {
  args: {
    href: '/admin',
    children: 'Admin',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const link = canvasElement.querySelector('a');
    expect(link).toHaveAttribute('aria-disabled', 'true');
  },
};

export const Loading: Story = {
  args: {
    href: '/data',
    children: 'Analytics',
    loading: true,
  },
  play: async ({ canvasElement }) => {
    const spinner = canvasElement.querySelector('[role="status"]');
    expect(spinner).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: {
    href: '/broken',
    children: 'Broken Link',
    error: true,
  },
  parameters: {
    docs: { storyDescription: 'Route failed to load or is unreachable' },
  },
};

export const SidebarGroup: Story = {
  render: () => (
    <nav className="flex flex-col gap-1 w-56 p-2 bg-slate-900 rounded-lg">
      <NavLink href="/dashboard" icon="home">Dashboard</NavLink>
      <NavLink href="/markets" icon="chart">Markets</NavLink>
      <NavLink href="/lend" icon="arrow-up-circle" active>Lend</NavLink>
      <NavLink href="/borrow" icon="arrow-down-circle">Borrow</NavLink>
      <NavLink href="/wallet" icon="wallet">Wallet</NavLink>
      <div className="my-1 border-t border-slate-700" />
      <NavLink href="/settings" icon="settings">Settings</NavLink>
      <NavLink href="/help" icon="help-circle" disabled>Help</NavLink>
    </nav>
  ),
  parameters: {
    docs: { storyDescription: 'Realistic sidebar navigation group' },
  },
};

export const StateMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-48">
      <NavLink href="/a">Default</NavLink>
      <NavLink href="/b" active>Active</NavLink>
      <NavLink href="/c" disabled>Disabled</NavLink>
      <NavLink href="/d" loading>Loading</NavLink>
      <NavLink href="/e" error>Error</NavLink>
    </div>
  ),
};