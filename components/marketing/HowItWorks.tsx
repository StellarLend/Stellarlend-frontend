"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Step {
  id: number;
  title: string;
  description: string;
  iconPath: string;
  alt: string;
}

/** Higher-contrast muted text on near-black backgrounds (WCAG AA). */
const MUTED_ON_BLACK = "#D1D5DB";

export default function HowItWorks() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [focusedCard, setFocusedCard] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  const steps: Step[] = [
    {
      id: 1,
      title: "Connect Wallet",
      description:
        "Securely connect your Stellar wallet with one click. No registration required.",
      iconPath: "/icons/connect.svg",
      alt: "Connect wallet icon",
    },
    {
      id: 2,
      title: "Choose Your Path",
      description:
        "Lend assets to earn competitive APY or borrow against your collateral instantly.",
      iconPath: "/icons/coins.svg",
      alt: "Choose lend or borrow icon",
    },
    {
      id: 3,
      title: "Start Earning",
      description:
        "Watch your assets grow with real-time tracking and automated compound interest.",
      iconPath: "/icons/creditcard.svg",
      alt: "Start earning icon",
    },
  ];

  const transitionClass = reduceMotion
    ? ""
    : "transition-all duration-300";

  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="w-full bg-black py-8 sm:py-10 md:py-12 px-4 sm:px-6 md:px-8 lg:px-12"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8 md:mb-10">
          <div className="text-center md:text-left">
            <h2
              id="how-it-works-heading"
              className="text-2xl sm:text-3xl md:text-[40px] font-bold text-[#15A350] mb-2"
            >
              How It Works
            </h2>
            <p
              className="text-sm md:text-base max-w-lg"
              style={{ color: MUTED_ON_BLACK }}
            >
              Get started in minutes with our simple, secure process
            </p>
          </div>
          <Link
            href="/lending"
            className={`text-white hidden md:flex items-center border-2 py-2 sm:py-3 px-4 sm:px-8 rounded-lg border-[#15A350] hover:bg-[#15A350] hover:text-white ${transitionClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
          >
            Start Lending{" "}
            <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
          </Link>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-5 md:gap-6 mb-6 sm:mb-8 list-none p-0 m-0">
          {steps.map((step) => {
            const active =
              hoveredCard === step.id || focusedCard === step.id;
            return (
              <li
                key={step.id}
                className={`relative rounded-2xl border bg-[#0D0D0D] p-4 sm:p-5 h-auto min-h-[280px] sm:min-h-[320px] md:min-h-[380px] ${transitionClass} ${
                  active
                    ? "border-[#15A350] shadow-[0_0_15px_rgba(21,163,80,0.2)]"
                    : "border-[#3A3F47] hover:border-[#15A350]"
                }`}
                onMouseEnter={() => setHoveredCard(step.id)}
                onMouseLeave={() => setHoveredCard(null)}
                onFocus={() => setFocusedCard(step.id)}
                onBlur={() => setFocusedCard(null)}
              >
                <div className="flex flex-col justify-between h-full">
                  <div className="flex justify-center items-center mb-4 sm:mb-6 md:mb-8 pt-2 sm:pt-4 md:pt-6">
                    <Image
                      src={step.iconPath || "/placeholder.svg"}
                      alt={step.alt}
                      width={120}
                      height={120}
                      className="min-[500px]:mr-auto sm:m-auto"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="flex justify-between items-center gap-2 sm:gap-3">
                      <h3 className="text-lg sm:text-xl md:text-xl font-semibold text-white">
                        {step.title}
                      </h3>
                      <span
                        className="flex items-center justify-center text-xs sm:text-sm md:text-base w-6 h-6 sm:h-8 sm:w-8 xl:h-10 xl:w-10 border-2 border-[#15A350] text-[#15A350] rounded-full font-semibold shrink-0 mt-0.5 bg-[#0A3D1E]/20"
                        aria-label={`Step ${step.id}`}
                      >
                        {step.id}
                      </span>
                    </div>
                    <p
                      className="text-sm sm:text-base"
                      style={{ color: MUTED_ON_BLACK }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex justify-center sm:justify-start mt-6 sm:mt-8">
          <Link
            href="/lending"
            className={`text-white md:hidden flex items-center border-2 py-2 sm:py-3 px-4 sm:px-6 rounded-lg border-[#15A350] hover:bg-[#15A350] ${transitionClass} text-sm sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
          >
            Start Lending{" "}
            <ChevronRight
              className="h-3 w-3 sm:h-4 sm:w-4 ml-1"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </section>
  );
}
