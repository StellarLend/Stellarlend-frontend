import { formatDate } from 'date-fns'
import Image from 'next/image'
import React from 'react'
import ReactDatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"

type CustomDatePickerProps = {
    date: Date | null
    setDateRange: React.Dispatch<React.SetStateAction<{
        start: Date | null;
        end: Date | null;
    }>>
    type: 'startDate' | 'endDate'
}

const CustomDatePicker = ({ date, type, setDateRange }: CustomDatePickerProps) => {
    return (
        <div className='flex gap-1.5 p-1.5 rounded-md bg-transparent border border-gray-300'>
            <Image src="/icons/calendar.svg" alt='calendar' width={ 16 } height={ 16 } className='ml-2' />

            <ReactDatePicker
                selected={ date }
                onChange={ (date: Date | null) => {
                    setDateRange({
                        start: type === 'startDate' ? date : null,
                        end: type === 'endDate' ? date : null
                    })
                } }
                dateFormat="MM-dd-yyyy"
                wrapperClassName="w-[138px] rounded-md overflow-hidden"
                className='focus:outline-none focus:ring-0 focus:border-transparent'
                maxDate={ new Date() }
                isClearable
                placeholderText="MM-DD-YYYY"
            />
        </div>

    )
}

export default CustomDatePicker