"use client";

import React from "react";
import { type DetailedInvoiceData } from "./page";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
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
  isGrouped?: boolean;
}

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "$0.00";
  }
  return `$${value.toFixed(2)}`;
};

export function InvoiceReportDisplay({ report, onBack, isGrouped = false }: ReportDisplayProps) {
  const [showEmployeeDetails, setShowEmployeeDetails] = React.useState(false);
  const handlePrint = () => {
    window.print();
  };

  const sortedDates = Object.keys(report.dailyBreakdown).sort(
    (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
  );

  // Helper to format date range
  const formatDateRange = () => {
    if (sortedDates.length === 0) return "";
    const firstDate = parseLocalDate(sortedDates[0]);
    const lastDate = parseLocalDate(sortedDates[sortedDates.length - 1]);
    
    if (sortedDates.length === 1) {
      return format(firstDate, "EEEE, LLL dd, yyyy");
    }
    
    // Format as "Tuesday - Friday, Oct 21-24, 2025"
    const startDay = format(firstDate, "EEEE");
    const endDay = format(lastDate, "EEEE");
    const startMonth = format(firstDate, "LLL");
    const endMonth = format(lastDate, "LLL");
    const startDayNum = format(firstDate, "dd");
    const endDayNum = format(lastDate, "dd");
    const year = format(lastDate, "yyyy");
    
    if (startMonth === endMonth) {
      return `${startDay} - ${endDay}, ${startMonth} ${startDayNum}-${endDayNum}, ${year}`;
    } else {
      return `${startDay}, ${startMonth} ${startDayNum} - ${endDay}, ${endMonth} ${endDayNum}, ${year}`;
    }
  };

  // Helper to abbreviate task names for compact display
  const abbreviateTaskName = (taskName: string): string => {
    // Example: "Apple Picking (Granny Smith) - Piecework" → "AP(GS)"
    // Extract words and parentheses content
    const words = taskName.split(/[\s-]+/).filter(w => w.length > 0);
    let abbrev = '';
    
    for (const word of words) {
      // Check if word contains parentheses
      const parenMatch = word.match(/\(([^)]+)\)/);
      if (parenMatch) {
        // Extract initials from content inside parentheses
        const innerWords = parenMatch[1].split(/\s+/);
        const innerAbbrev = innerWords.map(w => w[0].toUpperCase()).join('');
        abbrev += `(${innerAbbrev})`;
      } else if (word.length > 0 && /[A-Za-z]/.test(word[0])) {
        // Take first letter of regular words (skip if starts with special char)
        abbrev += word[0].toUpperCase();
      }
    }
    
    return abbrev || taskName.substring(0, 6);
  };

  // Helper to shorten employee name (First + Last Initial)
  const shortenEmployeeName = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    // Return first name + first letter of last name
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

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
              padding: 1rem;
              color: #000;
            }
            .print\\:hidden {
              display: none;
            }
            .grouped-table {
              font-size: 7px !important;
            }
            .grouped-table th,
            .grouped-table td {
              padding: 1px 2px !important;
              white-space: nowrap;
            }
            .grouped-table th {
              font-size: 6px !important;
              line-height: 1.2;
            }
            .task-header-full {
              font-size: 5px !important;
              display: block;
              line-height: 1;
              margin-bottom: 1px;
            }
            .task-header-abbrev {
              font-size: 7px !important;
              font-weight: bold;
            }
          }
          @page {
            size: landscape;
            margin: 0.25in;
          }
        `}</style>
        <div className={`flex justify-between items-start ${isGrouped ? 'mb-6' : 'mb-12'}`}>
          <div>
            <h1 className={`font-bold text-primary ${isGrouped ? 'text-2xl' : 'text-3xl'}`}>INVOICE</h1>
            <div className={isGrouped ? 'mt-2' : 'mt-4'}>
              <div className="font-semibold text-gray-700">TO:</div>
              <div className="font-bold">{report.client.name}</div>
              <div className="">{report.client.billingAddress}</div>
              {report.client.email && <div>{report.client.email}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className={`font-semibold ${isGrouped ? 'text-lg' : 'text-xl'}`}>FieldTack WA</div>
            <div className={`text-sm text-gray-600 ${isGrouped ? 'mt-2' : 'mt-4'}`}>
              <p>
                <strong>Invoice Date:</strong> {format(new Date(), "LLL dd, y")}
              </p>
              <p>
                <strong>Period:</strong>{" "}
                {format(parseLocalDate(report.date.from), "LLL dd, y")} -{" "}
                {format(parseLocalDate(report.date.to), "LLL dd, y")}
              </p>
            </div>
          </div>
        </div>

        {isGrouped && report.groupedData ? (
          // Grouped Report View
          <div className="space-y-6">
            <div>
              <h2 className="font-semibold text-lg border-b-2 border-gray-200 pb-1 mb-2">
                {formatDateRange()}
              </h2>
              <div className="overflow-x-auto">
                <Table className="grouped-table text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left text-xs px-1">Worker</TableHead>
                      <TableHead className="text-right text-xs px-1">Hrs</TableHead>
                      {/* Dynamic task columns - all employees have the same tasks now 
                          Note: Task normalization happens during data generation (invoicing-form.tsx)
                          All employees are given the same set of tasks with 0 values if not worked */}
                      {report.groupedData.employees.length > 0 && report.groupedData.employees[0] &&
                        report.groupedData.employees[0].taskBreakdown.map((task, idx) => (
                          <React.Fragment key={idx}>
                            <TableHead className="text-center text-xs px-1" title={task.taskName}>
                              <span className="task-header-full">{task.taskName}</span>
                              <span className="task-header-abbrev">{abbreviateTaskName(task.taskName)}</span>
                            </TableHead>
                            <TableHead className="text-right text-xs px-1">Rate</TableHead>
                            <TableHead className="text-right text-xs px-1">Pay</TableHead>
                          </React.Fragment>
                        ))}
                      <TableHead className="text-right text-xs px-1">Total</TableHead>
                      <TableHead className="text-right text-xs px-1">MinReq</TableHead>
                      <TableHead className="text-right text-xs px-1">Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.groupedData.employees.map((employee) => (
                      <TableRow key={employee.employeeId}>
                        <TableCell className="font-medium text-xs px-1" title={employee.employeeName}>
                          {shortenEmployeeName(employee.employeeName)}
                        </TableCell>
                        <TableCell className="text-right text-xs px-1">{employee.totalHours.toFixed(2)}</TableCell>
                        {/* Render task data in the same order as header */}
                        {employee.taskBreakdown.map((task, idx) => (
                          <React.Fragment key={idx}>
                            <TableCell className="text-right text-xs px-1">
                              {task.pieces > 0 ? task.pieces.toFixed(2) : "0.00"}
                            </TableCell>
                            <TableCell className="text-right text-xs px-1">
                              {task.rate > 0 ? `$${task.rate.toFixed(2)}` : "$0.00"}
                            </TableCell>
                            <TableCell className="text-right text-xs px-1">
                              {task.piecePay > 0 ? `$${task.piecePay.toFixed(2)}` : "$0.00"}
                            </TableCell>
                          </React.Fragment>
                        ))}
                        <TableCell className="text-right font-semibold text-xs px-1">
                          ${employee.totalPiecesPay.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs px-1">
                          ${employee.minimumPayRequired.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs px-1">
                          ${employee.differenceOwed.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          // Daily Breakdown View (Original)
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <div key={date}>
                <h2 className="font-semibold text-lg border-b-2 border-gray-200 pb-1 mb-2">
                  {format(parseLocalDate(date), "EEEE, LLL dd, yyyy")}
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
        )}

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
              Period: {format(parseLocalDate(report.date.from), "LLL dd, y")} - {format(parseLocalDate(report.date.to), "LLL dd, y")}
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
                      {format(parseLocalDate(day.date), "EEEE, LLL dd, yyyy")}
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
