import type { Preview } from '@storybook/nextjs-vite'

// Invariants (enforced by .storybook/preview.test.ts):
// - Default export is a static, side-effect-free Preview object.
// - parameters.controls.matchers exposes exactly `color` and `date` as
//   end-anchored, case-insensitive RegExps (not strings), with no `g` flag so
//   repeated/concurrent .test() calls stay deterministic.
// - Widening either pattern (e.g. dropping `$` or the `i` flag) silently
//   misclassifies Storybook controls, so changes here require test updates.
const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;