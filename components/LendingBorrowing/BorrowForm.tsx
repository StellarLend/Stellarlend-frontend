"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import InterestCalculator from "./InterestCalculator"

interface BorrowingFormProps {
  onSubmit: (details: any) => void
}

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

export default function BorrowingForm({ onSubmit }: BorrowingFormProps) {
  const [borrowAsset, setBorrowAsset] = useState("")
  const [borrowAmount, setBorrowAmount] = useState("")
  const [collateralAsset, setCollateralAsset] = useState("")
  const [collateralAmount, setCollateralAmount] = useState("")
  const [interestRate, setInterestRate] = useState(8)
  const [duration, setDuration] = useState(30)
  const [repaymentAmount, setRepaymentAmount] = useState(0)
  const [collateralRatio, setCollateralRatio] = useState(150)

  useEffect(() => {
    if (borrowAmount && !isNaN(Number.parseFloat(borrowAmount))) {
      // Simple interest calculation for demonstration
      const principal = Number.parseFloat(borrowAmount)
      const rateDecimal = interestRate / 100
      const timeYears = duration / 365
      const interest = principal * rateDecimal * timeYears
      setRepaymentAmount(principal + interest)
    } else {
      setRepaymentAmount(0)
    }
  }, [borrowAmount, interestRate, duration])

  useEffect(() => {
    // Update collateral ratio when collateral asset changes
    const selectedCollateral = collateralAssets.find((a) => a.id === collateralAsset)
    if (selectedCollateral) {
      setCollateralRatio(selectedCollateral.ratio)
    }
  }, [collateralAsset])

  useEffect(() => {
    // Calculate required collateral based on borrow amount and ratio
    if (borrowAmount && !isNaN(Number.parseFloat(borrowAmount))) {
      const requiredCollateral = (Number.parseFloat(borrowAmount) * collateralRatio) / 100
      setCollateralAmount(requiredCollateral.toFixed(6))
    }
  }, [borrowAmount, collateralRatio])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const selectedBorrowAsset = cryptoAssets.find((a) => a.id === borrowAsset)
    const selectedCollateralAsset = collateralAssets.find((a) => a.id === collateralAsset)

    onSubmit({
      type: "borrow",
      borrowAsset: selectedBorrowAsset?.name || borrowAsset,
      borrowAmount,
      collateralAsset: selectedCollateralAsset?.name || collateralAsset,
      collateralAmount,
      collateralRatio,
      interestRate,
      duration,
      repaymentAmount,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <label className="block text-sm font-medium">Asset to Borrow</label>
        <Select value={borrowAsset} onValueChange={setBorrowAsset}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an asset" />
          </SelectTrigger>
          <SelectContent>
            {cryptoAssets.map((crypto) => (
              <SelectItem key={crypto.id} value={crypto.id}>
                <div className="flex items-center gap-2">
                  <img src={crypto.icon || "/placeholder.svg"} alt={crypto.name} className="w-5 h-5" />
                  <span>{crypto.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium">Amount to Borrow</label>
        <div className="relative">
          <Input
            type="number"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(e.target.value)}
            placeholder="0.00"
            className="pr-16"
            min="0"
            step="0.01"
            required
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
            {borrowAsset ? borrowAsset.toUpperCase() : "CRYPTO"}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium">Collateral Asset</label>
        <Select value={collateralAsset} onValueChange={setCollateralAsset}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select collateral" />
          </SelectTrigger>
          <SelectContent>
            {collateralAssets.map((crypto) => (
              <SelectItem key={crypto.id} value={crypto.id}>
                <div className="flex items-center gap-2">
                  <img src={crypto.icon || "/placeholder.svg"} alt={crypto.name} className="w-5 h-5" />
                  <span>
                    {crypto.name} ({crypto.ratio}% ratio)
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between">
          <label className="block text-sm font-medium">Required Collateral</label>
          <span className="text-sm text-gray-500">{collateralRatio}% ratio</span>
        </div>
        <div className="relative">
          <Input type="text" value={collateralAmount} readOnly className="pr-16 bg-gray-50 dark:bg-gray-900" />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
            {collateralAsset ? collateralAsset.toUpperCase() : "CRYPTO"}
          </div>
        </div>
      </div>

      <InterestCalculator
        interestRate={interestRate}
        setInterestRate={setInterestRate}
        duration={duration}
        setDuration={setDuration}
        type="borrow"
      />

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-4">Loan Summary</h3>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span>Interest Rate:</span>
            <span className="font-medium">{interestRate}%</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Loan Duration:</span>
            <span className="font-medium">{duration} days</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Interest Amount:</span>
            <span className="font-medium">
              {(repaymentAmount - Number.parseFloat(borrowAmount || "0")).toFixed(6)}{" "}
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

      <Button type="submit" className="w-full py-6 text-lg">
        Borrow Now
      </Button>
    </form>
  )
}
