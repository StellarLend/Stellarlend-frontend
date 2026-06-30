"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountDeletionDialog from "@/components/shared/common/AccountDeletionDialog";
import Toast, { ToastVariant } from "@/components/shared/common/Toast";

type ToastState = {
  variant: ToastVariant;
  title: string;
  description?: string;
} | null;

export default function AccountDeletion() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (variant: ToastVariant, title: string, description?: string) => {
    setToast({ variant, title, description });
    setTimeout(() => setToast(null), 5000);
  };

  const handleInitiate = async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const res = await fetch("/api/account/delete/challenge");
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          showToast(
            "error",
            "Rate limit exceeded",
            data.error?.message || "Too many requests. Please try again later.",
          );
        } else {
          showToast(
            "error",
            "Challenge failed",
            data.error?.message || data.error || "Could not start deletion. Please try again.",
          );
        }
        return;
      }
      setChallenge(data.challenge);
      setDialogOpen(true);
    } catch {
      showToast("error", "Network error", "Could not reach the server. Check your connection.");
    } finally {
      setFetching(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!challenge) throw new Error("No deletion challenge available.");
    const res = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Account deletion failed. Please try again.");
    }
    setDialogOpen(false);
    router.push("/");
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setChallenge(null);
  };

  return (
    <>
      <div>
        <h3 className="text-lg font-semibold text-red-700 mb-2">Delete Account</h3>
        <p className="text-sm text-gray-600 mb-4">
          Permanently delete your account and all associated data. This action is
          irreversible and cannot be undone.
        </p>
        <button
          onClick={handleInitiate}
          disabled={fetching}
          aria-busy={fetching}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {fetching ? "Requesting..." : "Delete My Account"}
        </button>
      </div>

      <AccountDeletionDialog
        isOpen={dialogOpen}
        onCancel={handleCancel}
        onConfirmDelete={handleConfirmDelete}
      />

      {toast && (
        <Toast
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
        />
      )}
    </>
  );
}
