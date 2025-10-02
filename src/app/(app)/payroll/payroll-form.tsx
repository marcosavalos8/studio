'use client'

import * as React from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2, Download } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { generateReportAction } from "./actions"
import type { DateRange } from "react-day-picker"

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Generate Report
    </Button>
  )
}

function MarkdownDisplay({ content }: { content: string }) {
  return (
    <div className="mt-6 bg-card p-4 sm:p-6 rounded-lg border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Generated Report</h3>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
      <pre className="text-sm whitespace-pre-wrap font-code bg-muted/50 p-4 rounded-md">{content}</pre>
    </div>
  )
}

const initialState = {
  report: undefined,
  error: undefined,
}

export function PayrollForm() {
  const [state, formAction] = useActionState(generateReportAction, initialState)
  const [date, setDate] = React.useState<DateRange | undefined>()
  const { toast } = useToast()

  React.useEffect(() => {
    if (state.error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: state.error,
      })
    }
  }, [state.error, toast])

  return (
    <form action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          {/* Hidden inputs to pass dates to server action */}
          {date?.from && <input type="hidden" name="from" value={date.from.toISOString()} />}
          {date?.to && <input type="hidden" name="to" value={date.to.toISOString()} />}
        </div>
        <div>
          <SubmitButton />
        </div>
      </div>
      
      {state.report && <MarkdownDisplay content={state.report} />}
    </form>
  )
}
