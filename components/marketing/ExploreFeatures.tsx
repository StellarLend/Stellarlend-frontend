"use client";

import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Dollar } from '../shared/ui/icons/Dollar';
import { ShieldBlockchain } from '../shared/ui/icons/ShieldBlockchain';
import { Zap } from '../shared/ui/icons/Zap';
import { Global } from '../shared/ui/icons/Global';
import { Union } from '../shared/ui/icons/Union';
import { File } from '../shared/ui/icons/File';

const features = [
  {
    icon: Dollar,
    title: "Ultra-Low\nFees",
    description: "Stellar's network ensures transactions cost less than a cent, maximizing your returns."
  },
  {
    icon: ShieldBlockchain,
    title: "Bank-Grade\nSecurity",
    description: "Audited smart contracts and multi-signature protection keep your assets safe."
  },
  {
    icon: Zap,
    title: "3-Second\nSettlements",
    description: "Near-instant transactions mean you never miss market opportunities."
  },
  {
    icon: Global,
    title: "Borderless\nAccess",
    description: "Available worldwide with no geographic restrictions or KYC barriers."
  },
  {
    icon: File,
    title: "Smart Risk\nManagement",
    description: "AI-powered liquidation protection and dynamic collateral ratios."
  },
  {
    icon: Dollar,
    title: "Competitive\nAPYs",
    description: "Earn up to 12% APY on stablecoins with automated compounding."
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
            className="flex flex-col justify-center items-center md:items-start lg:col-span-3"
            variants={itemVariants}
          >
            <h2 className="text-[40px] leading-[100%] font-bold text-[#00FF7F] mb-4 text-center md:text-left">
              Why Choose Stellarlend?
            </h2>
            <p className="text-[#AAABAB] text-lg mb-6 text-center md:text-left max-w-2xl">
              Experience the future of DeFi lending with our cutting-edge features designed for maximum security and returns.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/lending"
                className="bg-[#15A350] text-white flex items-center py-3 px-8 rounded-lg
                 hover:bg-[#128F42] transition-all duration-300 font-medium"
              >
                Start Earning <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
              <Link
                href="/borrow"
                className="border border-[#15A350] text-[#15A350] flex items-center py-3 px-8 rounded-lg
                 hover:bg-[#15A350] hover:text-white transition-all duration-300 font-medium"
              >
                Borrow Now <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </div>
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