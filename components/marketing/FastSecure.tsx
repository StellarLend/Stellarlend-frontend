'use client'

import Image from 'next/image'
import Button from '../shared/ui/Button'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function FastSecure() {
  return (
    <section className="bg-secondary p-5">
      <div className="flex max-md:flex-col justify-center items-center lg:gap-12 bg-primary rounded-2xl md:p-7 p-6">
        <div className="max-w-[560px] max-md:text-center">
          <motion.h2
            className="text-brand-white font-bold md:text-6xl text-3xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            Fast & Secure DeFi <span className="block">Lending on Stellar</span>
          </motion.h2>
          <motion.p
            className="font-medium md:text-lg text-[14px] text-brand-gray md:my-8 my-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
          >
            Borrow and lend with ultra-low fees, instant settlements, and full
            transparency—powered by Soroban smart contracts.
          </motion.p>

          <motion.div
            className="flex  max-md:flex-col items-center md:gap-8 gap-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
          >
            <Button
              className="!bg-brand-white text-sm !text-brand-black-100 rounded-[10px]  cursor-pointer hover:opacity-85 px-6 py-3"
              text="Get a Loan Now"
            />
            <Link
              href="/"
              className="text-brand-white font-medium flex items-center py-3 
                hover:opacity-85 transition-all duration-300"
            >
              Start Lending
              <ChevronRight className="size-4 ml-1" />
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          viewport={{ once: true }}
        >
          <Image
            src="/images/fast-secure.svg"
            alt="Fast & Secure DeFi Lending on Stellar"
            width={400}
            height={400}
            className="object-cover max-md:w-[200px] max-md:h-[200px] max-md:mt-5"
          />
        </motion.div>
      </div>
    </section>
  )
}
