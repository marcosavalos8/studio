'use client';

import React, { useEffect, useState, useRef } from 'react';
import { DetailedInvoiceData, DailyInvoiceItem } from '../page';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

function PrintInvoicePage() {
  const [invoice, setInvoice] = useState<DetailedInvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasPrinted = useRef(false);

  useEffect(() => {
    const data = sessionStorage.getItem('print-invoice-data');
    if (data) {
      setInvoice(JSON.parse(data));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (invoice && !isLoading && !hasPrinted.current) {
        hasPrinted.current = true;
        setTimeout(() => window.print(), 500);
    }
  }, [invoice, isLoading]);
  
  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!invoice) {
    return <div className="p-8 text-center text-red-500">Could not find report data to print. Please go back and generate the report again.</div>;
  }


  return (
    <div className="bg-white text-black p-8">
        <style jsx global>{`
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                @page {
                    size: auto;
                    margin: 20mm;
                }
            }
        `}</style>
        <div className="flex justify-between items-start mb-8">
            <div>
            <h1 className="text-3xl font-bold text-primary">INVOICE</h1>
            <div className="mt-2">
                <div className="font-semibold">TO:</div>
                <div>{invoice.client.name}</div>
                <div>{invoice.client.billingAddress}</div>
                {invoice.client.email && <div>{invoice.client.email}</div>}
            </div>
            </div>
            <div className="text-right">
            <div className="text-xl font-semibold">FieldTack WA</div>
            <div className="text-sm">Invoice Date: {format(new Date(), "LLL dd, y")}</div>
            <div className="text-sm">Period: {format(new Date(invoice.date.from), "LLL dd, y")} - {format(new Date(invoice.date.to), "LLL dd, y")}</div>
            </div>
        </div>

        <div className="space-y-6">
            {invoice.dailyItems.map((day: DailyInvoiceItem) => (
                <div key={day.date}>
                    <h3 className="text-lg font-semibold border-b-2 border-gray-200 pb-1 mb-2">
                        {format(new Date(day.date), "EEEE, LLL dd, yyyy")}
                    </h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {day.items.map((item, index) => (
                                <TableRow key={index}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-right">{item.quantity.toFixed(2)} <span className="text-gray-500 text-xs">{item.unit}</span></TableCell>
                                <TableCell className="text-right">${item.rate.toFixed(2)}</TableCell>
                                <TableCell className="text-right">${item.total.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={3} className="text-right font-semibold">Daily Total</TableCell>
                                <TableCell className="text-right font-semibold">${day.dailyTotal.toFixed(2)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            ))}
        </div>
        
        {invoice.dailyItems.length === 0 && (
            <div className="text-center text-gray-500 py-10">
                No billable activity for this period.
            </div>
        )}

        {invoice.dailyItems.length > 0 && (
            <div className="mt-8 flex justify-end">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>${invoice.subtotal.toFixed(2)}</span>
                    </div>
                    {invoice.commission > 0 && (
                    <div className="flex justify-between">
                        <span>Commission ({invoice.client.commissionRate}%)</span>
                        <span>${invoice.commission.toFixed(2)}</span>
                    </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total Due</span>
                        <span>${invoice.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        )}

        <div className="mt-12 text-center text-sm text-gray-500">
            Payment Terms: {invoice.client.paymentTerms}
        </div>
    </div>
  );
}

export default PrintInvoicePage;
