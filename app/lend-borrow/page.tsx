"use client"

import type React from "react"

import { useState } from "react"
import { ChevronDown, ChevronUp, Check, X } from "lucide-react"

export default function LendBorrowPage() {
  const [activeTab, setActiveTab] = useState<"lend" | "borrow">("lend")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [transactionDetails, setTransactionDetails] = useState<any>(null)

  // Form state for lending
  const [lendAsset, setLendAsset] = useState("")
  const [lendAmount, setLendAmount] = useState("")
  const [lendInterestRate, setLendInterestRate] = useState(5)
  const [lendDuration, setLendDuration] = useState(30)

  // Form state for borrowing
  const [borrowAsset, setBorrowAsset] = useState("")
  const [borrowAmount, setBorrowAmount] = useState("")
  const [collateralAsset, setCollateralAsset] = useState("")
  const [collateralAmount, setCollateralAmount] = useState("")
  const [borrowInterestRate, setBorrowInterestRate] = useState(8)
  const [borrowDuration, setBorrowDuration] = useState(30)
  const [collateralRatio, setCollateralRatio] = useState(150)

  // Calculated values
  const estimatedEarnings =
    lendAmount && !isNaN(Number(lendAmount)) ? Number(lendAmount) * (lendInterestRate / 100) * (lendDuration / 365) : 0

  const repaymentAmount =
    borrowAmount && !isNaN(Number(borrowAmount))
      ? Number(borrowAmount) + Number(borrowAmount) * (borrowInterestRate / 100) * (borrowDuration / 365)
      : 0

  // Update collateral amount when borrow amount changes
  const updateCollateralAmount = (amount: string) => {
    if (amount && !isNaN(Number(amount))) {
      const required = (Number(amount) * collateralRatio) / 100
      setCollateralAmount(required.toFixed(6))
    } else {
      setCollateralAmount("")
    }
  }

  // Handle form submission
  const handleLendSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const selectedAsset = cryptoAssets.find((a) => a.id === lendAsset)

    setTransactionDetails({
      type: "lend",
      asset: selectedAsset?.name || lendAsset,
      amount: lendAmount,
      interestRate: lendInterestRate,
      duration: lendDuration,
      estimatedEarnings,
      totalReturn: Number(lendAmount) + estimatedEarnings,
    })

    setShowConfirmation(true)
  }

  const handleBorrowSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const selectedBorrowAsset = cryptoAssets.find((a) => a.id === borrowAsset)
    const selectedCollateralAsset = collateralAssets.find((a) => a.id === collateralAsset)

    setTransactionDetails({
      type: "borrow",
      borrowAsset: selectedBorrowAsset?.name || borrowAsset,
      borrowAmount,
      collateralAsset: selectedCollateralAsset?.name || collateralAsset,
      collateralAmount,
      collateralRatio,
      interestRate: borrowInterestRate,
      duration: borrowDuration,
      repaymentAmount,
    })

    setShowConfirmation(true)
  }

  const handleConfirm = () => {
    // Handle transaction confirmation
    setShowConfirmation(false)
    // Additional logic for submitting to blockchain/backend
  }

  return (
    <main className="container mx-auto px-4 py-12 max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">
        {activeTab === "lend" ? "Lend Your Assets" : "Borrow Assets"}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          {/* Tabs */}
          <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
            <div className="grid w-full grid-cols-2">
              <button
                onClick={() => setActiveTab("lend")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                  activeTab === "lend" ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50"
                }`}
              >
                Lend
              </button>
              <button
                onClick={() => setActiveTab("borrow")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                  activeTab === "borrow" ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50"
                }`}
              >
                Borrow
              </button>
            </div>
          </div>

          <div className="mt-6">
            {activeTab === "lend" ? (
              <form onSubmit={handleLendSubmit} className="space-y-6">
                {/* Asset Selection */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium">Select Asset</label>
                  <Select
                    value={lendAsset}
                    onChange={setLendAsset}
                    options={cryptoAssets.map((crypto) => ({
                      value: crypto.id,
                      label: crypto.name,
                      icon: crypto.icon,
                    }))}
                    placeholder="Select an asset"
                  />
                </div>

                {/* Amount Input */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium">Amount to Lend</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={lendAmount}
                      onChange={(e) => setLendAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-16"
                      min="0"
                      step="0.01"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                      {lendAsset ? lendAsset.toUpperCase() : "CRYPTO"}
                    </div>
                  </div>
                </div>

                {/* Interest Rate Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium">Interest Rate</label>
                    <span className="text-sm font-medium">{lendInterestRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.1"
                    value={lendInterestRate}
                    onChange={(e) => setLendInterestRate(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1%</span>
                    <span>15%</span>
                  </div>
                </div>

                {/* Duration Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium">Duration</label>
                    <span className="text-sm font-medium">{lendDuration} days</span>
                  </div>
                  <input
                    type="range"
                    min="7"
                    max="365"
                    step="1"
                    value={lendDuration}
                    onChange={(e) => setLendDuration(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>7 days</span>
                    <span>365 days</span>
                  </div>
                </div>

                {/* Estimated Earnings */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium mb-4">Estimated Earnings</h3>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span>Interest Rate:</span>
                      <span className="font-medium">{lendInterestRate}%</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span>Duration:</span>
                      <span className="font-medium">{lendDuration} days</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span>Estimated Earnings:</span>
                      <span className="font-medium">
                        {estimatedEarnings.toFixed(6)} {lendAsset ? lendAsset.toUpperCase() : "CRYPTO"}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                      <span>Total Return:</span>
                      <span className="font-bold">
                        {(Number(lendAmount || "0") + estimatedEarnings).toFixed(6)}{" "}
                        {lendAsset ? lendAsset.toUpperCase() : "CRYPTO"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#15A350] px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-[#15A350]/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 py-6 text-lg"
                >
                  Lend Now
                </button>
              </form>
            ) : (
              <form onSubmit={handleBorrowSubmit} className="space-y-6">
                {/* Asset to Borrow */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium">Asset to Borrow</label>
                  <Select
                    value={borrowAsset}
                    onChange={setBorrowAsset}
                    options={cryptoAssets.map((crypto) => ({
                      value: crypto.id,
                      label: crypto.name,
                      icon: crypto.icon,
                    }))}
                    placeholder="Select an asset"
                  />
                </div>

                {/* Amount to Borrow */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium">Amount to Borrow</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={borrowAmount}
                      onChange={(e) => {
                        setBorrowAmount(e.target.value)
                        updateCollateralAmount(e.target.value)
                      }}
                      placeholder="0.00"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-16"
                      min="0"
                      step="0.01"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                      {borrowAsset ? borrowAsset.toUpperCase() : "CRYPTO"}
                    </div>
                  </div>
                </div>

                {/* Collateral Asset */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium">Collateral Asset</label>
                  <Select
                    value={collateralAsset}
                    onChange={(value) => {
                      setCollateralAsset(value)
                      const selectedCollateral = collateralAssets.find((a) => a.id === value)
                      if (selectedCollateral) {
                        setCollateralRatio(selectedCollateral.ratio)
                        updateCollateralAmount(borrowAmount)
                      }
                    }}
                    options={collateralAssets.map((crypto) => ({
                      value: crypto.id,
                      label: `${crypto.name} (${crypto.ratio}% ratio)`,
                      icon: crypto.icon,
                    }))}
                    placeholder="Select collateral"
                  />
                </div>

                {/* Required Collateral */}
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium">Required Collateral</label>
                    <span className="text-sm text-gray-500">{collateralRatio}% ratio</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={collateralAmount}
                      readOnly
                      className="flex h-10 w-full rounded-md border border-input bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-16"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                      {collateralAsset ? collateralAsset.toUpperCase() : "CRYPTO"}
                    </div>
                  </div>
                </div>

                {/* Interest Rate Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium">Borrowing Rate</label>
                    <span className="text-sm font-medium">{borrowInterestRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    step="0.1"
                    value={borrowInterestRate}
                    onChange={(e) => setBorrowInterestRate(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>3%</span>
                    <span>20%</span>
                  </div>
                </div>

                {/* Duration Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium">Duration</label>
                    <span className="text-sm font-medium">{borrowDuration} days</span>
                  </div>
                  <input
                    type="range"
                    min="7"
                    max="365"
                    step="1"
                    value={borrowDuration}
                    onChange={(e) => setBorrowDuration(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>7 days</span>
                    <span>365 days</span>
                  </div>
                </div>

                {/* Loan Summary */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium mb-4">Loan Summary</h3>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span>Interest Rate:</span>
                      <span className="font-medium">{borrowInterestRate}%</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span>Loan Duration:</span>
                      <span className="font-medium">{borrowDuration} days</span>
                    </div>
                    <div className="flex justify-between mb-2">
                      <span>Interest Amount:</span>
                      <span className="font-medium">
                        {(repaymentAmount - Number(borrowAmount || "0")).toFixed(6)}{" "}
                        {borrowAsset ? borrowAsset.toUpperCase() : "CRYPTO"}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                      <span>Total Repayment:</span>
                      <span className="font-bold">
                        {repaymentAmount.toFixed(6)} {borrowAsset ? borrowAsset.toUpperCase() : "CRYPTO"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#15A350] px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-[#15A350]/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 py-6 text-lg"
                >
                  Borrow Now
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 h-fit">
          <TransactionSummary type={activeTab} />
        </div>
      </div>

      {showConfirmation && (
        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={() => setShowConfirmation(false)}
          onConfirm={handleConfirm}
          details={transactionDetails}
          type={activeTab as "lend" | "borrow"}
        />
      )}
    </main>
  )
}

// Custom Select Component
function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; icon?: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selectedOption ? (
          <div className="flex items-center gap-2">
            {selectedOption.icon && <img src={selectedOption.icon || "/icons/coins.svg"} alt="" className="w-5 h-5" />}
            <span>{selectedOption.label}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        {open ? <ChevronUp className="h-4 w-4 opacity-50" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
      </button>

      {open && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-1">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {value === option.value && <Check className="h-4 w-4" />}
                </span>
                <div className="flex items-center gap-2">
                  {option.icon && <img src={option.icon || "/icons/coins.svg"} alt="" className="w-5 h-5" />}
                  <span>{option.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Transaction Summary Component
function TransactionSummary({ type }: { type: "lend" | "borrow" }) {
  const [marketStats] = useState({
    totalLiquidity: "24,532,890",
    activeLoans: "1,245",
    avgInterestRate: type === "lend" ? "5.2" : "8.7",
    avgDuration: "45",
  })

  return (
    <div>
      <h3 className="text-xl font-bold mb-6">{type === "lend" ? "Lending Market" : "Borrowing Market"}</h3>

      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <img src="/icons/coins.svg" alt="Liquidity" className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Liquidity</h4>
            <p className="text-lg font-semibold">${marketStats.totalLiquidity}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <img src="/icons/connect.svg" alt="Active Loans" className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Loans</h4>
            <p className="text-lg font-semibold">{marketStats.activeLoans}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <img src="/icons/creditcard.svg" alt="Interest Rate" className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Avg. {type === "lend" ? "Interest" : "Borrowing"} Rate
            </h4>
            <p className="text-lg font-semibold">{marketStats.avgInterestRate}%</p>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-medium mb-4">How It Works</h4>
        <ol className="space-y-3 text-sm">
          {type === "lend" ? (
            <>
              <li className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium">
                  1
                </span>
                <span>Select the asset you want to lend and specify the amount</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium">
                  2
                </span>
                <span>Choose your preferred interest rate and lending duration</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium">
                  3
                </span>
                <span>Review the transaction details and confirm your lending</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium">
                  4
                </span>
                <span>Earn interest on your assets until the loan term ends</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium">
                  1
                </span>
                <span>Select the asset you want to borrow and specify the amount</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium">
                  2
                </span>
                <span>Choose your collateral asset (required to secure the loan)</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium">
                  3
                </span>
                <span>Set your loan duration and review the interest rate</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-medium">
                  4
                </span>
                <span>Repay the loan with interest before the term ends to retrieve your collateral</span>
              </li>
            </>
          )}
        </ol>
      </div>
    </div>
  )
}

// Confirmation Modal Component
function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  details,
  type,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  details: any
  type: "lend" | "borrow"
}) {
  if (!isOpen || !details) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <img src="/icons/connect.svg" className="w-5 h-5 text-blue-600 dark:text-blue-400" alt="Shield" />
          <h2 className="text-xl font-bold">Confirm {type === "lend" ? "Lending" : "Borrowing"} Transaction</h2>
        </div>

        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

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
              <img src="/icons/connect.svg" className="w-4 h-4" alt="Shield" />
              This transaction will be securely processed on the blockchain.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:w-auto w-full"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#15A350] px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-[#15A350]/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:w-auto w-full"
          >
            Confirm Transaction
          </button>
        </div>
      </div>
    </div>
  )
}

// Sample data
const cryptoAssets = [
  { id: "btc", name: "Bitcoin (BTC)", icon: "/icons/coins.svg" },
  { id: "eth", name: "Ethereum (ETH)", icon: "/icons/coins.svg" },
  { id: "usdt", name: "Tether (USDT)", icon: "/icons/coins.svg" },
  { id: "sol", name: "Solana (SOL)", icon: "/icons/coins.svg" },
]

const collateralAssets = [
  { id: "btc", name: "Bitcoin (BTC)", icon: "/icons/coins.svg", ratio: 150 },
  { id: "eth", name: "Ethereum (ETH)", icon: "/icons/coins.svg", ratio: 140 },
  { id: "sol", name: "Solana (SOL)", icon: "/icons/coins.svg", ratio: 130 },
]
