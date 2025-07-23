// src/components/ui/Button/stories.tsx

import Button from "./Button";

export default {
  title: "Components/Button",
  component: Button,
};

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
