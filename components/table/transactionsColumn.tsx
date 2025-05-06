'use client'

import { formatDateTime } from "@/lib/utils";
import { Transaction, TransactionStatus } from "@/types";
import Image from "next/image";

export const transactionsColumn = [
    {
        accessor: "id",
        header: "Transaction ID",
        sortable: false,
        filterable: false,
        className: "hidden",
        cell: (item: Transaction) => (
            <span>{ item.id }</span>
        )
    },
    {
        accessor: "type",
        header: "Transaction Type",
        className: "min-w-48",
        sortable: true,
        cell: (item: Transaction) => (
            <div className="flex flex-col gap-1">
                <span className="font-medium text-base">{ item.type }</span>
                <span className="text-xs text-gray-400">#{ item.id }</span>
            </div>
        )
    },
    {
        accessor: "amount",
        header: "Amount",
        sortable: true,
        cell: (item: Transaction) => {
            const isDebit = Math.sign(item.amount)
            const amount = isDebit == -1
                ? `-$${item.amount.toString().slice(1)}`
                : `$${item.amount.toString()}`

            return (
                <span>
                    { amount }
                </span>
            )
        }
    },
    {
        accessor: "asset",
        header: "Asset",
        sortable: true,
        cell: (item: Transaction) => (
            <div className="flex items-center gap-2">
                <Image
                    src={ `/icons/${item.asset.toLowerCase()}.svg` }
                    alt={ item.asset }
                    width={ 24 }
                    height={ 24 }
                    className="inline-block"
                />

                <span>{ item.asset }</span>
            </div>
        )
    },
    {
        accessor: "date",
        header: "Date",
        sortable: true,
        className: "min-w-52",
        cell: (item: Transaction) => {
            const { date, time } = formatDateTime(item.date, item.time)
            return (
                <div className="flex items-center gap-2">
                    <span>{ date }</span>
                    <span className="w-px h-4 bg-gray-300 mx-1 inline-block" />
                    <span>{ time }</span>
                </div>
            )
        }
    },
    {
        accessor: "status",
        header: "Status",
        sortable: false,
        cell: (item: Transaction) => {
            const statusColors: Record<TransactionStatus, string> = {
                Completed: "bg-green-100 text-green-700",
                Processing: "bg-yellow-100 text-yellow-700",
                Failed: "bg-red-100 text-red-700",
            };

            return (
                <span className={ `px-2 py-1 rounded text-xs font-semibold ${statusColors[item.status]}` }>
                    { item.status }
                </span>
            )
        }
    }
]