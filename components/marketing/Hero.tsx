"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Button from "../shared/ui/Button";
import Image from "next/image";
import HeroImage from "@/public/images/heroimg1.png";
import MobileHeroImage from "@/public/images/heromobile.png";
import { motion } from "framer-motion";

export default function Hero() {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  const imageVariants = {
    hidden: { scale: 0.95, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 0.7, ease: "easeOut", delay: 0.6 },
    },
  };

  return (
    <motion.div
      className="rounded-b-3xl rounded-bl-3xl h-fit"
      style={{
        backgroundImage: `url('/images/herogradient.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        width: "100%",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="px-5 md:px-10 xl:px-30 pt-20 flex flex-col gap-6 xl:gap-10">
        <motion.div
          className="flex flex-col justify-center items-center gap-4 md:gap-8 max-w-xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            className="font-bold min-[500px]:w-5/6 md:w-3/4 xl:w-full text-[32px] xl:text-6xl text-center"
            variants={itemVariants}
          >
            DeFi Lending, Reimagined on Stellar
          </motion.h1>

          <motion.p
            className="font-medium texy-sm xl:text-lg text-[#AAABAB] text-center"
            variants={itemVariants}
          >
            Borrow instantly, earn competitively. Built on Stellar's network for 
            ultra-low fees, lightning-fast settlements, and complete transparency.
          </motion.p>

          <motion.div
            className="flex flex-col md:flex-row gap-4"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <Button
                text="Launch App"
                className="bg-[#15A350] 
                text-[#F8F8F8] text-xs md:text-sm font-medium rounded-lg 
                flex items-center py-2 sm:py-3 px-4 sm:px-6 cursor-pointer"
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <Button
                text="Sign Up"
                className="border border-[#15A350] text-[#15A350] 
                text-xs md:text-sm font-medium rounded-lg 
                flex items-center py-2 sm:py-3 px-4 sm:px-6 cursor-pointer
                hover:bg-[#15A350] hover:text-[#F8F8F8] transition-all"
              />
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div variants={imageVariants} initial="hidden" animate="visible">
          <Image
            src={HeroImage}
            width={1140}
            height={800}
            alt="DeFi lending platform interface"
            className="hidden md:block md:mx-auto"
          />
          <Image
            src={MobileHeroImage}
            alt="Mobile DeFi lending interface"
            className="ml-5 rounded-br-3xl min-[735px]:ml-6 md:hidden"
          />
        </motion.div>

        {/* Trust indicators */}
        <motion.div 
          className="flex flex-wrap justify-center items-center gap-6 md:gap-10 mt-8 md:mt-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#15A350] rounded-full"></div>
            <span className="text-sm text-[#AAABAB]">Audited Smart Contracts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#15A350] rounded-full"></div>
            <span className="text-sm text-[#AAABAB]">1000+ Active Users</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#15A350] rounded-full"></div>
            <span className="text-sm text-[#AAABAB]">$2M+ TVL</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
