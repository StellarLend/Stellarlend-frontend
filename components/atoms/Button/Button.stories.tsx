// src/components/ui/Button/stories.tsx

import Button from "./Button";

const storyConfig = {
  title: "Components/Button",
  component: Button,
};

export default storyConfig;

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
