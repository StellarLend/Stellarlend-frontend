type CleanupFn = () => void;

type StartWithCleanup<T> = (
  controller: ReadableStreamDefaultController<T>,
  onCleanup: (cleanupFn: CleanupFn) => void,
) => void | Promise<void>;

/**
 * Builds a ReadableStream underlying source that registers cleanup via a
 * typed callback instead of monkey-patching the controller with `as any`.
 *
 * Usage:
 * ```ts
 * new ReadableStream(
 *   withControllerCleanup((controller, onCleanup) => {
 *     const unsubscribe = hub.subscribe(...);
 *     onCleanup(unsubscribe);
 *   }),
 * );
 * ```
 */
export function withControllerCleanup<T = Uint8Array>(
  start: StartWithCleanup<T>,
): UnderlyingDefaultSource<T> {
  let cleanupFn: CleanupFn | undefined;

  return {
    start(controller) {
      return start(controller, (fn) => {
        cleanupFn = fn;
      });
    },
    cancel() {
      try {
        cleanupFn?.();
      } catch {
        // noop — cleanup must not throw out of cancel
      } finally {
        cleanupFn = undefined;
      }
    },
  };
}
