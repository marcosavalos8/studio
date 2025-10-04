'use client'

import React, { useEffect, useState, useRef } from 'react'
import { format } from "date-fns"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableFooter, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Loader2 } from 'lucide-react'
import type { InvoiceData } from '../invoicing-form'
import { useSearchParams } from 'next/navigation'


function InvoiceToPrint({ invoice }: { invoice: InvoiceData }) {
    if (!invoice.date.from || !invoice.date.to) return null;

  return (
    <div className="bg-white p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary">INVOICE</h2>
          <div>To: {invoice.client.name}</div>
          <div className="text-gray-500">{invoice.client.billingAddress}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-lg">FieldTack WA</div>
          <div className="text-sm text-gray-500">Invoice Date: {format(new Date(), "LLL dd, y")}</div>
          <div className="text-sm text-gray-500">Period: {format(new Date(invoice.date.from), "LLL dd, y")} - {format(new Date(invoice.date.to), "LLL dd, y")}</div>
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
          {invoice.items.length > 0 ? invoice.items.map((item, index) => (
            <TableRow key={index}>
              <TableCell>{item.description}</TableCell>
              <TableCell className="text-center">{item.quantity}</TableCell>
              <TableCell className="text-center">${item.rate.toFixed(2)}</TableCell>
              <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
            </TableRow>
          )) : (
            <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-10">No billable activity for this period.</TableCell>
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
                <TableRow className="text-base font-bold">
                    <TableCell colSpan={3} className="text-right">Total</TableCell>
                    <TableCell className="text-right">${invoice.total.toFixed(2)}</TableCell>
                </TableRow>
            </TableFooter>
        )}
      </Table>
       <div className="mt-8 text-gray-500 text-sm">
            Payment Terms: {invoice.client.paymentTerms}
        </div>
    </div>
  )
}

function PrintInvoicePageContent() {
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasPrinted = useRef(false);
    const searchParams = useSearchParams();

    useEffect(() => {
        const printId = searchParams.get('id');
        if (!printId) {
            setError("No invoice ID found. Please close this tab and try again.");
            return;
        }

        const data = sessionStorage.getItem(printId);
        if (data) {
            try {
                const parsedData = JSON.parse(data);
                setInvoice(parsedData);
                sessionStorage.removeItem(printId); // Clean up immediately after retrieving
            } catch (e) {
                setError("Failed to parse invoice data. The data may be corrupted.");
            }
        } else {
            setError("Could not find invoice data to print. Please close this tab and try generating the invoice again.");
        }
    }, [searchParams]);

    useEffect(() => {
        if (invoice && !hasPrinted.current) {
            hasPrinted.current = true;
            window.print();
        }
    }, [invoice]);

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100 p-8">
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h1 className="text-xl font-bold text-destructive mb-4">Error</h1>
                    <p>{error}</p>
                    <button 
                        onClick={() => window.close()} 
                        className="mt-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                        Close Tab
                    </button>
                </div>
            </div>
        )
    }

    if (!invoice) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Loading invoice for printing...</p>
            </div>
        )
    }

    return (
        <>
            <style jsx global>{`
                @media print {
                    body {
                        background-color: #fff;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0.5in;
                    }
                }
            `}</style>
            <InvoiceToPrint invoice={invoice} />
        </>
    );
}

export default function PrintInvoicePage() {
    return (
        <React.Suspense fallback={
             <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Loading...</p>
            </div>
        }>
            <PrintInvoicePageContent />
        </React.Suspense>
    )
}
