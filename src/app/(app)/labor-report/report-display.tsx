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
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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

// Helper function to truncate worker names to 2 names on small/medium screens
const truncateWorkerName = (fullName: string): string => {
  if (!fullName || typeof fullName !== 'string') {
    return '';
  }
  const nameParts = fullName.trim().split(/\s+/).filter(part => part.length > 0);
  if (nameParts.length <= 2) {
    return fullName;
  }
  // Return first two names only
  return `${nameParts[0]} ${nameParts[1]}`;
};

export function LabelReportDisplay({ report, onBack }: ReportDisplayProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    if (!report.employeeDetails || report.employeeDetails.length === 0) {
      return;
    }

    try {
      // Create new workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Labor Report");

      // Collect all unique tasks
      const allTaskNames = new Set<string>();
      report.employeeDetails.forEach((employee) => {
        employee.tasksSummary.forEach((task) => {
          allTaskNames.add(task.taskName);
        });
      });
      const uniqueTasks = Array.from(allTaskNames);

      // Check if any employee has overtime
      const hasOvertimeData = report.employeeDetails.some(
        (employee) => (employee.overtimeHours || 0) > 0
      );

      // Prepare date range
      const sortedDates = Object.keys(report.dailyBreakdown).sort(
        (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
      );
      let dateRangeStr = "";
      if (sortedDates.length > 0) {
        const firstDate = parseLocalDate(sortedDates[0]);
        const lastDate = parseLocalDate(sortedDates[sortedDates.length - 1]);
        dateRangeStr = `${format(firstDate, "MM/dd/yyyy")}`;
        if (sortedDates.length > 1) {
          dateRangeStr += ` - ${format(lastDate, "MM/dd/yyyy")}`;
        }
      }

      // Calculate total columns for merging
      const overtimeColumns = hasOvertimeData ? 3 : 0; // OT Hours, Regular Rate, OT Premium
      const totalColumns = 2 + uniqueTasks.length * 3 + 3 + overtimeColumns; // Name + Hours + (Tasks*3) + Total+Min+Diff + Overtime

      // Set up header section with styling
      worksheet.mergeCells(1, 1, 1, totalColumns);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = "Labor Report | J&M Agricultural Labor LLC";
      titleCell.font = { size: 16, bold: true, color: { argb: "FF70AD47" } }; // Green color
      titleCell.alignment = { horizontal: "left" }; // Left-aligned

      // Company info section
      const dateCell = worksheet.getCell(4, 1);
      dateCell.value = dateRangeStr;
      dateCell.font = { bold: true };

      const minWageCell = worksheet.getCell(5, 1);
      minWageCell.value = `$ ${(report.client.minimumWage || 19.82).toFixed(2)} :Min Wage`;
      minWageCell.font = { size: 10 };

      const einCell = worksheet.getCell(4, 2);
      einCell.value = "EIN#";
      einCell.font = { bold: true };

      const einValueCell = worksheet.getCell(4, 3);
      einValueCell.value = "33-2236422";

      const licCell = worksheet.getCell(4, 4);
      licCell.value = "LIC#172-25";
      licCell.font = { bold: true };

      const ubiCell = worksheet.getCell(5, 2);
      ubiCell.value = "UBI#";
      ubiCell.font = { bold: true };

      const ubiValueCell = worksheet.getCell(5, 3);
      ubiValueCell.value = "605 650 411";

      // Try to add logo (optional)
      try {
        const logoResponse = await fetch("/logo.jpeg");
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          const logoId = workbook.addImage({
            buffer: logoBuffer,
            extension: "jpeg",
          });

          worksheet.addImage(logoId, {
            tl: { col: totalColumns - 2, row: 0 },
            ext: { width: 100, height: 80 },
          });
        }
      } catch (error) {
        console.warn("Could not add logo to Excel:", error);
      }

      // Row 6 is left blank

      // Add green line below company info (row 7)
      for (let col = 1; col <= totalColumns; col++) {
        const borderCell = worksheet.getCell(7, col);
        borderCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF70AD47" }, // Green color
        };
      }

      // Table headers starting at row 8
      const headerRow = 8;
      let currentCol = 1;

      // Style for headers with green background
      const headerStyle = {
        font: { bold: true, size: 10 },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2EFDA" }, // Light green background
        },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin", color: { argb: "FF70AD47" } }, // Green border
          left: { style: "thin", color: { argb: "FF70AD47" } },
          bottom: { style: "thin", color: { argb: "FF000000" } }, // Black bottom
          right: { style: "thin", color: { argb: "FF70AD47" } },
        },
      };

      // Main headers
      const workerNameHeader = worksheet.getCell(headerRow, currentCol++);
      workerNameHeader.value = "Worker Name";
      workerNameHeader.style = headerStyle;

      const hoursHeader = worksheet.getCell(headerRow, currentCol++);
      hoursHeader.value = "Hours";
      hoursHeader.style = headerStyle;

      // Task headers (Piece A, Rate A, Piece Pay A, etc.)
      uniqueTasks.forEach((taskName, idx) => {
        const label = String.fromCharCode(65 + idx);

        const pieceHeader = worksheet.getCell(headerRow, currentCol++);
        pieceHeader.value = `Piece ${label}`;
        pieceHeader.style = headerStyle;

        const rateHeader = worksheet.getCell(headerRow, currentCol++);
        rateHeader.value = `Rate ${label}`;
        rateHeader.style = headerStyle;

        const payHeader = worksheet.getCell(headerRow, currentCol++);
        payHeader.value = `Piece Pay ${label}`;
        payHeader.style = headerStyle;
      });

      const totalPiecesHeader = worksheet.getCell(headerRow, currentCol++);
      totalPiecesHeader.value = "Total Pieces Pay";
      totalPiecesHeader.style = headerStyle;

      // Add overtime headers if there's overtime data
      if (hasOvertimeData) {
        const overtimeHoursHeader = worksheet.getCell(headerRow, currentCol++);
        overtimeHoursHeader.value = "Overtime Hours (over 40/week)";
        overtimeHoursHeader.style = headerStyle;

        const regularRateHeader = worksheet.getCell(headerRow, currentCol++);
        regularRateHeader.value = "Regular Rate for OT Calculation";
        regularRateHeader.style = headerStyle;

        const overtimePremiumHeader = worksheet.getCell(headerRow, currentCol++);
        overtimePremiumHeader.value = "Overtime Premium (0.5x rate)";
        overtimePremiumHeader.style = headerStyle;
      }

      // MIN PAY REQ and Diff Owed always at the end
      const minPayHeader = worksheet.getCell(headerRow, currentCol++);
      minPayHeader.value = "MIN PAY REQ";
      minPayHeader.style = headerStyle;

      const diffOwedHeader = worksheet.getCell(headerRow, currentCol++);
      diffOwedHeader.value = "Diff Owed";
      diffOwedHeader.style = headerStyle;

      // Data rows
      let currentRow = headerRow + 1;

      // Cell border style with only green left/right borders (no horizontal borders)
      const cellBorderStyle = {
        left: { style: "thin", color: { argb: "FF70AD47" } }, // Green
        right: { style: "thin", color: { argb: "FF70AD47" } }, // Green
      };

      report.employeeDetails.forEach((employee) => {
        currentCol = 1;

        // Employee name
        const nameCell = worksheet.getCell(currentRow, currentCol++);
        nameCell.value = employee.employeeName;
        nameCell.style = {
          border: cellBorderStyle,
          font: { size: 9 },
        };

        // Hours
        const hoursCell = worksheet.getCell(currentRow, currentCol++);
        hoursCell.value = parseFloat(employee.totalHours.toFixed(2));
        hoursCell.style = {
          border: cellBorderStyle,
          numFmt: "0.00",
        };

        // Create task map
        const taskMap = new Map(
          employee.tasksSummary.map((task) => [task.taskName, task])
        );

        // Task data
        uniqueTasks.forEach((taskName) => {
          const task = taskMap.get(taskName);

          const pieceCell = worksheet.getCell(currentRow, currentCol++);
          pieceCell.value = task ? parseFloat(task.quantity.toFixed(2)) : 0;
          pieceCell.style = {
            border: cellBorderStyle,
            numFmt: "0.00",
          };

          const rateCell = worksheet.getCell(currentRow, currentCol++);
          rateCell.value = task ? parseFloat(task.rate.toFixed(2)) : 0;
          rateCell.style = {
            border: cellBorderStyle,
            numFmt: '"$"0.00',
          };

          const payCell = worksheet.getCell(currentRow, currentCol++);
          payCell.value = task ? parseFloat(task.cost.toFixed(2)) : 0;
          payCell.style = {
            border: cellBorderStyle,
            numFmt: '"$"0.00',
          };
        });

        // Totals
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

        const totalPiecesCell = worksheet.getCell(currentRow, currentCol++);
        totalPiecesCell.value = parseFloat(totalPiecesPay.toFixed(2));
        totalPiecesCell.style = {
          border: cellBorderStyle,
          numFmt: '"$"0.00',
          font: { bold: true },
        };

        // Add overtime cells if there's overtime data
        if (hasOvertimeData) {
          const overtimeHoursCell = worksheet.getCell(currentRow, currentCol++);
          overtimeHoursCell.value = parseFloat((employee.overtimeHours || 0).toFixed(2));
          overtimeHoursCell.style = {
            border: cellBorderStyle,
            numFmt: "0.00",
            font: { bold: true },
          };

          const regularRateCell = worksheet.getCell(currentRow, currentCol++);
          regularRateCell.value = parseFloat((employee.regularRate || 0).toFixed(2));
          regularRateCell.style = {
            border: cellBorderStyle,
            numFmt: '"$"0.00',
            font: { bold: true },
          };

          const overtimePremiumCell = worksheet.getCell(currentRow, currentCol++);
          overtimePremiumCell.value = parseFloat((employee.overtimePremium || 0).toFixed(2));
          overtimePremiumCell.style = {
            border: cellBorderStyle,
            numFmt: '"$"0.00',
            font: { bold: true },
          };
        }

        // MIN PAY REQ and Diff Owed always at the end
        const minPayCell = worksheet.getCell(currentRow, currentCol++);
        minPayCell.value = parseFloat(minPayRequired.toFixed(2));
        minPayCell.style = {
          border: cellBorderStyle,
          numFmt: '"$"0.00',
          font: { bold: true },
        };

        const diffCell = worksheet.getCell(currentRow, currentCol++);
        diffCell.value = parseFloat(diffOwed.toFixed(2));
        diffCell.style = {
          border: cellBorderStyle,
          numFmt: '"$"0.00',
          font: { bold: true },
        };

        currentRow++;
      });

      // Add task legend
      currentRow += 2;
      const legendCell = worksheet.getCell(currentRow, 1);
      legendCell.value = "Task Legend:";
      legendCell.font = { bold: true, size: 12 };
      currentRow++;

      uniqueTasks.forEach((taskName, idx) => {
        const label = String.fromCharCode(65 + idx);
        const taskLegendCell = worksheet.getCell(currentRow, 1);
        taskLegendCell.value = `PIECE ${label} = ${taskName}`;
        taskLegendCell.font = { size: 10 };
        currentRow++;
      });

      // Set column widths
      worksheet.getColumn(1).width = 20; // Worker Name
      worksheet.getColumn(2).width = 8; // Hours

      let colIndex = 3;
      uniqueTasks.forEach(() => {
        worksheet.getColumn(colIndex++).width = 8; // Piece
        worksheet.getColumn(colIndex++).width = 8; // Rate
        worksheet.getColumn(colIndex++).width = 12; // Pay
      });

      worksheet.getColumn(colIndex++).width = 15; // Total Pieces Pay

      // Add overtime column widths if there's overtime data
      if (hasOvertimeData) {
        worksheet.getColumn(colIndex++).width = 18; // Overtime Hours
        worksheet.getColumn(colIndex++).width = 20; // Regular Rate
        worksheet.getColumn(colIndex++).width = 18; // Overtime Premium
      }

      // MIN PAY REQ and Diff Owed always at the end
      worksheet.getColumn(colIndex++).width = 12; // MIN PAY REQ
      worksheet.getColumn(colIndex++).width = 12; // Diff Owed

      // Generate and save file
      const filename = `labor_report_${report.client.name.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${dateRangeStr.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, filename);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    }
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

  // Check if any employee has overtime
  const hasOvertimeData = report.employeeDetails?.some(
    (employee) => (employee.overtimeHours || 0) > 0
  ) || false;

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
              border: 1px solid #000 !important;
            }
            .report-container h1 {
              font-size: 16px;
              margin-bottom: 0.25rem;
              text-align: left;
            }
            .report-container h2 {
              font-size: 12px;
              margin-bottom: 0.25rem;
              text-align: center;
            }
            .report-container p {
              font-size: 9px;
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

        {/* Header con logo */}
        <div className="mb-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-left mb-1 text-green-700">
                Labor Report | J&M Agricultural Labor LLC
              </h1>
            </div>
            <div className="absolute right-0 top-0">
              <img
                src="/logo.jpeg"
                alt="JM AGRI Logo"
                className="w-24 h-20 object-contain"
              />
            </div>
          </div>

          {/* Company info section */}
          <div className="grid grid-cols-3 gap-4 text-sm mt-4">
            <div>
              <p>
                <strong>{formatDateRange()}</strong>
              </p>
              <p>
                <strong>$ {(report.client.minimumWage || 19.82).toFixed(2)} :Min Wage</strong>
              </p>
            </div>
            <div>
              <p>
                <strong>EIN#</strong> 33-2236422
              </p>
              <p>
                <strong>UBI#</strong> 605 650 411
              </p>
            </div>
            <div>
              <p>
                <strong>LIC#172-25</strong>
              </p>
            </div>
          </div>
        </div>

        {hasEmployeeDetails ? (
          <div className="overflow-x-auto">
            {/* Green line above headers */}
            <div className="h-1 bg-green-700 mb-0"></div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                    Worker Name
                  </th>
                  <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                    Hours
                  </th>
                  {uniqueTasks.map((taskName, idx) => {
                    const label = String.fromCharCode(65 + idx);

                    return (
                      <React.Fragment key={taskName}>
                        <th
                          className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-1 py-1 text-center font-bold bg-green-100 text-black"
                        >
                          Piece {label}
                        </th>
                        <th
                          className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-1 py-1 text-center font-bold bg-green-100 text-black"
                        >
                          Rate {label}
                        </th>
                        <th
                          className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-1 py-1 text-center font-bold bg-green-100 text-black"
                        >
                          Piece Pay {label}
                        </th>
                      </React.Fragment>
                    );
                  })}
                  <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                    Total Pieces Pay
                  </th>
                  {hasOvertimeData && (
                    <>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                        Overtime Hours (over 40/week)
                      </th>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                        Regular Rate for OT Calculation
                      </th>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                        Overtime Premium (0.5x rate)
                      </th>
                    </>
                  )}
                  <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                    MIN PAY REQ
                  </th>
                  <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                    Diff Owed
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.employeeDetails?.map((employee, rowIndex) => {
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
                    <tr
                      key={employee.employeeId}
                      className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 font-medium text-left">
                        <span className="lg:hidden">
                          {truncateWorkerName(employee.employeeName)}
                        </span>
                        <span className="hidden lg:inline">
                          {employee.employeeName}
                        </span>
                      </td>
                      <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center">
                        {employee.totalHours.toFixed(2)}
                      </td>
                      {uniqueTasks.map((taskName) => {
                        const task = taskMap.get(taskName);
                        return (
                          <React.Fragment key={taskName}>
                            <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-1 py-1 text-center">
                              {task ? task.quantity.toFixed(2) : "0.00"}
                            </td>
                            <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-1 py-1 text-center">
                              $ {task ? task.rate.toFixed(2) : "0.00"}
                            </td>
                            <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-1 py-1 text-center">
                              $ {task ? task.cost.toFixed(2) : "0.00"}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                        {formatCurrency(totalPiecesPay)}
                      </td>
                      {hasOvertimeData && (
                        <>
                          <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                            {(employee.overtimeHours || 0).toFixed(2)} hrs
                          </td>
                          <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                            {formatCurrency(employee.regularRate || 0)}/hr
                          </td>
                          <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                            {formatCurrency(employee.overtimePremium || 0)}
                          </td>
                        </>
                      )}
                      <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                        {formatCurrency(minPayRequired)}
                      </td>
                      <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                        {formatCurrency(diffOwed)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No employee details available for this date range.
          </div>
        )}

        {/* Task Legend */}
        {uniqueTasks.length > 0 && (
          <div className="mt-8 pt-4 border-t">
            <h3 className="font-bold mb-2 text-lg">Task Legend:</h3>
            <div className="text-sm grid grid-cols-2 gap-1">
              {uniqueTasks.map((taskName, idx) => {
                const label = String.fromCharCode(65 + idx);
                return (
                  <p key={taskName} className="text-xs">
                    <strong>PIECE {label}</strong> = {taskName}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
