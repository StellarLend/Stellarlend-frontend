cat > src/components/Input/Input.stories.tsx << 'EOF'
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent } from '@storybook/test';
import { Input } from './Input';


const meta: Meta<typeof Input> = {
  title: 'Design System/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    componentSubtitle: 'Text entry field with validation and state support',
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number'],
      table: { defaultValue: { summary: 'text' } },
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    loading: { control: 'boolean' },
    label: { control: 'text' },
    helperText: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
    type: 'text',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'you@example.com',
    type: 'email',
  },
};

export const WithHelper: Story = {
  args: {
    label: 'Password',
    helperText: 'Must be at least 8 characters',
    type: 'password',
    placeholder: '••••••••',
  },
};

export const Hover: Story = {
  args: { placeholder: 'Hover over me' },
  parameters: { pseudo: { hover: true } },
};

export const Focus: Story = {
  args: { placeholder: 'Focus me' },
  parameters: { pseudo: { focus: true } },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    placeholder: 'Cannot edit',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input');
    expect(input).toBeDisabled();
  },
};

export const Error: Story = {
  args: {
    label: 'Email',
    placeholder: 'invalid-email',
    error: true,
    helperText: 'Please enter a valid email address',
  },
  play: async ({ canvasElement }) => {
    const errorMessage = canvasElement.querySelector('[role="alert"]');
    expect(errorMessage).toHaveTextContent('Please enter a valid email address');
  },
};

export const Loading: Story = {
  args: {
    label: 'Verifying...',
    placeholder: 'Checking availability',
    loading: true,
  },
  play: async ({ canvasElement }) => {
    const spinner = canvasElement.querySelector('[role="status"]');
    expect(spinner).toBeInTheDocument();
  },
};

export const WithIcon: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search assets...',
    icon: 'search',
  },
};

export const NumberType: Story = {
  args: {
    label: 'Amount',
    type: 'number',
    placeholder: '0.00',
    helperText: 'Enter the amount in XLM',
  },
};

export const Interactive: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
  },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input');
    await userEvent.type(input!, 'stellar_user');
    expect(input).toHaveValue('stellar_user');
  },
};

export const StateMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-6 w-80">
      <Input label="Default" placeholder="Normal state" />
      <Input label="Hover" placeholder="Hover state" className="hover" />
      <Input label="Focus" placeholder="Focus state" className="focus" />
      <Input label="Disabled" placeholder="Disabled state" disabled />
      <Input label="Error" placeholder="Error state" error helperText="Invalid value" />
      <Input label="Loading" placeholder="Loading state" loading />
    </div>
  ),
  parameters: {
    docs: { storyDescription: 'All input states in one view' },
  },
};