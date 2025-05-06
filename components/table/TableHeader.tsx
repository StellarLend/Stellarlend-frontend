"use client"

import type React from "react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronsUpDown, ListFilter, Search, SortAsc, SortDesc, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import CustomDatePicker from "./CustomDatePicker"

type TableHeaderProps = {
    columns: {
        header: string
        accessor: string
        sortable?: boolean
        filterable?: boolean
    }[]
    onSearch: (value: string) => void
    onSort: (column: string, direction: "asc" | "desc" | null) => void
    onFilter: (filters: Record<string, string[]>) => void
    onDateRangeChange: (startDate: Date | null, endDate: Date | null) => void
    filterOptions?: Record<string, string[]>
    dateColumn?: string
}

const TableHeader = ({ columns, onSearch, onSort, onDateRangeChange, onFilter, dateColumn, filterOptions = {} }: TableHeaderProps) => {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [searchValue, setSearchValue] = useState("")
    const [sortColumn, setSortColumn] = useState<string | null>(null)
    const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null)
    const [filters, setFilters] = useState<Record<string, string[]>>({})
    const [dateRange, setDateRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null })

    // Initialize state from URL params on component mount
    useEffect(() => {
        const search = searchParams.get("search") || ""
        const sort = searchParams.get("sort")
        const direction = searchParams.get("direction") as "asc" | "desc" | null

        setSearchValue(search)
        setSortColumn(sort)
        setSortDirection(direction)

        // Parse filters from URL
        const newFilters: Record<string, string[]> = {}
        columns.forEach((column) => {
            if (column.filterable) {
                const filterParam = searchParams.get(`filter_${column.accessor}`)
                if (filterParam) {
                    newFilters[column.accessor] = filterParam.split(",")
                }
            }
        })

        const startDateParam = searchParams.get("startDate")
        const endDateParam = searchParams.get("endDate")

        if (startDateParam) {
            setDateRange({ start: new Date(startDateParam), end: null })
        }

        if (endDateParam) {
            setDateRange({ end: new Date(endDateParam), start: null })
        }

        setFilters(newFilters)
    }, [searchParams, columns])

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        // Update URL and notify parent component
        updateUrlParams()
        onSearch(searchValue)
    }

    const handleSortChange = (column: string) => {
        let newDirection: "asc" | "desc" | null = "asc"

        if (sortColumn === column) {
            if (sortDirection === "asc") {
                newDirection = "desc"
            } else if (sortDirection === "desc") {
                newDirection = null
            }
        }

        setSortColumn(newDirection ? column : null)
        setSortDirection(newDirection)

        // Update URL and notify parent component
        setTimeout(() => {
            updateUrlParams()
            onSort(newDirection ? column : "", newDirection)
        }, 0)
    }

    const handleFilterChange = (column: string, value: string, checked: boolean) => {
        const currentFilters = { ...filters }

        if (!currentFilters[column]) {
            currentFilters[column] = []
        }

        if (checked) {
            // Add filter value
            if (!currentFilters[column].includes(value)) {
                currentFilters[column] = [...currentFilters[column], value]
            }
        } else {
            // Remove filter value
            currentFilters[column] = currentFilters[column].filter((v) => v !== value)

            // Remove empty filter arrays
            if (currentFilters[column].length === 0) {
                delete currentFilters[column]
            }
        }

        setFilters(currentFilters)

        // Update URL and notify parent component
        setTimeout(() => {
            updateUrlParams()
            onFilter(currentFilters)
        }, 0)
    }

    const clearFilters = () => {
        setFilters({})
        setSortColumn(null)
        setSortDirection(null)
        setSearchValue("")
        setDateRange({ start: null, end: null })

        // Update URL and notify parent components
        setTimeout(() => {
            updateUrlParams()
            onSearch("")
            onSort("", null)
            onFilter({})
            onDateRangeChange(null, null)
        }, 0)
    }

    const updateUrlParams = () => {
        const params = new URLSearchParams()

        // Add search param
        if (searchValue) {
            params.set("search", searchValue)
        }

        // Add sort params
        if (sortColumn && sortDirection) {
            params.set("sort", sortColumn)
            params.set("direction", sortDirection)
        }

        // Add filter params
        Object.entries(filters).forEach(([column, values]) => {
            if (values.length > 0) {
                params.set(`filter_${column}`, values.join(","))
            }
        })

        if (dateRange.start) {
            params.set("startDate", dateRange.start.toISOString().split("T")[0])
        }

        if (dateRange.end) {
            params.set("endDate", dateRange.end.toISOString().split("T")[0])
        }

        router.push(`${window.location.pathname}?${params.toString()}`)
    }

    const hasActiveFilters =
        Object.keys(filters).length > 0 ||
        sortColumn !== null ||
        searchValue !== "" ||
        dateRange.start !== null ||
        dateRange.end !== null

    return (
        <div className="flex flex-col md:flex-row justify-between w-full mt-2 md:mt-6">
            <div className="flex items-center justify-start flex-wrap gap-4 w-full px-3">
                <form
                    onSubmit={ handleSearch }
                    className="relative h-12 w-[40%] xl:w-[20%] flex items-center gap-2 rounded-xl px-2 border border-gray-300"
                >
                    <Search size={ 18 } />
                    <input
                        type="text"
                        value={ searchValue }
                        onChange={ (e) => setSearchValue(e.target.value) }
                        placeholder="Search..."
                        className="w-[80%] text-sm h-full bg-transparent border-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />

                    { searchValue && (
                        <button
                            type="button"
                            className="absolute top-1/2 -translate-y-1/2 right-0.5 bg-gray-200 hover:bg-gray-300 p-1 rounded-full cursor-pointer"
                            onClick={ () => {
                                setSearchValue("")
                                onSearch("")
                                updateUrlParams()
                            } }
                        >
                            <X size={ 16 } />
                        </button>
                    ) }
                </form>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div
                            className="h-8 gap-1 flex items-center"
                        >
                            <ListFilter size={ 18 } className={ `${Object.keys(filters).length > 0 ? "text-blue-500" : ""}` } />
                            Filter
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-white">
                        <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        { columns
                            .filter((column) => column.filterable !== false && filterOptions[column.accessor])
                            .map((column) => (
                                <div key={ column.accessor } className="px-2 py-1.5">
                                    <div className="font-medium text-xs mb-1">{ column.header }</div>
                                    <div className="space-y-1">
                                        { filterOptions[column.accessor]?.map((option) => (
                                            <div key={ option } className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={ `filter-${column.accessor}-${option}` }
                                                    checked={ filters[column.accessor]?.includes(option) || false }
                                                    onChange={ (e) => handleFilterChange(column.accessor, option, e.target.checked) }
                                                    className="rounded text-blue-500 focus:ring-blue-500"
                                                />
                                                <label htmlFor={ `filter-${column.accessor}-${option}` } className="text-xs cursor-pointer">
                                                    { option }
                                                </label>
                                            </div>
                                        )) }
                                    </div>
                                </div>
                            )) }

                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5">
                            <button
                                className="w-full text-xs h-7"
                                onClick={ clearFilters }
                                disabled={ !hasActiveFilters }
                            >
                                Clear all filters
                            </button>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="h-8 gap-1 flex items-center">
                            <ChevronsUpDown size={ 18 } />
                            Sort
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white">
                        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        { columns
                            .filter((column) => column.sortable !== false)
                            .map((column) => (
                                <DropdownMenuItem
                                    key={ column.accessor }
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={ () => handleSortChange(column.accessor) }
                                >
                                    <span>{ column.header }</span>
                                    { sortColumn === column.accessor &&
                                        (sortDirection === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />) }
                                </DropdownMenuItem>
                            )) }
                    </DropdownMenuContent>
                </DropdownMenu>

                { hasActiveFilters && (
                    <button onClick={ clearFilters } className="flex gap-1 items-center">
                        <X size={ 18 } />
                        Clear Filters
                    </button>
                ) }
            </div>

            { dateColumn && (
                <div className="hidden md:flex items-center gap-2 mr-10">
                    <CustomDatePicker
                        type="startDate"
                        date={ dateRange.start }
                        setDateRange={ setDateRange }
                    />

                    <span>To</span>

                    <CustomDatePicker
                        type="endDate"
                        date={ dateRange.end }
                        setDateRange={ setDateRange }
                    />
                </div>
            ) }
        </div>
    )
}

export default TableHeader
