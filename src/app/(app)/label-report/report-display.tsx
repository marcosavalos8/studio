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

  const handleExportExcel = async () => {
    if (!report.employeeDetails || report.employeeDetails.length === 0) {
      return;
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {};

    // Collect all unique tasks across all employees
    const allTaskNames = new Set<string>();
    report.employeeDetails.forEach((employee) => {
      employee.tasksSummary.forEach((task) => {
        allTaskNames.add(task.taskName);
      });
    });
    const uniqueTasks = Array.from(allTaskNames);

    // Prepare date range
    const sortedDates = Object.keys(report.dailyBreakdown).sort(
      (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
    );
    let dateRangeStr = "";
    if (sortedDates.length > 0) {
      const firstDate = parseLocalDate(sortedDates[0]);
      const lastDate = parseLocalDate(sortedDates[sortedDates.length - 1]);
      dateRangeStr = `${format(firstDate, "MM/dd/yyyy")}`;
    }

    // Build header section
    ws["!ref"] = "A1:Z100"; // Set range
    ws["A1"] = { v: "J&M Agricultural Labor LLC", t: "s" };
    ws["A2"] = { v: "Labor Report", t: "s" };
    ws["A4"] = { v: dateRangeStr, t: "s" };
    ws["A5"] = { v: "$ 19.82 :Min Wage", t: "s" };
    
    ws["B4"] = { v: "EIN#", t: "s" };
    ws["C4"] = { v: "33-2236422", t: "s" };
    ws["D4"] = { v: "LIC#172-25", t: "s" };
    ws["B5"] = { v: "UBI#", t: "s" };
    ws["C5"] = { v: "605 650 411", t: "s" };

    // Header row for table (row 7)
    const headerRow = 7;
    const headers = ["Worker Name", "Hours"];
    let col = 0;
    
    // Set Worker Name and Hours
    ws[XLSX.utils.encode_cell({ r: headerRow - 1, c: col++ })] = { v: "Worker Name", t: "s" };
    ws[XLSX.utils.encode_cell({ r: headerRow - 1, c: col++ })] = { v: "Hours", t: "s" };

    // Add task columns (renamed to Piece A, Piece B, etc.)
    uniqueTasks.forEach((taskName, idx) => {
      const label = String.fromCharCode(65 + idx); // A, B, C, etc.
      ws[XLSX.utils.encode_cell({ r: headerRow - 1, c: col++ })] = { v: `Piece ${label}`, t: "s" };
      ws[XLSX.utils.encode_cell({ r: headerRow - 1, c: col++ })] = { v: `Rate ${label}`, t: "s" };
      ws[XLSX.utils.encode_cell({ r: headerRow - 1, c: col++ })] = { v: `Piece Pay ${label}`, t: "s" };
    });

    ws[XLSX.utils.encode_cell({ r: headerRow - 1, c: col++ })] = { v: "Total Pieces Pay", t: "s" };
    ws[XLSX.utils.encode_cell({ r: headerRow - 1, c: col++ })] = { v: "MIN PAY REQ", t: "s" };
    ws[XLSX.utils.encode_cell({ r: headerRow - 1, c: col++ })] = { v: "Diff Owed", t: "s" };

    const totalCols = col;

    // Data rows
    let currentRow = headerRow;
    report.employeeDetails.forEach((employee) => {
      col = 0;
      
      ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { 
        v: employee.employeeName, 
        t: "s" 
      };
      ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { 
        v: parseFloat(employee.totalHours.toFixed(2)), 
        t: "n",
        z: "0.00"
      };

      // Create a map of task name to task data for quick lookup
      const taskMap = new Map(
        employee.tasksSummary.map((task) => [task.taskName, task])
      );

      // Add task data
      uniqueTasks.forEach((taskName) => {
        const task = taskMap.get(taskName);
        if (task) {
          ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { 
            v: parseFloat(task.quantity.toFixed(2)), 
            t: "n",
            z: "0.00"
          };
          ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { 
            v: parseFloat(task.rate.toFixed(2)), 
            t: "n",
            z: "$0.00"
          };
          ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { 
            v: parseFloat(task.cost.toFixed(2)), 
            t: "n",
            z: "$0.00"
          };
        } else {
          ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { v: 0, t: "n", z: "0.00" };
          ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { v: 0, t: "n", z: "$0.00" };
          ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { v: 0, t: "n", z: "$0.00" };
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

      ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { 
        v: parseFloat(totalPiecesPay.toFixed(2)), 
        t: "n",
        z: "$0.00"
      };
      ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { 
        v: parseFloat(minPayRequired.toFixed(2)), 
        t: "n",
        z: "$0.00"
      };
      ws[XLSX.utils.encode_cell({ r: currentRow, c: col++ })] = { 
        v: parseFloat(diffOwed.toFixed(2)), 
        t: "n",
        z: "$0.00"
      };

      currentRow++;
    });

    // Add glossary section after a few blank rows
    currentRow += 3; // Skip 3 rows for spacing
    
    // Add glossary title
    ws[XLSX.utils.encode_cell({ r: currentRow, c: 0 })] = { 
      v: "Task Legend:", 
      t: "s" 
    };
    currentRow++;
    
    // Add task definitions
    uniqueTasks.forEach((taskName, idx) => {
      const label = String.fromCharCode(65 + idx); // A, B, C, etc.
      ws[XLSX.utils.encode_cell({ r: currentRow, c: 0 })] = { 
        v: `PIECE ${label} = ${taskName}`, 
        t: "s" 
      };
      currentRow++;
    });

    // Set column widths
    const colWidths = [
      { wch: 20 }, // Worker Name
      { wch: 8 },  // Hours
    ];
    
    uniqueTasks.forEach(() => {
      colWidths.push({ wch: 10 }); // Piece
      colWidths.push({ wch: 10 }); // Rate
      colWidths.push({ wch: 12 }); // Pay
    });
    
    colWidths.push({ wch: 15 }); // Total Pieces Pay
    colWidths.push({ wch: 12 }); // MIN PAY REQ
    colWidths.push({ wch: 12 }); // Diff Owed
    
    ws["!cols"] = colWidths;

    // Merge cells for title
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }, // J&M Agricultural Labor LLC
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } }, // Labor Report
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Labor Report");

    // Generate filename
    const filename = `labor_report_${report.client.name}_${report.date.from}_to_${report.date.to}.xlsx`;

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
              padding: 0.5rem;
              color: #000;
              font-size: 8px;
            }
            .report-container table {
              font-size: 7px;
            }
            .report-container table th,
            .report-container table td {
              padding: 2px 4px !important;
            }
            .report-container h1 {
              font-size: 14px;
              margin-bottom: 0.25rem;
            }
            .report-container h2 {
              font-size: 10px;
              margin-bottom: 0.25rem;
            }
            .report-container p {
              font-size: 8px;
              margin-bottom: 0.25rem;
            }
            .print\\:hidden {
              display: none;
            }
          }
          @page {
            size: landscape;
            margin: 0.3in;
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
                  {uniqueTasks.map((taskName, idx) => {
                    const label = String.fromCharCode(65 + idx); // A, B, C, etc.
                    return (
                      <React.Fragment key={taskName}>
                        <TableHead className="text-right whitespace-nowrap">
                          Piece {label}
                        </TableHead>
                        <TableHead className="text-right whitespace-nowrap">
                          Rate {label}
                        </TableHead>
                        <TableHead className="text-right whitespace-nowrap">
                          Piece Pay {label}
                        </TableHead>
                      </React.Fragment>
                    );
                  })}
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
