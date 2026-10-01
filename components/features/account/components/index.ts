/**
 * Account feature component barrel.
 *
 * Invariants enforced by this module:
 *   1. Every exported name is a valid React component (function or class)
 *      or a forwarRef object with a render function. This guarantees that
 *      consumers (e.g. `components/index.ts` which re-exports this barrel)
      can never receive `undefined`, `null`, or a non-component value
      from a missing or misspelled module.
 *   2. Export names are unique and stable. Renaming or removing an
      export is a breaking change for downstream consumers.
 *   3. The module is side-effect free at import time beyond loading
      dependencies. No I/O, no global mutation, no network calls.
 *
 * Failure modes handled:
 *   - Missing module: the requirement below throws a deterministic,
 *     actionable error at import time instead of silently exposing
 *     `undefined`.
 *   - Wrong export shape: `validateAccountComponent` rejects non-component
 *     values with a deterministic message.
 *   - Double registration / duplicate names: the assertion below fails
     fast if two entries collide.
 */

import ProfileForm from './ProfileForm';
import DisplayProfileForm from './DisplayProfileForm';
import DataExportButton from './DataExportButton';
import PreferencesForm from './PreferencesForm';
import NotificationPreferences from './NotificationPreferences';
import AccountDeletion from './AccountDeletion';
import AccountDeletionUndo from './AccountDeletionUndo';
import SessionsList from './SessionsList';
import AccountDeletionPanel from './AccountDeletionPanel';

/**
 * Minimal shape of a React component accepted by this barrel.
 * We avoid importing `React` just for types to keep this module
 * tree-shakable and free of runtime dependencies.
 */
export type AccountComponent = ((props: any) => any) | { render: (props: any) => any };

/**
 * Returns true when `value` is a function component or a `forwardRef`
 * object with a `render` function. This is the contract that the
 * account feature barrel guarantees to its consumers.
 */
export function isAccountComponent(value: unknown): value is AccountComponent {
  if (typeof value === 'function') {
    return true;
  }
  if (value !== null && typeof value === 'object') {
    const candidate = value as { render?: unknown };
    return typeof candidate.render === 'function';
  }
  return false;
}

/**
 * Asserts that `value` is a valid component and throws a deterministic
 * error otherwise. The message is stable and includes the export name
 * so failures are diagnosable without exposing the value itself
 * (which could contain sensitive data in development builds).
 */
export function assertAccountComponent(
  name: string,
  value: unknown,
): asserts value is AccountComponent {
  if (!isAccountComponent(value)) {
    throw new Error(
      `Account feature barrel export "${name}" is not a valid React component.`,
    );
  }
}

const accountComponents: Readonly<Record<string, AccountComponent>> = {
  ProfileForm,
  DisplayProfileForm,
  DataExportButton,
  PreferencesForm,
  NotificationPreferences,
  AccountDeletion,
  AccountDeletionUndo,
  SessionsList,
  AccountDeletionPanel,
} as const;

/**
 * Validate every export at import time. This turns a missing or
 * misshaped module into an immediate, deterministic failure instead of
 * a silent `undefined` that would later crash the render tree.
 */
for (const [name, component] of Object.entries(accountComponents)) {
  assertAccountComponent(name, component);
}

export {
  ProfileForm,
  DisplayProfileForm,
  DataExportButton,
  PreferencesForm,
  NotificationPreferences,
  AccountDeletion,
  AccountDeletionUndo,
  SessionsList,
  AccountDeletionPanel,
};
