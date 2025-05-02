"use client";

import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Dollar } from './ui/icons/Dollar';
import { ShieldBlockchain } from './ui/icons/ShieldBlockchain';
import { Zap } from './ui/icons/Zap';
import { Global } from './ui/icons/Global';
import { Union } from './ui/icons/Union';
import { File } from './ui/icons/File';

const features = [
  {
    icon: Dollar,
    title: "Low-Cost Lending &\nBorrowing",
    description: "Enjoy Stellar's ultra-low fees and fast transactions."
  },
  {
    icon: ShieldBlockchain,
    title: "Secure &\nTransparent",
    description: "Full custody of assets with audited smart contracts."
  },
  {
    icon: Zap,
    title: "Instant\nSettlements",
    description: "No waiting times, immediate access to funds."
  },
  {
    icon: Global,
    title: "Global\nAccess",
    description: "Open to anyone, including the unbanked."
  },
  {
    icon: File,
    title: "Automated\nRisk Controls",
    description: "AI-driven collateral and liquidation management."
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5
    }
  }
};

export default function ExploreFeatures() {
  return (
    <section className="py-20 bg-black">
      <div className="container max-w-6xl mx-auto px-4">
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div 
            className="flex flex-col justify-center items-center md:items-start"
            variants={itemVariants}
          >
            <h2 className="text-[40px] leading-[100%] font-bold text-[#00FF7F] mb-6 text-center md:text-left">
              Explore Our Features
            </h2>
            <Link
            href="/lending"
            className="text-[#AAABAB] flex items-center border py-2 sm:py-3 px-4 sm:px-8 rounded-lg border-[#1D2025]
             hover:text-[#15A350] hover:border-[#15A350] transition-all duration-300"
          >
            Start Lending <ChevronRight className="h-4 w-4 ml-1 text-[#AAABAB] group-hover:text-[#15A350]" />
          </Link>
          </motion.div>

          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                className="p-6 rounded-lg bg-[#111111] border border-gray-800 
                          transition-all duration-300 hover:border-[#00FF7F] 
                          hover:shadow-lg hover:shadow-[#00FF7F]/10 group
                          h-[280px]"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <motion.div 
                    className="relative w-[84px] h-[84px] group-hover:rotate-3 transition-transform duration-300"
                  >
                    {/* Outer background with border */}
                    <div className="absolute inset-0 rounded-xl bg-transparent border border-gray-800"></div>
                    {/* Inner background with border and color */}
                    <div className="absolute inset-[3px] rounded-lg bg-[#111111] border border-gray-800 
                                  group-hover:border-[#00FF7F] transition-colors duration-300">
                      <div className="flex items-center justify-center h-full">
                        <Icon
                          className="w-8 h-8 text-white group-hover:text-[#00FF7F] transition-colors duration-300"
                          width={32}
                          height={32}
                        />
                      </div>
                    </div>
                  </motion.div>
                  <motion.div 
                    className="relative w-[199px] h-[84px] flex items-center group-hover:scale-105 transition-transform duration-300"
                  >
                    <Union className="text-gray-600 group-hover:text-[#00FF7F] transition-colors duration-300" />
                  </motion.div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2 
                              group-hover:text-[#00FF7F] transition-colors duration-300 whitespace-pre-line">
                  {feature.title}
                </h3>
                <p className="text-gray-400">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
} 