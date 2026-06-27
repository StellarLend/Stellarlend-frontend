import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/test';
import { Button } from './Button';
import { playDisabled, playLoading } from './Button.play';


const meta: Meta<typeof Button> = {
  title: 'Design System/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    componentSubtitle: 'Primary interaction element with multiple variants and states',
    docs: {
      description: {
        component: 'Buttons trigger actions or events. They should be used sparingly and clearly communicate the action they perform.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
      description: 'Visual style variant',
      table: {
        type: { summary: 'primary | secondary | ghost | danger' },
        defaultValue: { summary: 'primary' },
      },
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
      table: {
        type: { summary: 'sm | md | lg' },
        defaultValue: { summary: 'md' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    loading: {
      control: 'boolean',
      description: 'Whether the button shows a loading spinner',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    error: {
      control: 'boolean',
      description: 'Whether the button is in an error state',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    children: {
      control: 'text',
      description: 'Button label',
    },
    onClick: {
      action: 'clicked',
      description: 'Click handler',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'md',
  },
};

export const Primary: Story = {
  args: { children: 'Primary', variant: 'primary' },
  parameters: { docs: { storyDescription: 'Main call-to-action style' } },
};

export const Secondary: Story = {
  args: { children: 'Secondary', variant: 'secondary' },
  parameters: { docs: { storyDescription: 'Secondary actions, lower emphasis' } },
};

export const Ghost: Story = {
  args: { children: 'Ghost', variant: 'ghost' },
  parameters: { docs: { storyDescription: 'Low emphasis, often used in toolbars' } },
};

export const Danger: Story = {
  args: { children: 'Danger', variant: 'danger' },
  parameters: { docs: { storyDescription: 'Destructive actions like delete or remove' } },
};

export const Small: Story = {
  args: { children: 'Small', size: 'sm' },
};

export const Medium: Story = {
  args: { children: 'Medium', size: 'md' },
};

export const Large: Story = {
  args: { children: 'Large', size: 'lg' },
};

export const Hover: Story = {
  args: { children: 'Hover Me', variant: 'primary' },
  parameters: {
    pseudo: { hover: true },
    docs: { storyDescription: 'Visual state when user hovers over the button' },
  },
};

export const Focus: Story = {
  args: { children: 'Focused', variant: 'primary' },
  parameters: {
    pseudo: { focus: true },
    docs: { storyDescription: 'Visual state when button has keyboard focus' },
  },
};

export const Disabled: Story = {
  args: { children: 'Disabled', disabled: true },
  parameters: {
    docs: { storyDescription: 'Non-interactive state' },
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');
    expect(button).toBeDisabled();
  },
};

export const Loading: Story = {
  args: { children: 'Loading', loading: true },
  parameters: {
    docs: { storyDescription: 'Indicates an action is in progress' },
  },
  play: async ({ canvasElement }) => {
    const spinner = canvasElement.querySelector('[role="status"]');
    expect(spinner).toBeInTheDocument();
  },
};

export const Error: Story = {
  args: { children: 'Retry', error: true },
  parameters: {
    docs: { storyDescription: 'Indicates the previous action failed' },
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: playDisabled,
};

export const Interactive: Story = {
  args: {
    children: 'Click Me',
    variant: 'primary',
    size: 'md',
  },
  play: async ({ canvasElement, args }) => {
    const button = canvasElement.querySelector('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Click Me');
    expect(button).not.toBeDisabled();
  },
};

export const StateMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-4 items-start">
      <div className="flex gap-2">
        <Button variant="primary">Default</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button variant="primary" loading>Loading</Button>
        <Button variant="primary" error>Error</Button>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary">Default</Button>
        <Button variant="secondary" disabled>Disabled</Button>
        <Button variant="secondary" loading>Loading</Button>
        <Button variant="secondary" error>Error</Button>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost">Default</Button>
        <Button variant="ghost" disabled>Disabled</Button>
        <Button variant="ghost" loading>Loading</Button>
        <Button variant="ghost" error>Error</Button>
      </div>
      <div className="flex gap-2">
        <Button variant="danger">Default</Button>
        <Button variant="danger" disabled>Disabled</Button>
        <Button variant="danger" loading>Loading</Button>
        <Button variant="danger" error>Error</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      storyDescription: 'Complete state matrix for all variants',
    },
  },
};