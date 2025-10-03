'use client'

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2, Download, Printer, Mail, MoreVertical } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Client, Task, Piecework, TimeEntry } from "@/lib/types"
import type { DateRange } from "react-day-picker"
import { useFirestore } from "@/firebase"
import { collection, getDocs, query, where } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

type InvoiceItem = {
    description: string;
    quantity: number;
    rate: number;
    total: number;
}

export type InvoiceData = {
  client: Client;
  date: {
    from: string | null | undefined;
    to: string | null | undefined;
  };
  items: InvoiceItem[];
  subtotal: number;
  commission: number;
  total: number;
};

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
  const [invoice, setInvoice] = React.useState<InvoiceData | null>(null)

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
            date: {
              from: date.from?.toISOString(),
              to: date.to?.toISOString()
            },
            items: [],
            subtotal: 0,
            commission: 0,
            total: 0,
        })
        setIsGenerating(false)
        return
    }

    try {
        const pieceworkByTask: Record<string, number> = {};
        const hoursByTask: Record<string, number> = {};

        const pieceLogsQuery = query(
            collection(firestore, "piecework"),
            where("timestamp", ">=", date.from),
            where("timestamp", "<=", date.to)
        );
        
        const timeLogsQuery = query(
            collection(firestore, "time_entries"),
            where("timestamp", ">=", date.from),
            where("timestamp", "<=", date.to)
        );

        const [pieceLogsSnap, timeLogsSnap] = await Promise.all([
            getDocs(pieceLogsQuery),
            getDocs(timeLogsQuery)
        ]);
        
        pieceLogsSnap.forEach(doc => {
            const log = doc.data() as Piecework;
            if (clientTaskIds.includes(log.taskId)) {
                if (!pieceworkByTask[log.taskId]) {
                    pieceworkByTask[log.taskId] = 0;
                }
                pieceworkByTask[log.taskId] += log.pieceCount;
            }
        });

        timeLogsSnap.forEach(doc => {
            const log = doc.data() as TimeEntry;
             if (clientTaskIds.includes(log.taskId) && log.endTime) {
                const startTime = (log.timestamp as unknown as Timestamp).toDate();
                const endTime = log.endTime ? (log.endTime as unknown as Timestamp).toDate() : new Date();

                if (endTime >= startTime) {
                    if (!hoursByTask[log.taskId]) {
                        hoursByTask[log.taskId] = 0;
                    }
                    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                    hoursByTask[log.taskId] += durationHours;
                }
            }
        });

        
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

        const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0)
        const commission = clientData.commissionRate ? subtotal * (clientData.commissionRate / 100) : 0
        const total = subtotal + commission

        setInvoice({
            client: clientData,
            date: {
              from: date.from.toISOString(),
              to: date.to.toISOString()
            },
            items: invoiceItems,
            subtotal,
            commission,
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
  
  const handlePrint = () => {
    if (!invoice) return;
    try {
        const invoiceString = JSON.stringify(invoice);
        sessionStorage.setItem('invoiceData', invoiceString);
        window.open('/invoicing/print', '_blank');
    } catch (error) {
        console.error("Failed to stringify invoice data for printing:", error);
        toast({
            title: "Print Error",
            description: "Could not prepare the invoice for printing.",
            variant: "destructive"
        });
    }
  }

  const handleEmail = () => {
    if (!invoice || !invoice.date.from || !invoice.date.to) return;
    const client = invoice.client;
    const clientEmail = client.email || '';
    const subject = `Invoice from FieldTack WA`;
    
    // Store data and get print link
    const invoiceString = JSON.stringify(invoice);
    sessionStorage.setItem('invoiceData', invoiceString);
    const printUrl = `${window.location.origin}/invoicing/print`;
    
    let body = `Dear ${client.name},\n\n`;
    body += `Please find your invoice for the period of ${format(new Date(invoice.date.from), "LLL dd, y")} to ${format(new Date(invoice.date.to), "LLL dd, y")}.\n\n`;
    body += `You can view and print the full invoice here:\n${printUrl}\n\n`;
    body += `To save as a PDF:\n`;
    body += `1. Open the link above.\n`;
    body += `2. Press Ctrl+P or Cmd+P to open the print dialog.\n`;
    body += `3. Change the 'Destination' to 'Save as PDF' and click 'Save'.\n\n`;
    body += `Invoice Summary:\n`;
    body += `Total Amount Due: $${invoice.total.toFixed(2)}\n`;
    body += `Payment Terms: ${client.paymentTerms}\n\n`;
    body += 'Thank you for your business!\n\n';
    body += 'Sincerely,\nThe FieldTack WA Team';

    const mailtoLink = `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

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
        <div className="mt-6 bg-card p-4 sm:p-6 rounded-lg border">
          <div className="flex justify-between items-start mb-6 print:mb-4">
            <div>
              <h2 className="text-2xl font-bold text-primary">INVOICE</h2>
              <div>To: {invoice.client.name}</div>
              <div className="text-muted-foreground">{invoice.client.billingAddress}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">FieldTack WA</div>
              <div className="text-sm text-muted-foreground">Invoice Date: {format(new Date(), "LLL dd, y")}</div>
              {invoice.date.from && invoice.date.to && (
                <div className="text-sm text-muted-foreground">Period: {format(new Date(invoice.date.from), "LLL dd, y")} - {format(new Date(invoice.date.to), "LLL dd, y")}</div>
              )}
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
                        <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                        <TableCell className="text-right font-medium">${invoice.subtotal.toFixed(2)}</TableCell>
                    </TableRow>
                    {invoice.commission > 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-right">Commission ({invoice.client.commissionRate}%)</TableCell>
                        <TableCell className="text-right">${invoice.commission.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                        <TableCell colSpan={3} className="text-right font-bold text-base">Total</TableCell>
                        <TableCell className="text-right font-bold text-base">${invoice.total.toFixed(2)}</TableCell>
                    </TableRow>
                </TableFooter>
            )}
          </Table>

          <div className="flex justify-between items-center mt-6">
            <div className="text-muted-foreground text-xs">
                Payment Terms: {invoice.client.paymentTerms}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleEmail} disabled={!invoice.client.email}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email Invoice
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </div>
  )
}

    