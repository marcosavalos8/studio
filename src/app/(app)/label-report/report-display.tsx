"use client";

import React from "react";
import { type DetailedLabelReportData } from "./page";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";

interface ReportDisplayProps {
  report: DetailedLabelReportData;
  onBack: () => void;
}

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "$0.00";
  }
  return `$${value.toFixed(2)}`;
};

export function LabelReportDisplay({
  report,
  onBack,
}: ReportDisplayProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!report.employeeDetails || report.employeeDetails.length === 0) {
      return;
    }

    // Prepare data for Excel
    const excelData: any[] = [];

    // Add header row with date range
    const sortedDates = Object.keys(report.dailyBreakdown).sort(
      (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
    );
    if (sortedDates.length > 0) {
      const firstDate = parseLocalDate(sortedDates[0]);
      const lastDate = parseLocalDate(sortedDates[sortedDates.length - 1]);
      const startDay = format(firstDate, "EEEE");
      const endDay = format(lastDate, "EEEE");
      const startMonth = format(firstDate, "LLL");
      const endMonth = format(lastDate, "LLL");
      const startDayNum = format(firstDate, "dd");
      const endDayNum = format(lastDate, "dd");
      const year = format(lastDate, "yyyy");

      const dateRangeHeader = startMonth === endMonth
        ? `${startDay} - ${endDay}, ${startMonth} ${startDayNum}-${endDayNum}, ${year}`
        : `${startDay}, ${startMonth} ${startDayNum} - ${endDay}, ${endMonth} ${endDayNum}, ${year}`;

      excelData.push([dateRangeHeader]);
      excelData.push([]); // Empty row
    }

    // Collect all unique tasks across all employees
    const allTaskNames = new Set<string>();
    report.employeeDetails.forEach((employee) => {
      employee.tasksSummary.forEach((task) => {
        allTaskNames.add(task.taskName);
      });
    });
    const uniqueTasks = Array.from(allTaskNames);

    // Build header row
    const headerRow = ["Worker Name", "Hours"];
    uniqueTasks.forEach((taskName) => {
      headerRow.push(`${taskName} - Pieces`, `${taskName} - Rate`, `${taskName} - Pay`);
    });
    headerRow.push("Total Pieces Pay", "MIN PAY REQ", "Diff Owed");
    excelData.push(headerRow);

    // Build data rows
    report.employeeDetails.forEach((employee) => {
      const row: any[] = [
        employee.employeeName,
        employee.totalHours.toFixed(2),
      ];

      // Create a map of task name to task data for quick lookup
      const taskMap = new Map(
        employee.tasksSummary.map((task) => [task.taskName, task])
      );

      // Add columns for each unique task
      uniqueTasks.forEach((taskName) => {
        const task = taskMap.get(taskName);
        if (task) {
          row.push(
            task.quantity.toFixed(2),
            task.rate.toFixed(2),
            task.cost.toFixed(2)
          );
        } else {
          row.push(0, 0, 0); // Empty values if employee didn't work on this task
        }
      });

      // Calculate totals
      const totalPiecesPay = employee.tasksSummary.reduce(
        (sum, task) => sum + task.cost,
        0
      );
      const minPayRequired =
        totalPiecesPay +
        employee.paidRestBreaks +
        employee.minimumWageTopUp +
        (employee.overtimePremium || 0);
      const diffOwed =
        employee.paidRestBreaks +
        employee.minimumWageTopUp +
        (employee.overtimePremium || 0);

      row.push(
        totalPiecesPay.toFixed(2),
        minPayRequired.toFixed(2),
        diffOwed.toFixed(2)
      );

      excelData.push(row);
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Label Report");

    // Generate filename
    const filename = `label_report_${report.client.name}_${report.date.from}_to_${report.date.to}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  };

  const sortedDates = Object.keys(report.dailyBreakdown).sort(
    (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
  );

  const hasEmployeeDetails =
    report.employeeDetails && report.employeeDetails.length > 0;

  const formatDateRange = () => {
    if (sortedDates.length === 0) return "";
    const firstDate = parseLocalDate(sortedDates[0]);
    const lastDate = parseLocalDate(sortedDates[sortedDates.length - 1]);

    if (sortedDates.length === 1) {
      return format(firstDate, "EEEE, LLL dd, yyyy");
    }

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

  // Collect all unique tasks across all employees
  const allTaskNames = new Set<string>();
  if (hasEmployeeDetails && report.employeeDetails) {
    report.employeeDetails.forEach((employee) => {
      employee.tasksSummary.forEach((task) => {
        allTaskNames.add(task.taskName);
      });
    });
  }
  const uniqueTasks = Array.from(allTaskNames);

  return (
    <div>
      <div className="mb-4 flex justify-between items-center print:hidden">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Generate New Report
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
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
              padding: 1.5rem;
              color: #000;
              font-size: 11px;
            }
            .report-container table {
              font-size: 9px;
            }
            .report-container h1 {
              font-size: 20px;
            }
            .report-container h2 {
              font-size: 14px;
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            LABEL REPORT
          </h1>
          <p className="text-sm text-gray-600">
            Client: {report.client.name}
          </p>
        </div>

        <h2 className="font-semibold text-base border-b-2 border-gray-200 pb-1 mb-4">
          {formatDateRange()}
        </h2>

        {hasEmployeeDetails ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Worker Name</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Hours</TableHead>
                  {uniqueTasks.map((taskName) => (
                    <React.Fragment key={taskName}>
                      <TableHead className="text-right whitespace-nowrap">
                        {taskName} - Pieces
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {taskName} - Rate
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        {taskName} - Pay
                      </TableHead>
                    </React.Fragment>
                  ))}
                  <TableHead className="text-right whitespace-nowrap">
                    Total Pieces Pay
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    MIN PAY REQ
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    Diff Owed
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.employeeDetails?.map((employee) => {
                  // Create a map of task name to task data for quick lookup
                  const taskMap = new Map(
                    employee.tasksSummary.map((task) => [task.taskName, task])
                  );

                  const totalPiecesPay = employee.tasksSummary.reduce(
                    (sum, task) => sum + task.cost,
                    0
                  );
                  const minPayRequired =
                    totalPiecesPay +
                    employee.paidRestBreaks +
                    employee.minimumWageTopUp +
                    (employee.overtimePremium || 0);
                  const diffOwed =
                    employee.paidRestBreaks +
                    employee.minimumWageTopUp +
                    (employee.overtimePremium || 0);

                  return (
                    <TableRow key={employee.employeeId}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {employee.employeeName}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {employee.totalHours.toFixed(2)}
                      </TableCell>
                      {uniqueTasks.map((taskName) => {
                        const task = taskMap.get(taskName);
                        return (
                          <React.Fragment key={taskName}>
                            <TableCell className="text-right whitespace-nowrap">
                              {task ? task.quantity.toFixed(2) : "0.00"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {task ? formatCurrency(task.rate) : "$0.00"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {task ? formatCurrency(task.cost) : "$0.00"}
                            </TableCell>
                          </React.Fragment>
                        );
                      })}
                      <TableCell className="text-right whitespace-nowrap font-medium">
                        {formatCurrency(totalPiecesPay)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">
                        {formatCurrency(minPayRequired)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">
                        {formatCurrency(diffOwed)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No employee details available for this date range.
          </div>
        )}
      </div>
    </div>
  );
}
