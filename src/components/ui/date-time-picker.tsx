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

// Helper function to safely parse time value and extract hour/minute
function parseTimeValue(timeValue: string | undefined): { hour: number; minute: number } {
  if (!timeValue?.includes(":")) {
    return { hour: 0, minute: 0 }
  }
  
  const parts = timeValue.split(":")
  // Validate we have exactly 2 parts (HH:MM format)
  if (parts.length !== 2) {
    return { hour: 0, minute: 0 }
  }
  
  const hour = parseInt(parts[0], 10)
  const minute = parseInt(parts[1], 10)
  
  return {
    hour: isNaN(hour) ? 0 : Math.max(0, Math.min(23, hour)),
    minute: isNaN(minute) ? 0 : Math.max(0, Math.min(59, minute))
  }
}

// Helper function to get display value for hour or minute input
function getTimePartValue(timeValue: string | undefined, part: 'hour' | 'minute'): string {
  if (!timeValue?.includes(":")) {
    return "00"
  }
  
  const parts = timeValue.split(":")
  // Validate we have at least 2 parts before accessing
  if (parts.length < 2) {
    return "00"
  }
  
  const value = part === 'hour' ? parts[0] : parts[1]
  return value || "00"
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
    const { hour: hours, minute: minutes } = parseTimeValue(timeValue)
    const year = newDate.getFullYear()
    const month = newDate.getMonth()
    const day = newDate.getDate()
    
    // Create a new date in the local timezone with the selected date and time
    const dateWithTime = new Date(year, month, day, hours, minutes, 0, 0)
    
    setSelectedDate(dateWithTime)
    setDate(dateWithTime)
  }

  const handleHourChange = (value: string) => {
    const hour = parseInt(value, 10)
    if (isNaN(hour) || hour < 0 || hour > 23) return
    
    const { minute: validMinutes } = parseTimeValue(timeValue)
    
    const newTimeValue = `${String(hour).padStart(2, '0')}:${String(validMinutes).padStart(2, '0')}`
    setTimeValue(newTimeValue)

    if (!selectedDate) return

    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const day = selectedDate.getDate()
    
    const newDate = new Date(year, month, day, hour, validMinutes, 0, 0)
    setSelectedDate(newDate)
    setDate(newDate)
  }

  const handleMinuteChange = (value: string) => {
    const minute = parseInt(value, 10)
    if (isNaN(minute) || minute < 0 || minute > 59) return
    
    const { hour: validHours } = parseTimeValue(timeValue)
    
    const newTimeValue = `${String(validHours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    setTimeValue(newTimeValue)

    if (!selectedDate) return

    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const day = selectedDate.getDate()
    
    const newDate = new Date(year, month, day, validHours, minute, 0, 0)
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
          <div className="p-3 border-t space-y-2">
            <Label>Time</Label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Label htmlFor="hour" className="text-xs text-muted-foreground">
                  Hour
                </Label>
                <Input
                  id="hour"
                  type="number"
                  min="0"
                  max="23"
                  value={getTimePartValue(timeValue, 'hour')}
                  onChange={(e) => handleHourChange(e.target.value)}
                  className="mt-1"
                  placeholder="HH"
                />
              </div>
              <span className="text-2xl font-bold self-end mb-1">:</span>
              <div className="flex-1">
                <Label htmlFor="minute" className="text-xs text-muted-foreground">
                  Minute
                </Label>
                <Input
                  id="minute"
                  type="number"
                  min="0"
                  max="59"
                  value={getTimePartValue(timeValue, 'minute')}
                  onChange={(e) => handleMinuteChange(e.target.value)}
                  className="mt-1"
                  placeholder="MM"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
