"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Image from "next/image";
import type { Transaction } from "@/types/Transaction";
import { sanitiseString } from "@/lib/security/input-sanitizer";
import { isValidTxHash } from "@/lib/validation/stellar";
import config from "@/lib/config";

interface TransactionReceiptProps {
  transaction: Transaction;
  details?: {
    fee?: string;
    explorerUrl?: string;
    memo?: string;
    operations?: Array<{
      id: string;
      type: string;
      source: string;
      destination: string;
      amount: string;
      asset: string;
    }>;
  } | null;
  onBack?: () => void;
}

/**
 * TransactionReceipt displays a print-friendly receipt view of a transaction.
 * Includes a print button that triggers window.print() with print-optimized styles.
 * 
 * @param transaction - The transaction to display
 * @param details - Optional detailed transaction information (fee, memo, operations)
 * @param onBack - Optional callback to return to previous view
 */
export default function TransactionReceipt({ transaction, details, onBack }: TransactionReceiptProps) {
  const { id, type, amount, asset, date, time, status } = transaction;

  const handlePrint = () => {
    window.print();
  };

  const signedAmount = amount > 0 ? `+$${amount}` : `-$${Math.abs(amount)}`;

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

  return (
    <>
      <style jsx global>{`
        @media print {
          /* Hide everything except the receipt */
          body > *:not(.transaction-receipt-container) {
            display: none !important;
          }
          
          /* Hide interactive elements in print */
          .no-print {
            display: none !important;
          }
          
          /* Optimize receipt for print */
          .transaction-receipt-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 2rem !important;
            background: white !important;
            color: black !important;
          }
          
          .transaction-receipt {
            max-width: 800px !important;
            margin: 0 auto !important;
            border: 1px solid #000 !important;
            padding: 2rem !important;
          }
          
          /* Ensure text is black on white */
          .transaction-receipt * {
            color: black !important;
          }
          
          /* Remove shadows and background colors */
          .transaction-receipt {
            box-shadow: none !important;
          }
          
          /* Break pages appropriately */
          .transaction-receipt {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="transaction-receipt-container">
        <div className="transaction-receipt bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 border-b pb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Transaction Receipt</h1>
            <p className="text-sm text-gray-500">Stellarlend Platform</p>
          </div>

          {/* Print Button - hidden in print view */}
          <div className="no-print mb-6 flex justify-between items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label="Back to transaction details"
                type="button"
              >
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ml-auto"
              aria-label="Print receipt"
              type="button"
            >
              <Printer size={18} />
              <span>Print Receipt</span>
            </button>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-700">Transaction ID:</span>
              <span className="text-gray-900 break-all font-mono text-sm">{id}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-700">Type:</span>
              <span className="text-gray-900">{type}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-700">Amount:</span>
              <span className={`font-bold text-lg ${amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {signedAmount}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-700">Asset:</span>
              <span className="flex items-center gap-2 text-gray-900">
                <Image 
                  src={`/icons/${asset.toLowerCase()}.svg`} 
                  alt={asset} 
                  width={24} 
                  height={24}
                  className="inline-block"
                />
                {asset}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-700">Date & Time:</span>
              <span className="text-gray-900">{formatDateTime(date, time)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-700">Status:</span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                status === 'Completed' ? 'bg-green-100 text-green-800' :
                status === 'Processing' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {status}
              </span>
            </div>

            {details?.fee && (
              <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
                <span className="font-semibold text-gray-700">Network Fee:</span>
                <span className="text-gray-900 font-mono text-sm">{details.fee}</span>
              </div>
            )}

            {details?.memo && (
              <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
                <span className="font-semibold text-gray-700">Memo:</span>
                <span className="text-gray-900 break-all font-mono text-sm bg-gray-50 px-2 py-1 rounded">
                  {sanitiseString(details.memo)}
                </span>
              </div>
            )}

            {getExplorerLink() && (
              <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-200">
                <span className="font-semibold text-gray-700">Blockchain Explorer:</span>
                <a
                  href={getExplorerLink() || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all text-sm no-print"
                >
                  View on Stellar Expert
                </a>
                <span className="hidden print:inline text-gray-900 break-all text-sm">
                  {getExplorerLink()}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 pt-6 border-t">
            <p>This receipt is for your records only.</p>
            <p className="mt-2">For questions or concerns, please contact support@stellarlend.com</p>
            <p className="mt-4">Generated on {new Date().toLocaleDateString("en-US", { 
              month: "long", 
              day: "numeric", 
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}</p>
          </div>
        </div>
      </div>
    </>
  );
}
