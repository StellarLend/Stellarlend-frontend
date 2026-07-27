// src/components/ui/Button/stories.tsx

import Button from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
};

export default meta;

export const Primary = {
  args: {
    children: "Click me",
    variant: "primary",
  },
};

export const Secondary = {
  args: {
    children: "Cancel",
    variant: "secondary",
  },
};
