'use client'

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import TableHeader from "./TableHeader";

type TableProps = {
    columns: {
        header: string;
        accessor: string;
        cell: (item: any) => React.JSX.Element;
        className?: string;
        sortable?: boolean;
        filterable?: boolean;
    }[];
    data: any[];
    itemsPerPage?: number
    filterOptions?: Record<string, string[]>
    dateColumn?: string
}
const Table = ({
    columns,
    data,
    itemsPerPage = 10,
    filterOptions = {},
    dateColumn = 'date'
}: TableProps) => {
    const [currentPage, setCurrentPage] = useState(1)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
        key: "",
        direction: null,
    })
    const [searchTerm, setSearchTerm] = useState("")
    const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({})
    const [startDate, setStartDate] = useState<Date | null>(null)
    const [endDate, setEndDate] = useState<Date | null>(null)

    // Reset to first page when data changes due to filtering/sorting
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, sortConfig, activeFilters, startDate, endDate])

    // Generate filter options if not provided
    const computedFilterOptions = useMemo(() => {
        const options: Record<string, string[]> = { ...filterOptions }

        // For each filterable column without provided options, extract unique values from data
        columns.forEach((column) => {
            if (column.filterable !== false && !options[column.accessor]) {
                const uniqueValues = Array.from(new Set(data.map((item) => String(item[column.accessor]))))
                    .filter(Boolean)
                    .sort()

                // Only use for reasonable numbers of options (max 10)
                if (uniqueValues.length > 0 && uniqueValues.length <= 10) {
                    options[column.accessor] = uniqueValues
                }
            }
        })

        return options
    }, [columns, data, filterOptions])

    // Filter, sort, and paginate data
    const processedData = useMemo(() => {
        let filteredData = [...data]

        // Apply search filter across all searchable fields
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase()
            filteredData = filteredData.filter((item) => {
                return columns.some((column) => {
                    const value = item[column.accessor]
                    return value && String(value).toLowerCase().includes(searchLower)
                })
            })
        }

        // Apply column filters
        if (Object.keys(activeFilters).length > 0) {
            filteredData = filteredData.filter((item) => {
                return Object.entries(activeFilters).every(([column, allowedValues]) => {
                    if (allowedValues.length === 0) return true
                    const itemValue = String(item[column])
                    return allowedValues.includes(itemValue)
                })
            })
        }

        // Apply date range filter if both dates are set
        if (dateColumn && (startDate || endDate)) {
            filteredData = filteredData.filter((item) => {
                const itemDate = new Date(item[dateColumn])

                // Skip invalid dates
                if (isNaN(itemDate.getTime())) return false

                // Check if date is within range
                if (startDate && endDate) {
                    // Set end date to end of day for inclusive range
                    const endOfDay = new Date(endDate)
                    endOfDay.setHours(23, 59, 59, 999)
                    return itemDate >= startDate && itemDate <= endOfDay
                } else if (startDate) {
                    return itemDate >= startDate
                } else if (endDate) {
                    const endOfDay = new Date(endDate)
                    endOfDay.setHours(23, 59, 59, 999)
                    return itemDate <= endOfDay
                }

                return true
            })
        }

        // Apply sorting
        if (sortConfig.key && sortConfig.direction) {
            filteredData.sort((a, b) => {
                const aValue = a[sortConfig.key]
                const bValue = b[sortConfig.key]

                // Handle different data types
                if (typeof aValue === "number" && typeof bValue === "number") {
                    return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue
                }

                // Handle date values
                if (aValue instanceof Date && bValue instanceof Date) {
                    return sortConfig.direction === "asc"
                        ? aValue.getTime() - bValue.getTime()
                        : bValue.getTime() - aValue.getTime()
                }

                // Try to parse as dates if they're strings that look like dates
                if (typeof aValue === "string" && typeof bValue === "string") {
                    const aDate = new Date(aValue)
                    const bDate = new Date(bValue)
                    if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                        return sortConfig.direction === "asc"
                            ? aDate.getTime() - bDate.getTime()
                            : bDate.getTime() - aDate.getTime()
                    }
                }

                // Default string comparison
                const aString = String(aValue).toLowerCase()
                const bString = String(bValue).toLowerCase()

                if (aString < bString) {
                    return sortConfig.direction === "asc" ? -1 : 1
                }
                if (aString > bString) {
                    return sortConfig.direction === "asc" ? 1 : -1
                }
                return 0
            })
        }

        return filteredData
    }, [data, searchTerm, activeFilters, sortConfig, columns, dateColumn, startDate, endDate])

    // Calculate pagination
    const totalPages = Math.ceil(processedData.length / itemsPerPage)
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    const currentItems = processedData.slice(indexOfFirstItem, indexOfLastItem)

    // Change page
    const goToPage = (pageNumber: number) => {
        setCurrentPage(pageNumber)
    }

    // Go to next page
    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1)
        }
    }

    // Go to previous page
    const prevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1)
        }
    }

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pageNumbers = []
        const maxPagesToShow = 5

        if (totalPages <= maxPagesToShow) {
            // If total pages is less than max pages to show, display all pages
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i)
            }
        } else {
            // Always include first page, last page, and current page
            // Then add pages before and after current page

            // Start with current page
            pageNumbers.push(currentPage)

            // Add pages before current page
            let before = currentPage - 1
            while (before > 0 && pageNumbers.length < Math.floor(maxPagesToShow / 2)) {
                pageNumbers.unshift(before)
                before--
            }

            // Add pages after current page
            let after = currentPage + 1
            while (after <= totalPages && pageNumbers.length < maxPagesToShow - 2) {
                pageNumbers.push(after)
                after++
            }

            // Always add first page if not already included
            if (pageNumbers[0] !== 1) {
                if (pageNumbers[0] === 2) {
                    pageNumbers.unshift(1)
                } else {
                    pageNumbers.unshift(-1) // Ellipsis
                    pageNumbers.unshift(1)
                }
            }

            // Always add last page if not already included
            if (pageNumbers[pageNumbers.length - 1] !== totalPages) {
                if (pageNumbers[pageNumbers.length - 1] === totalPages - 1) {
                    pageNumbers.push(totalPages)
                } else {
                    pageNumbers.push(-2) // Ellipsis
                    pageNumbers.push(totalPages)
                }
            }
        }

        return pageNumbers
    }

    return (
        <div className="w-full flex flex-col gap-0.5 bg-brand-white">
            <TableHeader
                columns={ columns }
                onSearch={ setSearchTerm }
                onSort={ (column, direction) => {
                    setSortConfig({ key: column, direction })
                } }
                onFilter={ setActiveFilters }
                onDateRangeChange={ (start, end) => {
                    setStartDate(start)
                    setEndDate(end)
                } }
                filterOptions={ computedFilterOptions }
                dateColumn={ dateColumn }
            />
            <div className="w-full overflow-x-scroll custom-scrollbar">
                <table className="w-full mt-4">
                    <thead>
                        <tr className="text-left text-gray-500 text-sm bg-slate-100 rounded-lg">
                            { columns.map((col) => (
                                <th
                                    key={ col.accessor }
                                    className={ `font-semibold text-base p-3 min-w-32 md:max-w-80 ${col.className}` }>
                                    { col.header }
                                </th>
                            )) }
                        </tr>
                    </thead>
                    <tbody>
                        { data.length === 0 ? (
                            <tr>
                                <td colSpan={ columns.length } className="text-center py-8">No data available.</td>
                            </tr>
                        ) : (
                            currentItems.map((item, rowIndex) => (
                                <tr key={ rowIndex } className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight h-16">
                                    { columns.map((col) => (
                                        <td
                                            key={ col.accessor }
                                            className={ `px-4 min-w-32 md:max-w-80 ${col.className}` }>
                                            { col.cell(item) }
                                        </td>
                                    )) }
                                </tr>
                            ))
                        ) }
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-center gap-8 mt-4">
                <div className="text-sm text-gray-500 hidden md:flex">
                    Showing { indexOfFirstItem + 1 } to { Math.min(indexOfLastItem, data.length) } of { data.length } entries
                </div>

                <div className="flex items-center space-x-1">
                    <button
                        onClick={ prevPage }
                        disabled={ currentPage === 1 }
                        className={ `p-2 rounded-md` }
                        aria-label="Previous page"
                    >
                        <Image
                            src="/icons/arrow-left.svg"
                            alt="previous"
                            width={ 10 }
                            height={ 10 }
                            className={ `${currentPage !== 1 && "invert"}` }
                        />
                    </button>

                    { getPageNumbers().map((pageNumber, index) => (
                        <React.Fragment key={ index }>
                            { pageNumber === -1 || pageNumber === -2 ? (
                                <span className="px-3 py-1">...</span>
                            ) : (
                                <button
                                    onClick={ () => goToPage(pageNumber) }
                                    className={ `px-3 py-1 rounded-md ${currentPage === pageNumber ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-200"
                                        }` }
                                >
                                    { pageNumber }
                                </button>
                            ) }
                        </React.Fragment>
                    )) }

                    <button
                        onClick={ nextPage }
                        disabled={ currentPage === totalPages }
                        className={ `p-2` }
                        aria-label="Next page"
                    >
                        <Image src="/icons/arrow-right.svg"
                            alt="next"
                            width={ 10 }
                            height={ 10 }
                            className={ `${currentPage !== totalPages && "invert"}` }
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Table;