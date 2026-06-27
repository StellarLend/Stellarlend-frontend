cat > src/components/Modal/Modal.stories.tsx << 'EOF'
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from '@storybook/test';
import { Modal } from './Modal';
import { Button } from '../Button';
import { useState } from 'react';


const meta: Meta<typeof Modal> = {
  title: 'Design System/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    componentSubtitle: 'Overlay dialog for critical decisions or complex forms',
  },
  argTypes: {
    open: { control: 'boolean' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      table: { defaultValue: { summary: 'md' } },
    },
    title: { control: 'text' },
    description: { control: 'text' },
    showCloseButton: { control: 'boolean' },
    disableBackdropClick: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

const ModalTrigger = (props: React.ComponentProps<typeof Modal>) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export const Default: Story = {
  args: {
    open: true,
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed with this transaction?',
    children: (
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Confirm</Button>
      </div>
    ),
  },
};

export const Small: Story = {
  args: {
    open: true,
    size: 'sm',
    title: 'Small Modal',
    description: 'Compact confirmation dialog',
    children: <Button variant="primary" size="sm">OK</Button>,
  },
};

export const Large: Story = {
  args: {
    open: true,
    size: 'lg',
    title: 'Transaction Details',
    description: 'Review all details before confirming',
    children: (
      <div className="space-y-4 mt-4">
        <div className="p-3 bg-slate-50 rounded border text-sm font-mono">
          {'From: GABC...XYZ'}
          <br />
          {'To: GDEF...UVW'}
          <br />
          {'Amount: 100 XLM'}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost">Reject</Button>
          <Button variant="primary">Sign & Submit</Button>
        </div>
      </div>
    ),
  },
};

export const WithError: Story = {
  args: {
    open: true,
    title: 'Deposit Failed',
    description: 'We could not complete your deposit due to insufficient funds.',
    children: (
      <div className="mt-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">
          Error: Insufficient balance. Required: 50 XLM, Available: 12 XLM.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost">Dismiss</Button>
          <Button variant="danger" error>Retry</Button>
        </div>
      </div>
    ),
  },
};

export const WithLoading: Story = {
  args: {
    open: true,
    title: 'Processing Transaction',
    description: 'Please wait while we submit your transaction to the network...',
    children: (
      <div className="flex flex-col items-center gap-4 mt-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="text-sm text-slate-500">Submitting to Stellar network...</p>
        <Button variant="primary" loading disabled>
          Processing
        </Button>
      </div>
    ),
  },
};

export const DisabledAction: Story = {
  args: {
    open: true,
    title: 'Withdraw Funds',
    description: 'Enter the amount you wish to withdraw.',
    children: (
      <div className="space-y-4 mt-4">
        <input
          type="number"
          placeholder="0.00"
          className="w-full px-3 py-2 border rounded"
          disabled
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary" disabled>
            Withdraw
          </Button>
        </div>
      </div>
    ),
  },
};

export const InteractiveOpenClose: Story = {
  render: (args) => <ModalTrigger {...args} />,
  args: {
    title: 'Interactive Modal',
    description: 'Click the button to open, then close via backdrop or button.',
    children: (
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Confirm</Button>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const openBtn = canvas.getByText('Open Modal');
    await userEvent.click(openBtn);

    await waitFor(() => {
      expect(canvas.getByRole('dialog')).toBeInTheDocument();
    });

    const closeBtn = canvas.getByText('Cancel');
    await userEvent.click(closeBtn);
  },
};

export const FocusTrap: Story = {
  args: {
    open: true,
    title: 'Focus Trap Test',
    description: 'Tabbing should cycle within this modal only.',
    children: (
      <div className="flex flex-col gap-3 mt-4">
        <input className="border px-3 py-2 rounded" placeholder="Field 1" />
        <input className="border px-3 py-2 rounded" placeholder="Field 2" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary">Submit</Button>
        </div>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const dialog = canvasElement.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  },
};