"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight } from "lucide-react"

interface Step {
  id: number
  title: string
  description: string
  iconPath: string
  alt: string
}

export default function HowItWorks(){
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const steps: Step[] = [
    {
      id: 1,
      title: "Connect Your Wallet",
      description: "Securely connect your Stellar-compatible wallet to access the platform.",
      iconPath: "/icons/connect.svg",
      alt: "connect",
    },
    {
      id: 2,
      title: "Deposit Collateral",
      description: "Lock your assets as collateral to start borrowing instantly.",
      iconPath: "/icons/coins.svg",
      alt: "deposit",
    },
    {
      id: 3,
      title: "Get a Loan",
      description: "Receive funds in your wallet with minimal fees and fast settlement.",
      iconPath: "/icons/creditcard.svg",
      alt: "loan",
    },
  ]

  return (
    <section className="w-full bg-black py-8 sm:py-10 md:py-12 px-4 sm:px-6 md:px-8 lg:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-bold text-[#15A350]">How It Works</h2>
          <Link
            href="/lending"
            className="text-[#AAABAB] hidden md:flex items-center border py-2 sm:py-3 px-4 sm:px-8 rounded-lg border-[#1D2025]
             hover:text-[#15A350] hover:border-[#15A350] transition-all duration-300"
          >
            Start Lending <ChevronRight className="h-4 w-4 ml-1 text-[#AAABAB] group-hover:text-[#15A350]" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-5 md:gap-6 mb-6 sm:mb-8">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`relative rounded-2xl border border-[#1D2025] bg-[#0D0D0D] p-4 sm:p-5 
                transition-all duration-300 cursor-pointer h-auto min-h-[280px] sm:min-h-[320px] md:min-h-[380px]
                ${hoveredCard === step.id ? "border-[#15A350] shadow-[0_0_15px_rgba(21,163,80,0.2)]" : "hover:border-[#15A350]"}`}
              onMouseEnter={() => setHoveredCard(step.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="flex flex-col justify-between h-full">
                <div className="flex justify-center items-center mb-4 sm:mb-6 md:mb-8 pt-2 sm:pt-4 md:pt-6">
                  <Image
                    src={step.iconPath || "/placeholder.svg"}
                    alt={step.alt}
                    width={120}
                    height={120}
                    className=" min-[500px]:mr-auto sm:m-auto "
                  />
                </div>
                <div className="flex flex-col gap-2 sm:gap-3">
                  <div className="flex justify-between items-center gap-2 sm:gap-3">
                    <h3 className="text-lg sm:text-xl md:text-xl font-semibold text-white">{step.title}</h3>
                    <span
                      className="flex items-center justify-center text-xs sm:text-sm md:text-base w-6 h-6 sm:h-8 sm:w-8 xl:h-10 xl:w-10 
                        border rounded-full font-medium shrink-0 mt-0.5"

                    >
                      {step.id}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-[#AAABAB] ">{step.description}</p>
                </div>  
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center sm:justify-start mt-6 sm:mt-8">
          <Link
            href="/lending"
            className="text-[#AAABAB] md:hidden flex items-center border py-2 sm:py-3 px-4 sm:px-6 rounded-lg border-[#1D2025]
             hover:text-[#15A350] hover:border-[#15A350] transition-all duration-300 text-sm sm:text-base"
          >
            Start Lending <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 text-[#AAABAB]" />
          </Link>
        </div>
      </div>
    </section>
  )
}

