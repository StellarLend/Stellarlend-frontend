"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/Button"
import { ShieldBlockchain } from "@/components/ui/icons/ShieldBlockchain"

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  details: any
  type: "lend" | "borrow"
}

export default function ConfirmationModal({ isOpen, onClose, onConfirm, details, type }: ConfirmationModalProps) {
  if (!details) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldBlockchain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Confirm {type === "lend" ? "Lending" : "Borrowing"} Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-3">
            {type === "lend" ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Asset:</span>
                  <span className="font-medium">{details.asset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-medium">
                    {details.amount} {details.asset?.split(" ")[1]?.replace(/[()]/g, "")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interest Rate:</span>
                  <span className="font-medium">{details.interestRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-medium">{details.duration} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Estimated Earnings:</span>
                  <span className="font-medium">
                    {details.estimatedEarnings.toFixed(6)} {details.asset?.split(" ")[1]?.replace(/[()]/g, "")}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <span className="text-gray-500">Total Return:</span>
                  <span className="font-bold">
                    {details.totalReturn.toFixed(6)} {details.asset?.split(" ")[1]?.replace(/[()]/g, "")}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Borrow Asset:</span>
                  <span className="font-medium">{details.borrowAsset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Borrow Amount:</span>
                  <span className="font-medium">
                    {details.borrowAmount} {details.borrowAsset?.split(" ")[1]?.replace(/[()]/g, "")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Collateral Asset:</span>
                  <span className="font-medium">{details.collateralAsset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Collateral Amount:</span>
                  <span className="font-medium">
                    {details.collateralAmount} {details.collateralAsset?.split(" ")[1]?.replace(/[()]/g, "")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Collateral Ratio:</span>
                  <span className="font-medium">{details.collateralRatio}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interest Rate:</span>
                  <span className="font-medium">{details.interestRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-medium">{details.duration} days</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <span className="text-gray-500">Total Repayment:</span>
                  <span className="font-bold">
                    {details.repaymentAmount.toFixed(6)} {details.borrowAsset?.split(" ")[1]?.replace(/[()]/g, "")}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 text-sm text-gray-500">
            <p className="flex items-center gap-1.5">
              <ShieldBlockchain className="w-4 h-4" />
              This transaction will be securely processed on the blockchain.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="sm:w-auto w-full">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="sm:w-auto w-full">
            Confirm Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
