'use client';

import React from 'react';
import { type DetailedInvoiceData, type DailyInvoiceItem } from './page';
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
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';

interface ReportDisplayProps {
    report: DetailedInvoiceData;
    onBack: () => void;
}

export function InvoiceReportDisplay({ report, onBack }: ReportDisplayProps) {

  const handlePrint = () => {
    window.print();
  };
  
  return (
    <div>
        <div className="mb-4 flex justify-between items-center print:hidden">
            <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Generate New Invoice
            </Button>
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save as PDF
            </Button>
        </div>

        <div className="report-container bg-white text-black p-8 rounded-lg border shadow-sm">
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .report-container, .report-container * {
                        visibility: visible;
                    }
                    .report-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        border: none;
                        box-shadow: none;
                        margin: 0;
                        padding: 0;
                    }
                    .print\\:hidden {
                        display: none;
                    }
                }
            `}</style>
            <div className="flex justify-between items-start mb-8">
                <div>
                <h1 className="text-3xl font-bold text-primary">INVOICE</h1>
                <div className="mt-2">
                    <div className="font-semibold">TO:</div>
                    <div>{report.client.name}</div>
                    <div>{report.client.billingAddress}</div>
                    {report.client.email && <div>{report.client.email}</div>}
                </div>
                </div>
                <div className="text-right">
                <div className="text-xl font-semibold">FieldTack WA</div>
                <div className="text-sm">Invoice Date: {format(new Date(), "LLL dd, y")}</div>
                <div className="text-sm">Period: {format(new Date(report.date.from), "LLL dd, y")} - {format(new Date(report.date.to), "LLL dd, y")}</div>
                </div>
            </div>

            <div className="space-y-6">
                {report.dailyItems.map((day: DailyInvoiceItem) => (
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
            
            {report.dailyItems.length === 0 && (
                <div className="text-center text-gray-500 py-10">
                    No billable activity for this period.
                </div>
            )}

            {report.dailyItems.length > 0 && (
                <div className="mt-8 flex justify-end">
                    <div className="w-full max-w-sm space-y-2">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>${report.subtotal.toFixed(2)}</span>
                        </div>
                        {report.commission > 0 && (
                        <div className="flex justify-between">
                            <span>Commission ({report.client.commissionRate}%)</span>
                            <span>${report.commission.toFixed(2)}</span>
                        </div>
                        )}
                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                            <span>Total Due</span>
                            <span>${report.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-12 text-center text-sm text-gray-500">
                Payment Terms: {report.client.paymentTerms}
            </div>
        </div>
    </div>
  );
}
