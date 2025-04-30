"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import InterestCalculator from "./InterestCalculator"

interface LendingFormProps {
  onSubmit: (details: any) => void
}

const cryptoAssets = [
  { id: "btc", name: "Bitcoin (BTC)", icon: "/icons/coins.svg" },
  { id: "eth", name: "Ethereum (ETH)", icon: "/icons/coins.svg" },
  { id: "usdt", name: "Tether (USDT)", icon: "/icons/coins.svg" },
  { id: "sol", name: "Solana (SOL)", icon: "/icons/coins.svg" },
]

export default function LendingForm({ onSubmit }: LendingFormProps) {
  const [asset, setAsset] = useState("")
  const [amount, setAmount] = useState("")
  const [interestRate, setInterestRate] = useState(5)
  const [duration, setDuration] = useState(30)
  const [estimatedEarnings, setEstimatedEarnings] = useState(0)

  useEffect(() => {
    if (amount && !isNaN(Number.parseFloat(amount))) {
      // Simple interest calculation for demonstration
      const principal = Number.parseFloat(amount)
      const rateDecimal = interestRate / 100
      const timeYears = duration / 365
      const earnings = principal * rateDecimal * timeYears
      setEstimatedEarnings(earnings)
    } else {
      setEstimatedEarnings(0)
    }
  }, [amount, interestRate, duration])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const selectedAsset = cryptoAssets.find((a) => a.id === asset)

    onSubmit({
      type: "lend",
      asset: selectedAsset?.name || asset,
      amount,
      interestRate,
      duration,
      estimatedEarnings,
      totalReturn: Number.parseFloat(amount) + estimatedEarnings,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <label className="block text-sm font-medium">Select Asset</label>
        <Select value={asset} onValueChange={setAsset}>
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
        <label className="block text-sm font-medium">Amount to Lend</label>
        <div className="relative">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="pr-16"
            min="0"
            step="0.01"
            required
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
            {asset ? asset.toUpperCase() : "CRYPTO"}
          </div>
        </div>
      </div>

      <InterestCalculator
        interestRate={interestRate}
        setInterestRate={setInterestRate}
        duration={duration}
        setDuration={setDuration}
        type="lend"
      />

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-4">Estimated Earnings</h3>
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span>Interest Rate:</span>
            <span className="font-medium">{interestRate}%</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Duration:</span>
            <span className="font-medium">{duration} days</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>Estimated Earnings:</span>
            <span className="font-medium">
              {estimatedEarnings.toFixed(6)} {asset ? asset.toUpperCase() : "CRYPTO"}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
            <span>Total Return:</span>
            <span className="font-bold">
              {(Number.parseFloat(amount || "0") + estimatedEarnings).toFixed(6)}{" "}
              {asset ? asset.toUpperCase() : "CRYPTO"}
            </span>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full py-6 text-lg">
        Lend Now
      </Button>
    </form>
  )
}
