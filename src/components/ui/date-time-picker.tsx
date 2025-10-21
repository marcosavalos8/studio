"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  label?: string
  placeholder?: string
  disabled?: boolean
}

export function DateTimePicker({
  date,
  setDate,
  label = "Date and Time",
  placeholder = "Pick a date and time",
  disabled = false,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [timeValue, setTimeValue] = React.useState<string>(
    date ? format(date, "HH:mm") : "00:00"
  )

  React.useEffect(() => {
    if (date) {
      setSelectedDate(date)
      setTimeValue(format(date, "HH:mm"))
    }
  }, [date])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) {
      setSelectedDate(undefined)
      setDate(undefined)
      return
    }

    // Preserve the time when selecting a new date
    // Extract year, month, day from the selected date to avoid timezone issues
    const [hours, minutes] = timeValue.split(":").map(Number)
    const year = newDate.getFullYear()
    const month = newDate.getMonth()
    const day = newDate.getDate()
    
    // Create a new date in the local timezone with the selected date and time
    const dateWithTime = new Date(year, month, day, hours, minutes, 0, 0)
    
    setSelectedDate(dateWithTime)
    setDate(dateWithTime)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value
    setTimeValue(time)

    if (!selectedDate) return

    // Extract year, month, day from the selected date to avoid timezone issues
    const [hours, minutes] = time.split(":").map(Number)
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const day = selectedDate.getDate()
    
    // Create a new date in the local timezone with the selected date and time
    const newDate = new Date(year, month, day, hours, minutes, 0, 0)
    
    setSelectedDate(newDate)
    setDate(newDate)
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? (
              format(date, "PPP 'at' HH:mm")
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="p-3 border-t">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={timeValue}
              onChange={handleTimeChange}
              className="mt-2"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
