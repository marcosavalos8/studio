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
import { useToast } from "@/hooks/use-toast"

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
  const { toast } = useToast()
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
    if (!firestore || !selectedClient || !date?.from || !date?.to) {
        toast({ title: 'Please select a client and a date range.', variant: 'destructive' });
        return;
    }
    setIsGenerating(true)
    setInvoice(null);

    const clientData = clients.find(c => c.id === selectedClient.id)
    if (!clientData) {
        setIsGenerating(false)
        return
    }

    const clientTasks = tasks.filter(task => task.clientId === clientData.id);
    const clientTaskIds = clientTasks.map(t => t.id);
    const invoiceItems: InvoiceItem[] = []
    
    if (clientTaskIds.length === 0) {
        setInvoice({
            client: clientData,
            date,
            items: [],
            total: 0,
        })
        setIsGenerating(false)
        return
    }

    try {
        const pieceworkByTask: Record<string, number> = {};
        const hoursByTask: Record<string, number> = {};

        // To avoid 'in' query limitations (max 30), we might need to iterate if there are many tasks.
        // For simplicity, assuming number of tasks per client is manageable.
        // A more robust solution would chunk the clientTaskIds array.
        const chunk = <T,>(arr: T[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                arr.slice(i * size, i * size + size)
            );

        const taskChunks = chunk(clientTaskIds, 30);

        // 1. Piecework logs
        for (const taskChunk of taskChunks) {
            if (taskChunk.length > 0) {
                const pieceLogsQuery = query(
                    collection(firestore, "piecework"),
                    where("taskId", "in", taskChunk),
                    where("timestamp", ">=", date.from),
                    where("timestamp", "<=", date.to)
                );
                const pieceLogsSnap = await getDocs(pieceLogsQuery);
                pieceLogsSnap.forEach(doc => {
                    const log = doc.data() as Piecework;
                    const taskId = log.taskId;
                    if (!pieceworkByTask[taskId]) {
                        pieceworkByTask[taskId] = 0;
                    }
                    pieceworkByTask[taskId] += log.pieceCount;
                });
            }
        }
        

        // 2. Time Entries
        for (const taskChunk of taskChunks) {
            if (taskChunk.length > 0) {
                const timeLogsQuery = query(
                    collection(firestore, "time_entries"),
                    where("taskId", "in", taskChunk),
                    where("timestamp", ">=", date.from),
                    where("timestamp", "<=", date.to)
                );
                const timeLogsSnap = await getDocs(timeLogsQuery);

                timeLogsSnap.docs.forEach(doc => {
                    const log = doc.data() as TimeEntry;
                    if(log.endTime) {
                      const startTime = (log.timestamp as unknown as Timestamp).toDate();
                      const endTime = log.endTime ? (log.endTime as unknown as Timestamp).toDate() : null;

                      if (endTime && endTime >= startTime) {
                          if (!hoursByTask[log.taskId]) {
                              hoursByTask[log.taskId] = 0;
                          }
                          const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                          hoursByTask[log.taskId] += durationHours;
                      }
                    }
                });
            }
        }

        // --- Build Invoice Items ---
        for (const task of clientTasks) {
            if (task.clientRateType === 'piece' && pieceworkByTask[task.id]) {
                const quantity = pieceworkByTask[task.id];
                const total = quantity * task.clientRate;
                invoiceItems.push({
                    description: `${task.name}${task.variety ? ' (' + task.variety + ')' : ''} (Piecework)`,
                    quantity: parseFloat(quantity.toFixed(2)),
                    rate: task.clientRate,
                    total: total
                });
            }
            
            if (task.clientRateType === 'hourly' && hoursByTask[task.id]) {
                const hours = hoursByTask[task.id];
                const total = hours * task.clientRate;
                invoiceItems.push({
                    description: `${task.name}${task.variety ? ' (' + task.variety + ')' : ''} (Hourly)`,
                    quantity: parseFloat(hours.toFixed(2)),
                    rate: task.clientRate,
                    total: total
                });
            }
        }

        const total = invoiceItems.reduce((sum, item) => sum + item.total, 0)

        setInvoice({
            client: clientData,
            date,
            items: invoiceItems,
            total,
        })
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

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3 print:hidden">
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

      {invoice && (
        <div className="mt-6 bg-card p-4 sm:p-6 rounded-lg border" id="invoice-section">
          <div className="flex justify-between items-start mb-6 print:mb-4">
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
              {invoice.items.length > 0 ? invoice.items.map((item: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-center">${item.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-10">No billable activity for this period.</TableCell>
                </TableRow>
              )}
            </TableBody>
            {invoice.items.length > 0 && (
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold text-base">Total</TableCell>
                        <TableCell className="text-right font-bold text-base">${invoice.total.toFixed(2)}</TableCell>
                    </TableRow>
                </TableFooter>
            )}
          </Table>

          <div className="flex justify-between items-center mt-6 print:hidden">
            <div className="text-muted-foreground text-xs">
                Payment Terms: {invoice.client.paymentTerms}
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Download className="mr-2 h-4 w-4" />
                Print / Save as PDF
            </Button>
          </div>
           <style jsx global>{`
                @media print {
                    body {
                      visibility: hidden;
                    }
                    #invoice-section, #invoice-section * {
                        visibility: visible;
                    }
                    #invoice-section {
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
      )}
    </div>
  )
}
