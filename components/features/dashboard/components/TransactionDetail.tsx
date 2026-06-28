"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
import { Copy, X, Printer } from "lucide-react";
import Image from "next/image";
import type { Transaction } from "../../../../types/Transaction";
import { sanitiseString } from "@/lib/security/input-sanitizer";
import { isValidTxHash } from "@/lib/validation/stellar";
import config from "@/lib/config";
import { copyToClipboard } from "@/lib/utils/clipboard";
import Toast from "@/components/shared/common/Toast";
import { Toast } from "@/components/shared/common";
import { copyToClipboard, type CopyFailureReason } from "@/lib/utils/clipboard";
import TransactionReceipt from "./TransactionReceipt";

interface TransactionDetailProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TransactionDetail({ transaction, isOpen, onClose }: TransactionDetailProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [toast, setToast] = useState<{ title?: string; description?: string; variant?: "success" | "error" } | null>(null);

  const id = transaction?.id || "";

  useEffect(() => {
    if (isOpen && id) {
      setLoading(true);
      fetch(`/api/transactions/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch details");
          return res.json();
        })
        .then((data) => {
          setDetails(data.transaction);
        })
        .catch((err) => {
          console.error("Error loading transaction details:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setDetails(null);
      setShowReceipt(false);
    }
  }, [isOpen, id]);

  if (!transaction) return null;

  const { type, amount, asset, date, time, status } = transaction;

  const signedAmount = amount > 0 ? `+$${amount}` : `-$${Math.abs(amount)}`;

  const copyId = async () => {
    const result = await copyToClipboard(id);
    if (result.success) {
      setToast({ title: "Copied", description: "Transaction ID copied to clipboard", variant: "success" });
    } else {
      setToast({ title: "Copy failed", description: "Failed to copy transaction ID", variant: "error" });
    }
    setTimeout(() => setToast(null), 3000);
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

  const getExplorerLink = () => {
    if (!id || !isValidTxHash(id)) {
      return null;
    }
    const net = config.stellar.network.toLowerCase() === 'public' || config.stellar.network.toLowerCase() === 'mainnet' ? 'public' : 'testnet';
    const baseUrl = `https://stellar.expert/explorer/${net}/tx/`;
    
    // Ensure base URL starts with a safe https protocol and allowlisted domain
    if (!baseUrl.startsWith("https://stellar.expert/")) {
      return null;
    }
    
    return `${baseUrl}${id}`;
  };

  // If showing receipt, render it in full screen mode
  if (showReceipt && transaction) {
    return (
      <TransactionReceipt
        transaction={transaction}
        details={details}
        onBack={() => setShowReceipt(false)}
      />
    );
  }

  return (
    <>
      {toast && (
        <Toast
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
        />
      )}
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
                {loading ? (
                  <div className="text-center text-xs text-gray-400 py-2">
                    Loading additional details...
                  </div>
                ) : (
                  <>
                    {details?.memo && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Memo:</span>
                        <span className="break-all font-mono bg-gray-50 px-2 py-1 rounded text-xs">
                          {sanitiseString(details.memo)}
                        </span>
                      </div>
                    )}
                    {getExplorerLink() && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Explorer Link:</span>
                        <a
                          href={getExplorerLink() || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          View on Stellar Expert
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Print Receipt Button */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowReceipt(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Print receipt"
                  type="button"
                >
                  <Printer size={18} />
                  <span>Print Receipt</span>
                </button>
              </div>

              {toast && (
                <Toast
                  variant={toast.variant}
                  title={toast.title}
                  description={toast.description}
                />
              )}
            </Dialog.Panel>
          </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

