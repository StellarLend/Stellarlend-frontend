'use client'

import Image from 'next/image'
import Button from '../shared/ui/Button'
import Link from 'next/link'
import { ChevronRight, Shield, Zap, Lock } from 'lucide-react'
import { motion } from 'framer-motion'

export default function FastSecure() {
  const trustFeatures = [
    {
      icon: Shield,
      title: "Audited Smart Contracts",
      description: "Independent security audits ensure your funds are protected"
    },
    {
      icon: Zap,
      title: "3-Second Settlements",
      description: "Stellar's network delivers near-instant transactions"
    },
    {
      icon: Lock,
      title: "Non-Custodial",
      description: "You maintain full control of your assets at all times"
    }
  ]

  return (
    <section className="bg-black py-20">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Built for <span className="text-[#15A350]">Security & Speed</span>
          </h2>
          <p className="text-lg text-[#AAABAB] max-w-3xl mx-auto">
            Powered by Stellar's battle-tested blockchain and Soroban smart contracts, 
            Stellarlend combines enterprise-grade security with lightning-fast transactions.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Image
              src="/images/fast-secure.svg"
              alt="Secure DeFi lending platform"
              width={500}
              height={400}
              className="w-full h-auto rounded-lg"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            {trustFeatures.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-[#15A350]/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#15A350]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-[#AAABAB]">{feature.description}</p>
                  </div>
                </div>
              )
            })}

            <motion.div
              className="flex flex-col sm:flex-row gap-4 pt-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              viewport={{ once: true }}
            >
              <Button
                className="bg-[#15A350] text-white rounded-lg px-6 py-3 hover:bg-[#128F42] transition-colors"
                text="Launch App"
              />
              <Link
                href="/security"
                className="border border-[#15A350] text-[#15A350] font-medium flex items-center justify-center px-6 py-3 rounded-lg 
                  hover:bg-[#15A350] hover:text-white transition-all duration-300"
              >
                Learn About Security
                <ChevronRight className="w-4 h-4 ml-2" />
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Security stats */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-[#1D2025]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-[#15A350] mb-2">$2M+</div>
            <div className="text-[#AAABAB] text-sm">Total Value Locked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-[#15A350] mb-2">0</div>
            <div className="text-[#AAABAB] text-sm">Security Incidents</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-[#15A350] mb-2">3s</div>
            <div className="text-[#AAABAB] text-sm">Avg. Transaction Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-[#15A350] mb-2">&lt;0.01</div>
            <div className="text-[#AAABAB] text-sm">Transaction Fee (XLM)</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
