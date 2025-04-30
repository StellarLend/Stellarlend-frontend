"use client"

import { Slider } from "@/components/ui/slider"

interface InterestCalculatorProps {
  interestRate: number
  setInterestRate: (rate: number) => void
  duration: number
  setDuration: (days: number) => void
  type: "lend" | "borrow"
}

export default function InterestCalculator({
  interestRate,
  setInterestRate,
  duration,
  setDuration,
  type,
}: InterestCalculatorProps) {
  // Different rate ranges based on whether lending or borrowing
  const minRate = type === "lend" ? 1 : 3
  const maxRate = type === "lend" ? 15 : 20

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex justify-between">
          <label className="block text-sm font-medium">{type === "lend" ? "Interest Rate" : "Borrowing Rate"}</label>
          <span className="text-sm font-medium">{interestRate}%</span>
        </div>
        <Slider
          value={[interestRate]}
          onValueChange={(values) => setInterestRate(values[0])}
          min={minRate}
          max={maxRate}
          step={0.1}
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{minRate}%</span>
          <span>{maxRate}%</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between">
          <label className="block text-sm font-medium">Duration</label>
          <span className="text-sm font-medium">{duration} days</span>
        </div>
        <Slider value={[duration]} onValueChange={(values) => setDuration(values[0])} min={7} max={365} step={1} />
        <div className="flex justify-between text-xs text-gray-500">
          <span>7 days</span>
          <span>365 days</span>
        </div>
      </div>
    </div>
  )
}
