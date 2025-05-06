'use client'

import { ChevronRight } from "lucide-react";

type ExportCsvButtonProps = {
    columns: {
        header: string;
        accessor: string;
        cell: (item: any) => React.JSX.Element;
    }[];
    data: any[]
}
const ExportCsvButton = ({ columns, data }: ExportCsvButtonProps) => {
    const exportToCSV = () => {
        // Get all columns except those with complex cell renderers
        const exportColumns = columns.map((col) => ({
            header: col.header,
            accessor: col.accessor,
        }))

        // Create CSV header row
        const csvHeader = exportColumns.map((col) => `"${col.header}"`).join(",")

        // Create CSV data rows
        const csvRows = data.map((item) => {
            return exportColumns
                .map((col) => {
                    const value = item[col.accessor]
                    // Handle different data types and escape quotes
                    if (value === null || value === undefined) return '""'
                    if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`
                    if (value instanceof Date) return `"${value.toLocaleDateString()}"`
                    return `"${value}"`
                })
                .join(",")
        })

        // Combine header and rows
        const csvContent = [csvHeader, ...csvRows].join("\n")

        // Create a blob and download link
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `transactions-export-${new Date().toISOString().split("T")[0]}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <button className="md:bg-[#15A350] border border-gray-300 md:border-[#71B48D] p-2 text-brand-black-100 md:text-brand-white rounded-md flex items-center gap-4 cursor-pointer text-sm md:text-base" onClick={ exportToCSV }>
            Export CSV

            <ChevronRight className="text-brand-black-100 md:text-brand-white" />
        </button>
    )
}
export default ExportCsvButton