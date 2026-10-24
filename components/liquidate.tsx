"use client";

import { useState } from "react";
import { PageHeader, Toast } from "@/components/shared/common";
import { Input } from "@/components/shared/ui/Input";
import Button from "@/components/atoms/Button/Button";
import { isAccountId } from "@/lib/validation/stellar";
import {
  getLiquidationParams,
  getBorrowerPosition,
  isPositionLiquidatable,
  previewLiquidation,
  type BorrowerPosition,
  type LiquidationParams,
  type LiquidationPreview,
} from "@/lib/liquidation";
import { executeLiquidation, parseContractError } from "@/lib/tx";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { cn } from "@/lib/utils/cn";

interface LiquidateComponentProps {
  contractId?: string;
}

export default function LiquidateComponent({ contractId }: LiquidateComponentProps) {
  const { address: liquidatorAddress, isConnected } = useWalletConnection();
  const [borrowerAddress, setBorrowerAddress] = useState("");
  const [borrowerError, setBorrowerError] = useState("");
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [position, setPosition] = useState<BorrowerPosition | null>(null);
  const [params, setParams] = useState<LiquidationParams | null>(null);
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<LiquidationPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    variant: "processing" | "success" | "error" | "info";
    title?: string;
    description?: string;
  } | null>(null);

  const loadPosition = async () => {
    if (!borrowerAddress || !isAccountId(borrowerAddress)) {
      setBorrowerError("Please enter a valid Stellar address (starts with G)");
      return;
    }

    setBorrowerError("");
    setIsLoadingPosition(true);
    setPosition(null);
    setParams(null);
    setPreview(null);

    try {
      const [liquidationParams, borrowerPosition] = await Promise.all([
        getLiquidationParams(),
        getBorrowerPosition(borrowerAddress),
      ]);

      setParams(liquidationParams);
      setPosition(borrowerPosition);
    } catch (error) {
      setToast({
        variant: "error",
        title: "Failed to load position",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoadingPosition(false);
    }
  };

  const updatePreview = () => {
    if (!position || !params || !amount) {
      setPreview(null);
      return;
    }

    const amountBigInt = BigInt(amount);
    if (amountBigInt <= 0n) {
      setPreview(null);
      return;
    }

    const result = previewLiquidation({
      debt: position.debtAmount,
      collateral: position.collateralAmount,
      closeFactorBps: params.closeFactorBps,
      incentiveBps: params.liquidationIncentiveBps,
      amount: amountBigInt,
    });

    setPreview(result);
  };

  const handleSubmit = async () => {
    if (!isConnected) {
      setToast({
        variant: "error",
        title: "Wallet not connected",
        description: "Please connect your wallet to submit liquidation",
      });
      return;
    }

    if (!liquidatorAddress) {
      setToast({
        variant: "error",
        title: "No liquidator address",
        description: "Unable to determine your wallet address",
      });
      return;
    }

    if (!position || !params || !preview) {
      setToast({
        variant: "error",
        title: "Missing data",
        description: "Please load a borrower position and enter an amount",
      });
      return;
    }

    const status = isPositionLiquidatable(position, params);
    if (!status.liquidatable) {
      setToast({
        variant: "error",
        title: "Position not liquidatable",
        description: status.reason,
      });
      return;
    }

    if (borrowerAddress === liquidatorAddress) {
      setToast({
        variant: "error",
        title: "Self-liquidation blocked",
        description: "You cannot liquidate your own position",
      });
      return;
    }

    if (preview.actualRepay === 0n) {
      setToast({
        variant: "error",
        title: "Invalid amount",
        description: "Please enter a positive amount to liquidate",
      });
      return;
    }

    setIsSubmitting(true);
    setTxHash(null);

    try {
      const result = await executeLiquidation({
        liquidator: liquidatorAddress,
        borrower: borrowerAddress,
        debtAsset: "XLM", // For simplicity, using XLM as debt asset
        collateralAsset: "XLM", // For simplicity, using XLM as collateral
        amount: preview.actualRepay,
        contractId: contractId || "",
      });

      if (result.status === "success") {
        setTxHash(result.hash);
        setToast({
          variant: "success",
          title: "Liquidation submitted",
          description: `Transaction hash: ${result.hash}`,
        });

        // Refresh position after successful liquidation
        await loadPosition();
        setAmount("");
        setPreview(null);
      } else {
        setToast({
          variant: "error",
          title: "Liquidation failed",
          description: parseContractError(result.error),
        });
      }
    } catch (error) {
      setToast({
        variant: "error",
        title: "Liquidation error",
        description: parseContractError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSelfLiquidation = borrowerAddress === liquidatorAddress;
  const positionStatus = position && params
    ? isPositionLiquidatable(position, params)
    : null;

  const canSubmit =
    isConnected &&
    !!position &&
    !!params &&
    !!preview &&
    preview.actualRepay > 0n &&
    positionStatus?.liquidatable &&
    !isSelfLiquidation &&
    !isSubmitting;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(21,163,80,0.24)_0%,rgba(21,163,80,0.1)_38%,rgba(248,250,252,0)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-green-600 via-emerald-500 to-black" />
          <div className="p-6 sm:p-8">
            <PageHeader
              tone="light"
              title="Liquidate Positions"
              description="Inspect unhealthy borrower positions and execute liquidations to maintain protocol solvency."
              className="mb-0"
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="space-y-6">
            {/* Borrower Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Borrower Address
              </label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="G..."
                  value={borrowerAddress}
                  error={borrowerError}
                  onChange={(e) => {
                    setBorrowerAddress(e.target.value);
                    if (borrowerError) setBorrowerError("");
                  }}
                  fullWidth
                />
                <Button
                  onClick={loadPosition}
                  isLoading={isLoadingPosition}
                  disabled={!borrowerAddress || isLoadingPosition}
                >
                  Inspect
                </Button>
              </div>
            </div>

            {/* Position Card */}
            {position && params && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Position Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Collateral</p>
                    <p className="text-xl font-bold text-gray-900">
                      {position.collateralAmount.toString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Debt</p>
                    <p className="text-xl font-bold text-gray-900">
                      {position.debtAmount.toString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Health Factor</p>
                    <p className="text-xl font-bold text-gray-900">
                      {(Number(position.healthFactor) / 10000).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    {positionStatus && (
                      <span
                        className={cn(
                          "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
                          positionStatus.liquidatable
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700",
                        )}
                      >
                        {positionStatus.liquidatable
                          ? "Liquidatable"
                          : positionStatus.reason || "Healthy"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Parameters */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Liquidation Parameters
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Close Factor</p>
                      <p className="font-medium text-gray-900">
                        {(Number(params.closeFactorBps) / 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Liquidation Incentive</p>
                      <p className="font-medium text-gray-900">
                        {(Number(params.liquidationIncentiveBps) / 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Grace Period</p>
                      <p className="font-medium text-gray-900">
                        {params.gracePeriodSeconds}s
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Liquidation Input */}
            {position && params && positionStatus?.liquidatable && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Repay
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      updatePreview();
                    }}
                    helperText={
                      position
                        ? `Max repayable: ${
                            (position.debtAmount * params.closeFactorBps) / 10000n
                          }`
                        : undefined
                    }
                    fullWidth
                  />
                </div>

                {/* Preview */}
                {preview && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-blue-900 mb-3">
                      Liquidation Preview
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Actual Repay</span>
                        <span className="font-semibold text-gray-900">
                          {preview.actualRepay.toString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Seized Collateral (est.)</span>
                        <span className="font-semibold text-gray-900">
                          {preview.seizedEstimate.toString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Self-liquidation warning */}
                {isSelfLiquidation && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ You cannot liquidate your own position.
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={!canSubmit}
                  variant="success"
                  size="lg"
                  fullWidth
                >
                  {isSubmitting
                    ? "Submitting..."
                    : isSelfLiquidation
                      ? "Cannot liquidate own position"
                      : !isConnected
                        ? "Connect wallet to liquidate"
                        : "Execute Liquidation"}
                </Button>
              </div>
            )}
          </div>
        </section>

        {toast && (
          <Toast
            variant={toast.variant}
            title={toast.title}
            description={toast.description}
          />
        )}
      </div>
    </div>
  );
}
