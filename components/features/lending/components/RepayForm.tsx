"use client";

import { useState, useEffect } from "react";
import { usePositions, BorrowPosition } from "@/hooks/usePositions";
import { EmptyState } from "@/components/shared/common/EmptyState";
import { Skeleton } from "@/components/shared/common/Skeleton";
import { Input } from "@/components/shared/ui/Input";
import Button from "@/components/shared/ui/Button";
import { cn } from "@/lib/utils/cn";
import { Info, AlertTriangle, CheckCircle, X } from "lucide-react";

export interface RepayFormProps {
  positions?: BorrowPosition[];
  onSubmit: (data: {
    asset: string;
    amount: number;
    interestRate: number;
  }) => void;
}

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error" | "info";
}

export default function RepayForm({ positions: propsPositions, onSubmit }: RepayFormProps) {
  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: "success" | "error" | "info" = "error") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch live positions if no prop override is provided
  const hasOverride = propsPositions !== undefined;
  
  const {
    positions: fetchedPositions,
    isLoading: isFetchLoading,
    error: fetchError,
  } = usePositions();

  // Surface errors that might occur on initial render or hook run
  useEffect(() => {
    if (fetchError && !hasOverride) {
      addToast(`Failed to load borrow positions: ${fetchError.message}`, "error");
    }
  }, [fetchError, hasOverride]);

  const activePositions = hasOverride ? propsPositions : fetchedPositions;
  const isLoading = hasOverride ? false : isFetchLoading;

  // Form states
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const selectedPosition = activePositions?.find((p) => p.id === selectedPositionId);

  // Auto-select first position if available
  useEffect(() => {
    if (activePositions && activePositions.length > 0 && !selectedPositionId) {
      setSelectedPositionId(activePositions[0].id);
    }
  }, [activePositions, selectedPositionId]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedPositionId) {
      newErrors.position = "Please select a borrow position to repay";
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      newErrors.amount = "Please enter a valid positive amount";
    } else if (selectedPosition && numAmount > selectedPosition.amount) {
      newErrors.amount = `Repayment amount exceeds outstanding borrow amount of ${selectedPosition.amount} ${selectedPosition.asset}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMaxAmount = () => {
    if (selectedPosition) {
      setAmount(selectedPosition.amount.toString());
      setErrors((prev) => {
        const next = { ...prev };
        delete next.amount;
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("idle");
    setSubmitMessage("");

    if (validateForm() && selectedPosition) {
      setIsSubmitting(true);
      try {
        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        setSubmitStatus("success");
        setSubmitMessage("Repayment transaction details validated successfully.");
        
        onSubmit({
          asset: selectedPosition.asset,
          amount: parseFloat(amount),
          interestRate: 0, // Repayment submit contract does not need interest calculation rate
        });
      } catch (err) {
        setSubmitStatus("error");
        setSubmitMessage("An error occurred during transaction processing.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setSubmitStatus("error");
      setSubmitMessage("Please fix the errors in the form before continuing.");
    }
  };

  // Render skeletons while loading
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6" aria-label="Loading repayment details" aria-busy="true">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Render EmptyState if no active borrows
  if (!activePositions || activePositions.length === 0) {
    return (
      <div>
        <EmptyState
          title="No Outstanding Borrows"
          description="You do not have any active borrow positions to repay at the moment."
          icon={<Info className="h-8 w-8 text-[#097C4C]" aria-hidden="true" />}
        />
        {/* Render toast portal/container for any fetch failure errors */}
        {toasts.length > 0 && (
          <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-auto" role="alert" aria-label="Notifications">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={cn(
                  "p-4 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                  toast.type === "error" && "bg-red-50 text-red-800 border-red-200",
                  toast.type === "success" && "bg-green-50 text-green-800 border-green-200",
                  toast.type === "info" && "bg-blue-50 text-blue-800 border-blue-200"
                )}
              >
                <span>{toast.text}</span>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="ml-auto text-current opacity-70 hover:opacity-100 focus:outline-none"
                  aria-label="Close notification"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Repay Borrowed Assets
        </h2>
        <p className="text-gray-600 text-sm font-medium">
          Select an active borrow position and enter the amount you wish to repay.
        </p>
      </div>

      {submitMessage && (
        <div
          className={cn(
            "p-4 rounded-xl mb-6 text-sm font-semibold flex items-center gap-2",
            submitStatus === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200",
          )}
          role="alert"
          aria-live="polite"
        >
          {submitStatus === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {submitMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Select Borrow Position */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Select Active Borrow Position
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePositions.map((pos) => {
              const isSelected = pos.id === selectedPositionId;
              return (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => {
                    setSelectedPositionId(pos.id);
                    setAmount("");
                    setErrors({});
                  }}
                  className={cn(
                    "flex flex-col text-left p-4 rounded-xl border-2 transition-all duration-200 hover:border-[#097C4C]/50 focus:outline-none focus:ring-2 focus:ring-[#097C4C] focus:ring-offset-2",
                    isSelected
                      ? "border-[#097C4C] bg-[#E6F5EE]/20"
                      : "border-gray-200 bg-white"
                  )}
                  aria-pressed={isSelected}
                >
                  <div className="flex justify-between items-center w-full mb-1">
                    <span className="font-bold text-gray-900">{pos.asset}</span>
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-[#097C4C]" />
                    )}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">
                    Outstanding: {pos.amount.toLocaleString()} {pos.asset}
                  </div>
                  {pos.healthFactor !== undefined && (
                    <div className="text-xs text-gray-500 mt-1 font-medium">
                      Health Factor: <span className={cn(
                        pos.healthFactor >= 2.0 ? "text-green-600" :
                        pos.healthFactor >= 1.2 ? "text-amber-600" : "text-red-600"
                      )}>{pos.healthFactor.toFixed(2)}</span>
                    </div>
                  )}
                  {pos.nextDue && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Next Due: {pos.nextDue}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {errors.position && (
            <p className="text-xs text-red-500 mt-1.5">{errors.position}</p>
          )}
        </div>

        {/* Repayment Amount */}
        {selectedPosition && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="repay-amount" className="text-sm font-semibold text-gray-700">
                Amount to Repay
              </label>
              <button
                type="button"
                onClick={handleMaxAmount}
                className="text-xs font-semibold text-[#097C4C] hover:underline"
              >
                Max ({selectedPosition.amount.toLocaleString()} {selectedPosition.asset})
              </button>
            </div>
            <div className="relative">
              <Input
                id="repay-amount"
                type="number"
                step="any"
                placeholder={`0.00 ${selectedPosition.asset}`}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.amount;
                      return next;
                    });
                  }
                }}
                error={errors.amount}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          fullWidth
          className="bg-[#097C4C] hover:bg-[#0A3D1E] focus:ring-[#097C4C]"
        >
          Submit Repayment
        </Button>
      </form>

      {/* Floating Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-auto" role="alert" aria-label="Notifications">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                "p-4 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 flex items-center gap-2 animate-slide-in",
                toast.type === "error" && "bg-red-50 text-red-800 border-red-200",
                toast.type === "success" && "bg-green-50 text-green-800 border-green-200",
                toast.type === "info" && "bg-blue-50 text-blue-800 border-blue-200"
              )}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="ml-auto text-current opacity-70 hover:opacity-100 focus:outline-none"
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
