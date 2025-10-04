'use client'

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { Timestamp } from 'firebase/firestore'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Client, Task, Piecework, TimeEntry } from "@/lib/types"
import type { DateRange } from "react-day-picker"
import { useFirestore } from "@/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { type DetailedInvoiceData, type DailyInvoiceItem } from "./page"
import { InvoiceReportDisplay } from './report-display'


type InvoicingFormProps = {
    clients: Client[];
    tasks: Task[];
};

export function InvoicingForm({ clients, tasks }: InvoicingFormProps) {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [date, setDate] = React.useState<DateRange | undefined>()
  const [selectedClient, setSelectedClient] = React.useState<Client | undefined>()
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [invoiceData, setInvoiceData] = React.useState<DetailedInvoiceData | null>(null);

  const handleGenerate = async () => {
    if (!firestore || !selectedClient || !date?.from || !date?.to) {
        toast({ title: 'Please select a client and a date range.', variant: 'destructive' });
        return;
    }
    setIsGenerating(true)
    setInvoiceData(null);

    const clientData = clients.find(c => c.id === selectedClient.id)
    if (!clientData) {
        setIsGenerating(false)
        return
    }

    const clientTasks = tasks.filter(task => task.clientId === clientData.id);
    const clientTaskIds = clientTasks.map(t => t.id);
    
    // Set a default start time and end time for the date range
    const startDate = new Date(date.from.setHours(0, 0, 0, 0));
    const endDate = new Date(date.to.setHours(23, 59, 59, 999));


    if (clientTaskIds.length === 0) {
        const finalInvoiceData: DetailedInvoiceData = {
            client: clientData,
            date: {
              from: startDate.toISOString(),
              to: endDate.toISOString()
            },
            dailyItems: [],
            subtotal: 0,
            commission: 0,
            total: 0,
        };
        setInvoiceData(finalInvoiceData);
        setIsGenerating(false)
        return
    }

    try {
        const pieceworkByDay: Record<string, Record<string, number>> = {}; // { [date]: { [taskId]: pieceCount } }
        const hoursByDay: Record<string, Record<string, number>> = {}; // { [date]: { [taskId]: hours } }

        const pieceLogsQuery = query(
            collection(firestore, "piecework"),
            where("timestamp", ">=", startDate),
            where("timestamp", "<=", endDate),
            where("taskId", "in", clientTaskIds)
        );
        
        const timeLogsQuery = query(
            collection(firestore, "time_entries"),
            where("timestamp", ">=", startDate),
            where("timestamp", "<=", endDate),
            where("taskId", "in", clientTaskIds)
        );

        const [pieceLogsSnap, timeLogsSnap] = await Promise.all([
            getDocs(pieceLogsQuery),
            getDocs(timeLogsQuery)
        ]);
        
        pieceLogsSnap.forEach(doc => {
            const log = doc.data() as Piecework;
            const logDate = format((log.timestamp as unknown as Timestamp).toDate(), 'yyyy-MM-dd');
            if (!pieceworkByDay[logDate]) pieceworkByDay[logDate] = {};
            if (!pieceworkByDay[logDate][log.taskId]) pieceworkByDay[logDate][log.taskId] = 0;
            pieceworkByDay[logDate][log.taskId] += log.pieceCount;
        });

        timeLogsSnap.forEach(doc => {
            const log = doc.data() as TimeEntry;
            if (log.endTime) {
                const startTime = (log.timestamp as unknown as Timestamp).toDate();
                const endTimeVal = (log.endTime as unknown as Timestamp).toDate();
                const logDate = format(startTime, 'yyyy-MM-dd');
                
                if (endTimeVal >= startTime) {
                    if (!hoursByDay[logDate]) hoursByDay[logDate] = {};
                    if (!hoursByDay[logDate][log.taskId]) hoursByDay[logDate][log.taskId] = 0;
                    const durationHours = (endTimeVal.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                    hoursByDay[logDate][log.taskId] += durationHours;
                }
            }
        });
        
        const allDates = new Set([...Object.keys(pieceworkByDay), ...Object.keys(hoursByDay)]);
        const sortedDates = Array.from(allDates).sort();

        const dailyItems: DailyInvoiceItem[] = [];

        for (const dateStr of sortedDates) {
            const itemsForDay: DailyInvoiceItem['items'] = [];
            let dailyTotal = 0;

            const taskIdsOnDate = new Set([
              ...Object.keys(pieceworkByDay[dateStr] || {}),
              ...Object.keys(hoursByDay[dateStr] || {})
            ]);

            for (const taskId of taskIdsOnDate) {
                const task = clientTasks.find(t => t.id === taskId);
                if (!task) continue;

                if (task.clientRateType === 'piece' && pieceworkByDay[dateStr]?.[taskId]) {
                    const quantity = pieceworkByDay[dateStr][taskId];
                    const total = quantity * task.clientRate;
                    itemsForDay.push({
                        description: `${task.name}${task.variety ? ' (' + task.variety + ')' : ''}`,
                        unit: 'pieces',
                        quantity: parseFloat(quantity.toFixed(2)),
                        rate: task.clientRate,
                        total: total
                    });
                    dailyTotal += total;
                }

                if (task.clientRateType === 'hourly' && hoursByDay[dateStr]?.[taskId]) {
                    const hours = hoursByDay[dateStr][taskId];
                    const total = hours * task.clientRate;
                    itemsForDay.push({
                        description: `${task.name}${task.variety ? ' (' + task.variety + ')' : ''}`,
                        unit: 'hours',
                        quantity: parseFloat(hours.toFixed(2)),
                        rate: task.clientRate,
                        total: total
                    });
                    dailyTotal += total;
                }
            }

            if (itemsForDay.length > 0) {
                dailyItems.push({
                    date: dateStr,
                    items: itemsForDay,
                    dailyTotal: dailyTotal
                });
            }
        }

        const subtotal = dailyItems.reduce((sum, day) => sum + day.dailyTotal, 0);
        const commission = clientData.commissionRate ? subtotal * (clientData.commissionRate / 100) : 0;
        const total = subtotal + commission;

        const finalInvoiceData: DetailedInvoiceData = {
            client: clientData,
            date: {
              from: startDate.toISOString(),
              to: endDate.toISOString()
            },
            dailyItems,
            subtotal,
            commission,
            total,
        };
        setInvoiceData(finalInvoiceData);

    } catch(err) {
        console.error("Error generating invoice:", err)
        toast({
            variant: "destructive",
            title: "Invoice Generation Failed",
            description: "Could not fetch or process data for the invoice. Please check the console for errors."
        })
    } finally {
        setIsGenerating(false)
    }
  }
  
  if (invoiceData) {
    return <InvoiceReportDisplay report={invoiceData} onBack={() => setInvoiceData(null)} />;
  }


  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select onValueChange={(value) => setSelectedClient(clients.find(c => c.id === value))}>
          <SelectTrigger>
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <Button onClick={handleGenerate} disabled={isGenerating || !selectedClient || !date}>
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Invoice
        </Button>
      </div>

      {isGenerating && (
          <div className="mt-6 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating invoice...</p>
          </div>
      )}
    </div>
  )
}
