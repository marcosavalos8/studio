"use client";

import React from "react";
import { type DetailedInvoiceData } from "./page";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

interface ReportDisplayProps {
  report: DetailedInvoiceData;
  onBack: () => void;
}

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "$0.00";
  }
  return `$${value.toFixed(2)}`;
};

export function InvoiceReportDisplay({ report, onBack }: ReportDisplayProps) {
  const [showEmployeeDetails, setShowEmployeeDetails] = React.useState(false);
  const handlePrint = () => {
    window.print();
  };

  const sortedDates = Object.keys(report.dailyBreakdown).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div>
      <div className="mb-4 flex justify-between items-center print:hidden">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Generate New Invoice
        </Button>
        <div className="flex gap-2">
          {report.employeeDetails && report.employeeDetails.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowEmployeeDetails(!showEmployeeDetails)}
            >
              {showEmployeeDetails ? "Hide" : "Show"} Employee Details
            </Button>
          )}
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="report-container bg-white text-black p-8 rounded-lg border shadow-sm">
        <style jsx global>{`
          @media print {
            body {
              background-color: #fff !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
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
              margin: 0;
              padding: 2rem;
              color: #000;
            }
            .print\\:hidden {
              display: none;
            }
          }
          @page {
            size: auto;
            margin: 0.5in;
          }
        `}</style>
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-3xl font-bold text-primary">INVOICE</h1>
            <div className="mt-4">
              <div className="font-semibold text-gray-700">TO:</div>
              <div className="font-bold">{report.client.name}</div>
              <div className="">{report.client.billingAddress}</div>
              {report.client.email && <div>{report.client.email}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold">FieldTack WA</div>
            <div className="mt-4 text-sm text-gray-600">
              <p>
                <strong>Invoice Date:</strong> {format(new Date(), "LLL dd, y")}
              </p>
              <p>
                <strong>Period:</strong>{" "}
                {format(new Date(report.date.from), "LLL dd, y")} -{" "}
                {format(new Date(report.date.to), "LLL dd, y")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h2 className="font-semibold text-lg border-b-2 border-gray-200 pb-1 mb-2">
                {format(new Date(date), "EEEE, LLL dd, yyyy")}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(report.dailyBreakdown[date].tasks).map(
                    (task) => (
                      <TableRow key={task.taskName}>
                        <TableCell>{task.taskName}</TableCell>
                        <TableCell className="text-right">
                          {task.clientRateType === "hourly"
                            ? `${task.hours.toFixed(2)} hrs`
                            : `${task.pieces.toFixed(2)} pieces`}
                        </TableCell>
                        <TableCell className="text-right">
                          ${task.clientRate.toFixed(2)} /{" "}
                          {task.clientRateType === "hourly" ? "hr" : "piece"}
                        </TableCell>
                        <TableCell className="text-right">
                          ${task.cost.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">
                      Daily Total
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${report.dailyBreakdown[date].total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <div className="w-full max-w-md space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Total Base Labor Cost</span>
              <span>${report.laborCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Paid Rest Breaks</span>
              <span>${report.paidRestBreaks.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Minimum Wage Adjustments</span>
              <span>${report.minimumWageTopUp.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2">
              <span>Subtotal</span>
              <span>{formatCurrency(report.subtotal)}</span>
            </div>
            {report.commission > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Commission ({report.client.commissionRate}%)</span>
                <span>+ ${report.commission.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-2xl border-t-2 border-black mt-4 pt-4">
              <span>Total Due</span>
              <span>{formatCurrency(report.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-sm text-gray-500">
          <p className="font-semibold">Thank you for your business!</p>
          <p>Payment Terms: {report.client.paymentTerms}</p>
        </div>
      </div>

      {/* Employee Details Section */}
      {showEmployeeDetails && report.employeeDetails && report.employeeDetails.length > 0 && (
        <div className="report-container bg-white text-black p-8 rounded-lg border shadow-sm mt-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary mb-2">Employee Work Details</h1>
            <p className="text-sm text-gray-600">
              Period: {format(new Date(report.date.from), "LLL dd, y")} - {format(new Date(report.date.to), "LLL dd, y")}
            </p>
            <p className="text-sm text-gray-600">Client: {report.client.name}</p>
          </div>

          {report.employeeDetails.map((employee) => (
            <div key={employee.employeeId} className="mb-8 border-t pt-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">{employee.employeeName}</h2>
                <div className="text-sm text-gray-600 mt-1">
                  Total Hours: {employee.totalHours.toFixed(2)} | Total Pieces: {employee.totalPieces}
                </div>
              </div>

              <div className="space-y-4">
                {employee.dailyWork.map((day) => (
                  <div key={day.date}>
                    <h3 className="font-semibold text-md border-b border-gray-200 pb-1 mb-2">
                      {format(new Date(day.date), "EEEE, LLL dd, yyyy")}
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead className="text-right">Hours</TableHead>
                          <TableHead className="text-right">Pieces</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {day.tasks.map((task, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{task.taskName}</TableCell>
                            <TableCell className="text-right">
                              {task.hours > 0 ? task.hours.toFixed(2) : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {task.pieces > 0 ? task.pieces.toFixed(2) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
