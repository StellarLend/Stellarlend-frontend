"use client"

import { useState } from "react"
import { ShieldBlockchain } from "@/components/ui/icons/ShieldBlockchain"
import { Dollar } from "@/components/ui/icons/Dollar"
import { Zap } from "@/components/ui/icons/Zap"

interface TransactionSummaryProps {
  type: "lend" | "borrow"
}

export default function TransactionSummary({ type }: TransactionSummaryProps) {
  const [marketStats, setMarketStats] = useState({
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
            <Dollar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Liquidity</h4>
            <p className="text-lg font-semibold">${marketStats.totalLiquidity}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <ShieldBlockchain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Loans</h4>
            <p className="text-lg font-semibold">{marketStats.activeLoans}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
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
