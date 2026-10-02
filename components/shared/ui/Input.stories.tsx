/**
 * Stories for the shared `Input` component.
 *
 * Invariants (enforced by `./Input.stories.test.tsx`):
 *
 * 1. `meta.component` must be the shipped `./Input` — never a stale copy — and
 *    `title` is a stable story id, because docs deep links and Chromatic
 *    baselines are keyed off `title` + export name.
 * 2. Every named export is a story, and every story stays args-driven (no
 *    custom `render`) so autodocs controls remain truthful.
 * 3. `argTypes.type.options` must stay a subset of the input types the
 *    component actually forwards.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Shared/UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    type: 'email',
  },
};

export const Required: Story = {
  args: {
    label: 'Full Name',
    placeholder: 'Ex. John Doe',
    required: true,
  },
};

export const WithError: Story = {
  args: {
    label: 'Password',
    type: 'password',
    defaultValue: '123',
    error: 'Password must be at least 8 characters',
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Username',
    placeholder: 'johndoe',
    helperText: 'Choose a unique username for your profile',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Static Field',
    defaultValue: 'This cannot be changed',
    disabled: true,
  },
};

export const Multiline: Story = {
  args: {
    label: 'Bio',
    multiline: true,
    rows: 4,
    placeholder: 'Tell us about yourself...',
  },
};
