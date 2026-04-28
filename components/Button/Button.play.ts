import { expect } from '@storybook/test';

export const playDisabled = async ({ canvasElement }: any) => {
  const btn = canvasElement.querySelector('button');
  expect(btn).toBeDisabled();
};

export const playLoading = async ({ canvasElement }: any) => {
  const spinner = canvasElement.querySelector('[role="status"]');
  expect(spinner).toBeInTheDocument();
};