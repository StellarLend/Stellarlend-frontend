"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { AlertTriangle, Loader2, X, Trash2, RotateCcw } from "lucide-react";
import Button from "@/components/shared/ui/Button";
import { Input } from "@/components/shared/ui/Input";

export type AccountDeletionStatus =
  | "idle"
  | "loading_challenge"
  | "confirming"
  | "undo_pending"
  | "deleting"
  | "success"
  | "error";

export interface AccountDeletionChallenge {
  challenge: string;
  expiresAt: string;
}

const UNDO_WINDOW_SECONDS = 10;

export interface AccountDeletionProps {
  onDeleted?: () => void;
}

export default function AccountDeletion({ onDeleted }: AccountDeletionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AccountDeletionStatus>("idle");
  const [challenge, setChallenge] = useState<AccountDeletionChallenge | null>(null);
  const [challengeInput, setChallengeInput] = useState("");
  const [countdown, setCountdown] = useState(UNDO_WINDOW_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  const resetFlow = useCallback(() => {
    clearTimers();
    setIsOpen(false);
    setStatus("idle");
    setChallenge(null);
    setChallengeInput("");
    setCountdown(UNDO_WINDOW_SECONDS);
    setError(null);
    setAnnouncement("");
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const fetchChallenge = useCallback(async () => {
    setStatus("loading_challenge");
    setError(null);
    try {
      const response = await fetch("/api/account/delete/challenge");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to request deletion challenge");
      }

      setChallenge(data);
      setStatus("confirming");
      announce(
        "Account deletion challenge received. Enter the challenge code to continue."
      );
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to load challenge");
    }
  }, [announce]);

  const openModal = useCallback(() => {
    setIsOpen(true);
    setChallengeInput("");
    setError(null);
    setCountdown(UNDO_WINDOW_SECONDS);
    void fetchChallenge();
  }, [fetchChallenge]);

  const handleConfirm = useCallback(() => {
    if (!challenge) return;

    const challengeExpired = new Date(challenge.expiresAt).getTime() <= Date.now();
    if (challengeExpired) {
      setStatus("error");
      setError("Challenge has expired. Please request a new challenge.");
      return;
    }

    if (challengeInput.trim() !== challenge.challenge) {
      setStatus("error");
      setError("Invalid challenge code. Please check and try again.");
      return;
    }

    setStatus("undo_pending");
    setCountdown(UNDO_WINDOW_SECONDS);
    announce(
      `Account deletion will be finalized in ${UNDO_WINDOW_SECONDS} seconds. Click Undo to cancel.`
    );

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (next > 0 && next <= 5) {
          announce(`Account deletion finalizing in ${next} seconds.`);
        }
        return next;
      });
    }, 1000);

    undoTimerRef.current = setTimeout(() => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setStatus("deleting");
      announce("Finalizing account deletion.");
    }, UNDO_WINDOW_SECONDS * 1000);
  }, [challenge, challengeInput, announce]);

  const handleUndo = useCallback(() => {
    clearTimers();
    setStatus("confirming");
    setCountdown(UNDO_WINDOW_SECONDS);
    announce("Account deletion cancelled. Your account is safe.");
  }, [clearTimers, announce]);

  const performDelete = useCallback(async () => {
    if (!challenge) return;

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ challenge: challenge.challenge }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Account deletion failed");
      }

      setStatus("success");
      announce("Account deleted successfully.");

      // Log out the user after successful deletion
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // Best-effort logout; proceed with redirect regardless.
      }

      if (onDeleted) {
        onDeleted();
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Account deletion failed");
      announce("Account deletion failed.");
    }
  }, [challenge, onDeleted, announce]);

  useEffect(() => {
    if (status === "deleting") {
      void performDelete();
    }
  }, [status, performDelete]);

  const isChallengeInvalid =
    challenge !== null && new Date(challenge.expiresAt).getTime() <= Date.now();

  return (
    <div className="border-t border-red-100 pt-6 mt-8">
      <div
        className="bg-red-50 border border-red-200 rounded-lg p-4 md:p-6"
        role="region"
        aria-labelledby="account-deletion-heading"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h3
              id="account-deletion-heading"
              className="text-base font-semibold text-red-800"
            >
              Delete Account
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </p>
            <div className="mt-4">
              <Button
                data-testid="delete-account-button"
                variant="destructive"
                size="md"
                leftIcon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
                onClick={openModal}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Transition show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (status !== "deleting") {
              resetFlow();
            }
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
                <button
                  type="button"
                  onClick={resetFlow}
                  disabled={status === "deleting"}
                  className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Close account deletion dialog"
                >
                  <X size={20} />
                </button>

                <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">
                  Delete Account
                </Dialog.Title>

                <div
                  className="sr-only"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {announcement}
                </div>

                {status === "undo_pending" ? (
                  <div className="space-y-4">
                    <div
                      className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center"
                      role="alert"
                    >
                      <p className="text-sm text-amber-800 font-medium">
                        Account deletion pending
                      </p>
                      <p
                        className="text-3xl font-bold text-amber-700 mt-2"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {countdown}s
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Click Undo to keep your account.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        data-testid="undo-delete-button"
                        variant="secondary"
                        fullWidth
                        leftIcon={
                          <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        }
                        onClick={handleUndo}
                      >
                        Undo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      To confirm, enter the challenge code below. After
                      confirmation you will have{" "}
                      <span className="font-medium">{UNDO_WINDOW_SECONDS} seconds</span>{" "}
                      to undo before your account is permanently deleted.
                    </p>

                    {status === "loading_challenge" ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
                        <Loader2
                          className="w-4 h-4 animate-spin"
                          aria-hidden="true"
                        />
                        <span>Requesting challenge code...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {challenge && (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              Challenge code
                            </p>
                            <code
                              className="mt-1 block break-all rounded bg-white px-3 py-2 text-sm text-gray-900"
                              data-testid="challenge-code"
                            >
                              {challenge.challenge}
                            </code>
                          </div>
                        )}
                        <Input
                          data-testid="challenge-input"
                          label="Confirm challenge code"
                          placeholder="Re-enter challenge code"
                          value={challengeInput}
                          onChange={(e) => setChallengeInput(e.target.value)}
                          disabled={status === "deleting"}
                          error={isChallengeInvalid ? "Challenge has expired" : undefined}
                          helperText={
                            challenge
                              ? `Expires at ${new Date(challenge.expiresAt).toLocaleString()}`
                              : "Request a challenge code to proceed."
                          }
                          fullWidth
                        />
                      </div>
                    )}

                    {error && (
                      <div
                        className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3"
                        role="alert"
                        data-testid="account-deletion-error"
                      >
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={resetFlow}
                        disabled={status === "deleting"}
                      >
                        Cancel
                      </Button>
                      <Button
                        data-testid="confirm-delete-button"
                        variant="destructive"
                        fullWidth
                        isLoading={status === "deleting"}
                        disabled={
                          status === "loading_challenge" ||
                          status === "deleting" ||
                          challengeInput.trim().length === 0
                        }
                        onClick={handleConfirm}
                      >
                        Confirm Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
