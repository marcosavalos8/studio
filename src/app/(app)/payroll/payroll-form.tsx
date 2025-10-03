
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
import { useFirestore } from "@/firebase"
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore'
import { Client, Employee, Piecework, Task, TimeEntry } from "@/lib/types"

function SubmitButton({disabled}: {disabled: boolean}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Generate Report
    </Button>
  )
}

function MarkdownDisplay({ content }: { content: string }) {
  // A simple markdown-like display. For real markdown, use a library like 'react-markdown'.
  return (
    <div className="mt-6 bg-card p-4 sm:p-6 rounded-lg border" id="report-section">
      <div className="flex justify-between items-center mb-4 print:hidden">
        <h3 className="text-lg font-semibold">Generated Report</h3>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Download className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-md">
        {content}
      </div>
      <style jsx global>{`
          @media print {
              body {
                visibility: hidden;
              }
              #report-section, #report-section * {
                  visibility: visible;
              }
              #report-section {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  height: 100%;
                  border: none;
                  box-shadow: none;
                  padding: 1.5rem;
                  margin: 0;
              }
              @page {
                size: auto;
                margin: 0.5in;
              }
          }
      `}</style>
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
  const [jsonData, setJsonData] = React.useState<string | null>(null);
  const [isFetchingData, setIsFetchingData] = React.useState(false);
  const { toast } = useToast()
  const firestore = useFirestore();

  React.useEffect(() => {
    if (state.error) {
      toast({
        variant: "destructive",
        title: "Error Generating Report",
        description: state.error,
      })
    }
  }, [state.error, toast])
  
  React.useEffect(() => {
    const fetchPayrollData = async () => {
        if (!date?.from || !date.to || !firestore) {
            setJsonData(null);
            return;
        }

        setIsFetchingData(true);
        try {
            const start = date.from;
            const end = date.to;

            const employeesSnap = await getDocs(collection(firestore, 'employees'));
            const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));

            const tasksSnap = await getDocs(collection(firestore, 'tasks'));
            const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
            
            const clientsSnap = await getDocs(collection(firestore, 'clients'));
            const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));

            const timeEntriesQuery = query(collection(firestore, 'time_entries'),
                where('timestamp', '>=', start),
                where('timestamp', '<=', end)
            );
            const timeEntriesSnap = await getDocs(timeEntriesQuery);
            const timeEntries = timeEntriesSnap.docs.map(doc => {
                const data = doc.data();
                
                const timestamp = (data.timestamp && data.timestamp instanceof Timestamp) 
                    ? data.timestamp.toDate().toISOString() 
                    : undefined;

                const endTime = (data.endTime && data.endTime instanceof Timestamp) 
                    ? data.endTime.toDate().toISOString() 
                    : undefined;
                
                return { 
                    ...data,
                    id: doc.id,
                    timestamp,
                    endTime,
                };
            });

            const pieceworkQuery = query(collection(firestore, 'piecework'),
                where('timestamp', '>=', start),
                where('timestamp', '<=', end)
            );
            const pieceworkSnap = await getDocs(pieceworkQuery);
            const piecework = pieceworkSnap.docs.map(doc => {
                const data = doc.data();

                const timestamp = (data.timestamp && data.timestamp instanceof Timestamp)
                    ? data.timestamp.toDate().toISOString()
                    : undefined;

                return { 
                    ...data,
                    id: doc.id,
                    timestamp
                };
            });

            setJsonData(JSON.stringify({
                employees,
                tasks,
                clients,
                timeEntries,
                piecework
            }));
        } catch (error) {
            console.error("Failed to fetch payroll data:", error);
            toast({
                variant: "destructive",
                title: "Data Fetch Error",
                description: "Could not fetch payroll data from Firestore. Please check console for details."
            });
            setJsonData(null);
        } finally {
            setIsFetchingData(false);
        }
    };
    
    fetchPayrollData();
  }, [date, firestore, toast]);

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
          {date?.from && <input type="hidden" name="from" value={date.from.toISOString()} />}
          {date?.to && <input type="hidden" name="to" value={date.to.toISOString()} />}
          {jsonData && <input type="hidden" name="jsonData" value={jsonData} />}
        </div>
        <div>
          <SubmitButton disabled={!date || !jsonData || isFetchingData} />
           {isFetchingData && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/>Fetching data for selected range...</p>}
        </div>
      </div>
      
      {state.report && <MarkdownDisplay content={state.report} />}
    </form>
  )
}
