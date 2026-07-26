"use client";

import { useEffect, useRef, useState } from "react";

export const UNDO_WINDOW_SECONDS = 10;

interface AccountDeletionUndoProps {
  durationSeconds?: number;
  onUndo: () => void;
  onElapsed: () => void;
}

export default function AccountDeletionUndo({
  durationSeconds = UNDO_WINDOW_SECONDS,
  onUndo,
  onElapsed,
}: AccountDeletionUndoProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(durationSeconds);
  const onElapsedRef = useRef(onElapsed);
  const undoButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onElapsedRef.current = onElapsed;
  });

  useEffect(() => {
    undoButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      onElapsedRef.current();
      return;
    }
    const timerId = setTimeout(() => setSecondsRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timerId);
  }, [secondsRemaining]);

  const percentage = (secondsRemaining / durationSeconds) * 100;

  return (
    <div data-testid="undo-window">
      <p className="text-sm text-gray-600">
        Your account will be deleted in{" "}
        <strong data-testid="undo-countdown">{secondsRemaining}</strong>{" "}
        {secondsRemaining === 1 ? "second" : "seconds"}.
      </p>
      <div
        aria-hidden="true"
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full bg-red-500 transition-[width] duration-1000 ease-linear"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          ref={undoButtonRef}
          type="button"
          onClick={onUndo}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Undo
        </button>
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {secondsRemaining > 0
          ? `Account deletion in ${secondsRemaining} ${secondsRemaining === 1 ? "second" : "seconds"}`
          : "Account deletion confirmed"}
      </span>
    </div>
  );
}
