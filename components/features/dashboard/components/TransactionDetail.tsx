"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { Copy, X } from "lucide-react";
import Image from "next/image";
import type { Transaction } from "../../../../types/Transaction";

interface TransactionDetailProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TransactionDetail({ transaction, isOpen, onClose }: TransactionDetailProps) {
  if (!transaction) return null;

  const { id, type, amount, asset, date, time, status } = transaction;

  const signedAmount = amount > 0 ? `+$${amount}` : `-$${Math.abs(amount)}`;

  const copyId = async () => {
    await navigator.clipboard.writeText(id);
    // could show a toast later
  };

  const formatDateTime = (dateStr: string, timeStr: string) => {
    let fixedTime = timeStr.replace(/(AM|PM)$/i, " $1");
    const d = new Date(dateStr + " " + fixedTime);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "2-digit",
      year: "numeric",
    };
    const datePart = d.toLocaleDateString("en-US", options);
    let [h, m] = [d.getHours(), d.getMinutes()];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    const timePart = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}${ampm}`;
    return `${datePart} ${timePart}`;
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 relative">
              <button
                onClick={onClose}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>
              <Dialog.Title className="text-lg font-semibold mb-4 text-gray-800">
                Transaction Details
              </Dialog.Title>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span className="font-medium">ID:</span>
                  <span className="flex items-center gap-2">
                    {id}
                    <button
                      onClick={copyId}
                      className="text-blue-600 hover:underline"
                      aria-label="Copy transaction ID"
                    >
                      <Copy size={16} />
                    </button>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Type:</span>
                  <span>{type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Amount:</span>
                  <span>{signedAmount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Asset:</span>
                  <span className="flex items-center gap-1">
                    <Image src={`/icons/${asset.toLowerCase()}.svg`} alt={asset} width={20} height={20} className="inline-block" />
                    {asset}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Date & Time:</span>
                  <span>{formatDateTime(date, time)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <span>{status}</span>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
