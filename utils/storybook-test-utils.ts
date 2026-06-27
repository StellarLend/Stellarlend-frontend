import { expect } from '@storybook/test';

/**
 * Shared test utilities for Storybook interaction tests.
 * Import these helpers in stories to enforce consistent assertions.
 */

export function assertDisabled(element: HTMLElement | null) {
  expect(element).toBeDisabled();
}

export function assertHasRole(element: HTMLElement | null, role: string) {
  expect(element).toHaveAttribute('role', role);
}

export function assertHasText(element: HTMLElement | null, text: string) {
  expect(element).toHaveTextContent(text);
}

export function assertVisible(element: HTMLElement | null) {
  expect(element).toBeVisible();
}