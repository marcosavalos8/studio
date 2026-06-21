"use client";

import * as React from "react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManagementReport } from "./management-report";

interface ManagementReportDisplayProps {
  report: ManagementReport;
  period: { from: Date; to: Date };
  onBack: () => void;
}

const currency = (value: number): string =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const quantity = (value: number): string =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function ManagementReportDisplay({
  report,
  period,
  onBack,
}: ManagementReportDisplayProps) {
  const handlePrint = () => window.print();

  return (
    <div>
      <div className="mb-4 flex justify-between items-center print:hidden">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Generate New Report
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="report-container bg-card text-card-foreground p-6 rounded-lg border shadow-sm">
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .report-container,
            .report-container * {
              visibility: visible;
            }
            .report-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none;
              box-shadow: none;
            }
            .print\\:hidden {
              display: none;
            }
          }
          @page {
            size: landscape;
            margin: 0.4in;
          }
        `}</style>

        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold">Payroll Summary</h2>
          <p className="text-sm text-muted-foreground">
            {format(period.from, "LLL dd, y")} - {format(period.to, "LLL dd, y")}
          </p>
        </div>

        {report.rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No piecework found for the selected client(s) and period.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Variety</TableHead>
                <TableHead>Rate Type</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="whitespace-nowrap">
                    {format(parseLocalDate(row.date), "MM/dd/yy")}
                  </TableCell>
                  <TableCell>{row.clientName}</TableCell>
                  <TableCell>{row.taskName}</TableCell>
                  <TableCell>{row.variety || "—"}</TableCell>
                  <TableCell className="capitalize">
                    {row.rateType === "piece" ? "Piecework" : "Hourly"}
                  </TableCell>
                  <TableCell className="text-right">
                    {currency(row.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {quantity(row.quantity)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {currency(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-bold">
                <TableCell colSpan={6}>Total</TableCell>
                <TableCell className="text-right">
                  {quantity(report.totalQuantity)}
                </TableCell>
                <TableCell className="text-right">
                  {currency(report.totalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
    </div>
  );
}
