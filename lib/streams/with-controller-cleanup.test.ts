import { describe, it, expect, vi } from 'vitest';
import { withControllerCleanup } from './with-controller-cleanup';

describe('withControllerCleanup', () => {
  it('invokes the registered cleanup when the stream is cancelled', async () => {
    const cleanup = vi.fn();

    const stream = new ReadableStream(
      withControllerCleanup((controller, onCleanup) => {
        controller.enqueue(new TextEncoder().encode('hello'));
        onCleanup(cleanup);
      }),
    );

    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('swallows errors thrown by cleanup', async () => {
    const stream = new ReadableStream(
      withControllerCleanup((_controller, onCleanup) => {
        onCleanup(() => {
          throw new Error('cleanup failed');
        });
      }),
    );

    const reader = stream.getReader();
    await expect(reader.cancel()).resolves.toBeUndefined();
  });

  it('does not throw when cancel runs without a registered cleanup', async () => {
    const stream = new ReadableStream(
      withControllerCleanup(() => {
        // no onCleanup registration
      }),
    );

    const reader = stream.getReader();
    await expect(reader.cancel()).resolves.toBeUndefined();
  });
});
