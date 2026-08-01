"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/shared/ui/Button";
import Image from "next/image";
import HeroImage from "@/public/images/heroimg1.png";
import MobileHeroImage from "@/public/images/heromobile.png";
import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** WCAG AA-friendly muted text on dark/green gradient backgrounds. */
const MUTED_ON_DARK = "#D1D5DB"; // ~ gray-300 — higher contrast than #AAABAB on green

export default function Hero() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const containerVariants: Variants = useMemo(
    () => ({
      hidden: { opacity: reduceMotion ? 1 : 0 },
      visible: {
        opacity: 1,
        transition: reduceMotion
          ? { duration: 0 }
          : {
              staggerChildren: 0.2,
              delayChildren: 0.3,
            },
      },
    }),
    [reduceMotion],
  );

  const itemVariants: Variants = useMemo(
    () => ({
      hidden: reduceMotion ? { opacity: 1, y: 0 } : { y: 20, opacity: 0 },
      visible: {
        y: 0,
        opacity: 1,
        transition: reduceMotion
          ? { duration: 0 }
          : { duration: 0.5, ease: "easeOut" as const },
      },
    }),
    [reduceMotion],
  );

  const imageVariants: Variants = useMemo(
    () => ({
      hidden: reduceMotion ? { opacity: 1, scale: 1 } : { scale: 0.95, opacity: 0 },
      visible: {
        scale: 1,
        opacity: 1,
        transition: reduceMotion
          ? { duration: 0 }
          : { duration: 0.7, ease: "easeOut" as const, delay: 0.6 },
      },
    }),
    [reduceMotion],
  );

  return (
    <motion.section
      aria-labelledby="hero-heading"
      className="rounded-b-3xl rounded-bl-3xl h-fit"
      style={{
        backgroundImage: `url('/images/herogradient.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        width: "100%",
        // Solid fallback keeps text readable if the gradient image fails to load.
        backgroundColor: "#0A3D1E",
      }}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.5 }}
    >
      <div className="px-5 md:px-10 xl:px-30 pt-20 flex flex-col gap-6 xl:gap-10">
        <motion.div
          className="flex flex-col justify-center items-center gap-4 md:gap-8 max-w-xl mx-auto"
          variants={containerVariants}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <motion.h1
            id="hero-heading"
            className="font-bold min-[500px]:w-5/6 md:w-3/4 xl:w-full text-[32px] xl:text-6xl text-center text-white"
            variants={itemVariants}
          >
            DeFi Lending, Reimagined on Stellar
          </motion.h1>

          <motion.p
            className="font-medium text-sm xl:text-lg text-center"
            style={{ color: MUTED_ON_DARK }}
            variants={itemVariants}
          >
            Borrow instantly, earn competitively. Built on Stellar&apos;s network for
            ultra-low fees, lightning-fast settlements, and complete transparency.
          </motion.p>

          <motion.div
            className="flex flex-col md:flex-row gap-4"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <Button
                text="Launch App"
                onClick={() => router.push("/lending")}
                className="bg-[#15A350] text-[#F8F8F8] text-xs md:text-sm font-medium rounded-lg flex items-center py-2 sm:py-3 px-4 sm:px-6 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D1E]"
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <Button
                text="Sign Up"
                onClick={() => router.push("/lending")}
                className="border-2 border-[#15A350] text-[#15A350] bg-white/95 text-xs md:text-sm font-medium rounded-lg flex items-center py-2 sm:py-3 px-4 sm:px-6 cursor-pointer hover:bg-[#15A350] hover:text-[#F8F8F8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D1E]"
              />
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          variants={imageVariants}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <Image
            src={HeroImage}
            width={1140}
            height={800}
            alt="DeFi lending platform interface"
            className="hidden md:block md:mx-auto"
            priority
          />
          <Image
            src={MobileHeroImage}
            width={640}
            height={800}
            alt="Mobile DeFi lending interface"
            className="ml-5 rounded-br-3xl min-[735px]:ml-6 md:hidden"
          />
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center items-center gap-6 md:gap-10 mt-8 md:mt-12"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.8 }
          }
          role="list"
          aria-label="Trust indicators"
        >
          {[
            "Audited Smart Contracts",
            "1000+ Active Users",
            "$2M+ TVL",
          ].map((label) => (
            <div key={label} className="flex items-center gap-2" role="listitem">
              <div
                className="w-2 h-2 bg-[#15A350] rounded-full"
                aria-hidden="true"
              />
              <span className="text-sm" style={{ color: MUTED_ON_DARK }}>
                {label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}
