import type { Meta, StoryObj } from '@storybook/react';

import { Input } from '@/components/shared/ui/Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  args: {
    placeholder: 'Type something...',
  },
};

export default meta;

export const Default: StoryObj<typeof Input> = {};
