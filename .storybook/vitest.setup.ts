import { setProjectAnnotations } from '@storybook/nextjs-vite';
import * as projectAnnotations from './preview';

export function applyStorybookAnnotations() {
  try {
    return setProjectAnnotations([projectAnnotations]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to apply Storybook Vitest annotations: ${message}`, { cause: error });
  }
}

applyStorybookAnnotations();
