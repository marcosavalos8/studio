'use client'

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2, Download } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table"
import type { Client, Task, Piecework, TimeEntry } from "@/lib/types"
import type { DateRange } from "react-day-picker"
import { useFirestore } from "@/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"

type InvoicingFormProps = {
  clients: Client[]
  tasks: Task[]
}

type InvoiceItem = {
    description: string;
    quantity: number;
    rate: number;
    total: number;
}

export function InvoicingForm({ clients, tasks }: InvoicingFormProps) {
  const firestore = useFirestore()
  const [date, setDate] = React.useState<DateRange | undefined>()
  const [selectedClient, setSelectedClient] = React.useState<Client | undefined>()
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [invoice, setInvoice] = React.useState<{
    client: Client;
    date: DateRange;
    items: InvoiceItem[];
    total: number;
  } | null>(null)

  const handleGenerate = async () => {
    if (!firestore || !selectedClient || !date?.from || !date?.to) return
    setIsGenerating(true)

    const clientTasks = tasks.filter(task => task.client === selectedClient.name)
    const invoiceItems: InvoiceItem[] = []

    // Fetch piece logs
    const pieceLogsQuery = query(
      collection(firestore, "piecework"),
      where("taskId", "in", clientTasks.map(t => t.id)),
      where("timestamp", ">=", date.from),
      where("timestamp", "<=", date.to)
    )
    const pieceLogsSnap = await getDocs(pieceLogsQuery)
    const pieceLogs = pieceLogsSnap.docs.map(doc => doc.data() as Piecework)

    // Aggregate piecework logs
    const pieceworkByTask: Record<string, number> = {}
    pieceLogs.forEach(log => {
      if (!pieceworkByTask[log.taskId]) {
        pieceworkByTask[log.taskId] = 0
      }
      pieceworkByTask[log.taskId] += log.pieceCount
    })

    for (const taskId in pieceworkByTask) {
        const task = clientTasks.find(t => t.id === taskId)
        if (task && task.clientRateType === 'piece') {
            const quantity = pieceworkByTask[taskId];
            const total = quantity * task.clientRate
            invoiceItems.push({
                description: `${task.name} (Piecework)`,
                quantity: quantity,
                rate: task.clientRate,
                total: total
            })
        }
    }


    // Fetch time logs for hourly tasks
     const timeLogsQuery = query(
      collection(firestore, "time_entries"),
      where("taskId", "in", clientTasks.map(t => t.id)),
      where("timestamp", ">=", date.from),
      where("timestamp", "<=", date.to)
    );
    const timeLogsSnap = await getDocs(timeLogsQuery);
    const timeLogs = timeLogsSnap.docs.map(doc => doc.data() as TimeEntry).filter(log => log.endTime);


    // Aggregate hourly logs
    const hoursByTask: Record<string, number> = {}
    timeLogs.forEach(log => {
        if (!hoursByTask[log.taskId]) {
            hoursByTask[log.taskId] = 0
        }
        const start = (log.timestamp as unknown as Timestamp).toDate()
        const end = (log.endTime as unknown as Timestamp).toDate()
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        hoursByTask[log.taskId] += durationHours
    });


    for (const taskId in hoursByTask) {
        const task = clientTasks.find(t => t.id === taskId)
        if (task && task.clientRateType === 'hourly') {
            const hours = hoursByTask[taskId];
            const total = hours * task.clientRate
            invoiceItems.push({
                description: `${task.name} (Hourly)`,
                quantity: parseFloat(hours.toFixed(2)),
                rate: task.clientRate,
                total: total
            })
        }
    }

    const total = invoiceItems.reduce((sum, item) => sum + item.total, 0)

    setInvoice({
      client: selectedClient,
      date,
      items: invoiceItems,
      total,
    })

    setIsGenerating(false)
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

      {invoice && (
        <div className="mt-6 bg-card p-4 sm:p-6 rounded-lg border" id="invoice-section">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">INVOICE</h2>
              <div>To: {invoice.client.name}</div>
              <div className="text-muted-foreground">{invoice.client.billingAddress}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">FieldTack WA</div>
              <div className="text-sm text-muted-foreground">Invoice Date: {format(new Date(), "LLL dd, y")}</div>
              <div className="text-sm text-muted-foreground">Period: {format(invoice.date.from!, "LLL dd, y")} - {format(invoice.date.to!, "LLL dd, y")}</div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead className="text-center">Rate</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-center">${item.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">${invoice.total.toFixed(2)}</TableCell>
                </TableRow>
            </TableFooter>
          </Table>

          <div className="flex justify-end mt-6">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
