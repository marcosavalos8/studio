"use client";

import React from "react";
import { type DetailedInvoiceData } from "./page";
import { type DetailedLabelReportData } from "../labor-report/page";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Save, CheckCircle2, Loader2 } from "lucide-react";
import logo from "../../../components/images/logo.jpeg";
import Image from "next/image";

interface ReportDisplayProps {
  report: DetailedInvoiceData;
  onBack: () => void;
  laborReport?: DetailedLabelReportData | null;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
  isSaved?: boolean;
}

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) {
    return "$0.00";
  }
  return `$${value.toFixed(2)}`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const numberToWords = (n: number): string => {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
    "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety"];
  if (n < 20) return ones[n] ?? String(n);
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o > 0 ? `${tens[t]}-${ones[o]}` : tens[t] ?? String(n);
};

export function InvoiceReportDisplay({
  report,
  onBack,
  laborReport,
  onSave,
  isSaving,
  isSaved,
}: ReportDisplayProps) {
  const handlePrint = () => {
    window.print();
  };

  const sortedDates = Object.keys(report.dailyBreakdown).sort(
    (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
  );

  // Build flat table rows: one row per task per date
  type TableRow = {
    date: string;
    description: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
  };

  const regularRows: TableRow[] = [];
  sortedDates.forEach((date) => {
    Object.values(report.dailyBreakdown[date].tasks).forEach((task) => {
      const isHourly = task.clientRateType === "hourly";
      const quantity = isHourly ? task.hours : task.pieces;
      const unit = isHourly ? "Hrs" : "Pcs";
      regularRows.push({
        date,
        description: task.taskName,
        quantity,
        unit,
        price: task.clientRate,
        total: task.cost,
      });
    });
  });

  // Find unique piecework task names for adjustment row description prefix
  const pieceworkTaskNames = new Set<string>();
  sortedDates.forEach((date) => {
    Object.values(report.dailyBreakdown[date].tasks).forEach((task) => {
      if (task.clientRateType === "piece") {
        pieceworkTaskNames.add(task.taskName);
      }
    });
  });
  const pieceworkPrefix =
    pieceworkTaskNames.size === 1
      ? `${Array.from(pieceworkTaskNames)[0]}-`
      : "Piecework-";

  // Last date that has at least one piecework task (used as the date for adjustment rows)
  const lastPieceworkDate =
    [...sortedDates].reverse().find((date) =>
      Object.values(report.dailyBreakdown[date].tasks).some(
        (task) => task.clientRateType === "piece"
      )
    ) ?? sortedDates[sortedDates.length - 1] ?? "";

  // Compute adjustment rows: P/W BREAK, OT Premium, MW
  const otHours = report.overtimeHours ?? 0;
  const otPremium = report.overtimePremium ?? 0;
  const otPrice = otHours > 0 ? otPremium / otHours : 0;

  const mwTopUp = report.minimumWageTopUp;
  const numWorkersMW = (report.employeeDetails ?? []).filter(
    (e) => e.minimumWageTopUp > 0
  ).length;
  const mwQuantity = numWorkersMW;
  const mwPrice = mwQuantity > 0 ? mwTopUp / mwQuantity : 0;

  const totalPieceworkHours = sortedDates.reduce((sum, date) => {
    return (
      sum +
      Object.values(report.dailyBreakdown[date].tasks)
        .filter((task) => task.clientRateType === "piece")
        .reduce((s, task) => s + task.hours, 0)
    );
  }, 0);
  const breakQuantity = totalPieceworkHours * 0.0417;
  const breakPrice =
    breakQuantity > 0 ? report.paidRestBreaks / breakQuantity : 0;

  // Only include adjustment rows where the total is > 0
  const allAdjustmentRows: TableRow[] = [
    {
      date: lastPieceworkDate,
      description: `${pieceworkPrefix}P/W BREAK`,
      quantity: breakQuantity,
      unit: "Hrs",
      price: breakPrice,
      total: report.paidRestBreaks,
    },
    {
      date: lastPieceworkDate,
      description: `${pieceworkPrefix}OT Premium (0.5x rate)`,
      quantity: otHours,
      unit: "OT Hrs",
      price: otPrice,
      total: otPremium,
    },
    {
      date: lastPieceworkDate,
      description: `${pieceworkPrefix}MW`,
      quantity: mwQuantity,
      unit: "MW",
      price: mwPrice,
      total: mwTopUp,
    },
  ];
  const adjustmentRows = allAdjustmentRows.filter((r) => r.total > 0);

  const tableRows = [...regularRows, ...adjustmentRows];

  // Labor Subtotal: aggregate by unit from regular rows only
  const subtotalByUnit = new Map<string, { quantity: number; total: number }>();
  regularRows.forEach((row) => {
    const existing = subtotalByUnit.get(row.unit);
    if (existing) {
      existing.quantity += row.quantity;
      existing.total += row.total;
    } else {
      subtotalByUnit.set(row.unit, { quantity: row.quantity, total: row.total });
    }
  });

  // Merge P/W BREAK hours into the Hrs row of the subtotal (only if > 0)
  if (report.paidRestBreaks > 0) {
    const existingHrs = subtotalByUnit.get("Hrs");
    if (existingHrs) {
      existingHrs.quantity += breakQuantity;
      existingHrs.total += report.paidRestBreaks;
    } else {
      subtotalByUnit.set("Hrs", { quantity: breakQuantity, total: report.paidRestBreaks });
    }
  }

  // Add OT Hrs and MW adjustment subtotals (only if > 0)
  if (otPremium > 0) {
    subtotalByUnit.set("OT Hrs", { quantity: otHours, total: otPremium });
  }
  if (mwTopUp > 0) {
    subtotalByUnit.set("MW", { quantity: mwQuantity, total: mwTopUp });
  }

  // Ordered display: Hrs (includes break), Pcs, OT Hrs, MW — skip rows with zero total
  const unitOrder = ["Hrs", "Pcs", "OT Hrs", "MW"];
  const subtotalRows = unitOrder
    .map((unit) => ({
      unit,
      ...(subtotalByUnit.get(unit) ?? { quantity: 0, total: 0 }),
    }))
    .filter((r) => r.total > 0);

  const invoiceSubtotal = subtotalRows.reduce((sum, row) => sum + row.total, 0);
  const contractorsFee = report.commission;
  const invoiceTotal = report.total;

  // Parse payment terms days for footer (e.g. "Net 30" → 30, "Net 45" → 45)
  const paymentDays = (() => {
    const match = report.client.paymentTerms?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 30;
  })();

  return (
    <div>
      <div className="mb-4 flex justify-between items-center print:hidden">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isSaved ? "Generate New Invoice" : "Back / Discard"}
        </Button>
        <div className="flex items-center gap-2">
          {onSave && (
            <Button
              onClick={onSave}
              disabled={isSaving || isSaved}
              variant={isSaved ? "secondary" : "default"}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isSaved ? (
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaved ? "Record Created" : "Create Record"}
            </Button>
          )}
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="report-container bg-white text-black rounded-lg border shadow-sm" style={{ padding: "24px" }}>
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
              padding: 16px;
              color: #000;
              font-size: 10px;
            }
            .print\\:hidden {
              display: none;
            }
          }
          @page {
            size: auto;
            margin: 0.4in;
          }
        `}</style>

        {/* ── TOP HEADER: Title row + Logo below + Company info ── */}
        {/* Row 1: INVOICE title (left) + Company address (right) */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px" }}>
          {/* Left: INVOICE label + company name, with logo below */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <span style={{ fontSize: "20px", fontWeight: "bold", letterSpacing: "2px", color: "#15803d" }}>INVOICE</span>
              <span style={{ fontSize: "16px", fontWeight: "bold", color: "#15803d" }}>| J&amp;M AGRICULTURAL LABOR LLC</span>
            </div>
            <Image
              src={logo}
              alt="JM AGRI Logo"
              width={80}
              height={80}
              style={{ objectFit: "contain" }}
            />
          </div>
          {/* Right: Company address + contact */}
          <div style={{ textAlign: "right", fontSize: "12px" }}>
            <div>250 Country Heaven Loop</div>
            <div>Pasco, WA 99301.</div>
            <div>Telf.: 509.380.3385</div>
            <div>e-mail: Jmagriculturalabor@outlook.com</div>
            <div>EIN #: 33-2236422 &nbsp; UBI #: 605 650 411</div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <hr style={{ borderTop: "4px solid #15803d", margin: "8px 0" }} />

        {/* ── BILL TO + INVOICE INFO ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px", fontSize: "12px" }}>
          {/* Left: Bill To */}
          <div>
            <table style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", paddingRight: "8px", whiteSpace: "nowrap" }}>Bill to:</td>
                  <td style={{ fontWeight: "bold" }}>{report.client.name}</td>
                  <td style={{ paddingLeft: "16px", whiteSpace: "nowrap", fontWeight: "bold" }}>Phone:</td>
                  <td>{report.client.phone ?? ""}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingRight: "8px", verticalAlign: "top", whiteSpace: "nowrap" }}>Address:</td>
                  <td colSpan={3}>{report.client.billingAddress}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingRight: "8px", whiteSpace: "nowrap" }}>e-mail:</td>
                  <td colSpan={3}>{report.client.email ?? ""}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Right: Invoice meta */}
          <div style={{ textAlign: "right" }}>
            <table style={{ borderCollapse: "collapse", marginLeft: "auto" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", paddingRight: "8px", whiteSpace: "nowrap" }}>Invoice #:</td>
                  <td style={{ fontWeight: "bold" }}>{report.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingRight: "8px", whiteSpace: "nowrap" }}>Invoice Date:</td>
                  <td>{report.invoiceDate}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingRight: "8px", whiteSpace: "nowrap" }}>Terms:</td>
                  <td>{report.client.paymentTerms}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── MAIN LABOR TABLE ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "16px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6" }}>
              <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "left" }}>DATE</th>
              <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "left" }}>DESCRIPTION</th>
              <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right" }}>QUANTITY</th>
              <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "center" }}>UNIT</th>
              <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right" }}>PRICE</th>
              <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right" }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px", whiteSpace: "nowrap" }}>
                  {row.date ? format(parseLocalDate(row.date), "MM/dd/yyyy") : "-"}
                </td>
                <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px" }}>{row.description}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px", textAlign: "right" }}>
                  {formatNumber(row.quantity)}
                </td>
                <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px", textAlign: "center" }}>{row.unit}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px", textAlign: "right" }}>
                  ${row.price.toFixed(4)}
                </td>
                <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px", textAlign: "right" }}>
                  {formatCurrency(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── LABOR SUBTOTAL + TOTALS SIDE BY SIDE ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", fontSize: "12px", alignItems: "start" }}>
          {/* Left: Labor Subtotal */}
          <div>
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Labor Subtotal</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6" }}>
                  <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right" }}>QUANTITY</th>
                  <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "center" }}>UNIT</th>
                  <th style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right" }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {subtotalRows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px", textAlign: "right" }}>
                      {formatNumber(row.quantity)}
                    </td>
                    <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px", textAlign: "center" }}>{row.unit}</td>
                    <td style={{ border: "1px solid #e5e7eb", padding: "4px 8px", textAlign: "right" }}>
                      {formatCurrency(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: "#f3f4f6" }}>
                  <td colSpan={2} style={{ border: "1px solid #d1d5db", padding: "4px 8px", fontWeight: "bold" }}>
                    Invoice Subtotal
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>
                    {formatCurrency(invoiceSubtotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Right: Invoice summary — vertically aligned with the Labor Subtotal table body */}
          <div>
            {/* Spacer matching the "Labor Subtotal" label + table header row height on the left */}
            <div style={{ fontWeight: "bold", marginBottom: "4px", visibility: "hidden" }}>Labor Subtotal</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ visibility: "hidden" }}>
                  <th style={{ padding: "4px 8px" }}>&nbsp;</th>
                  <th style={{ padding: "4px 8px" }}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #e5e7eb", padding: "6px 12px", fontWeight: "bold" }}>Invoice Subtotal</td>
                  <td style={{ border: "1px solid #e5e7eb", padding: "6px 12px", textAlign: "right" }}>
                    {formatCurrency(invoiceSubtotal)}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #e5e7eb", padding: "6px 12px" }}>
                    Contractors Fee
                    {report.client.commissionRate ? ` (${report.client.commissionRate}%)` : ""}
                  </td>
                  <td style={{ border: "1px solid #e5e7eb", padding: "6px 12px", textAlign: "right" }}>
                    {formatCurrency(contractorsFee)}
                  </td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #e5e7eb", padding: "6px 12px" }}>Total Field Charges</td>
                  <td style={{ border: "1px solid #e5e7eb", padding: "6px 12px", textAlign: "right" }}>
                    {formatCurrency(invoiceTotal)}
                  </td>
                </tr>
                <tr style={{ backgroundColor: "#f3f4f6" }}>
                  <td style={{ border: "1px solid #d1d5db", padding: "6px 12px", fontWeight: "bold", fontSize: "14px" }}>
                    Invoice Total
                  </td>
                  <td style={{ border: "1px solid #d1d5db", padding: "6px 12px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>
                    {formatCurrency(invoiceTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FOOTER: Payment terms legal text ── */}
        <div style={{ marginTop: "24px", fontSize: "11px", color: "#374151", borderTop: "1px solid #d1d5db", paddingTop: "12px" }}>
          <p>
            &quot;All invoices are due and payable within{" "}
            <strong>{numberToWords(paymentDays)} ({paymentDays})</strong>{" "}
            calendar days from the invoice date.
            Any balance unpaid after the{" "}
            <strong>{paymentDays}-day</strong>{" "}
            period will accrue interest at a rate of{" "}
            <strong style={{ color: "#dc2626" }}>1%</strong>{" "}
            per month.
            This interest shall be calculated on a per-diem (daily) basis starting from the first day
            following the Due Date (Day <strong>{paymentDays + 1}</strong>) until the payment is received in full by the Contractor.&quot;
          </p>
        </div>
      </div>

      {/* ── LABOR REPORT (separate page when printing) ── */}
      {laborReport && <LaborReportSection report={laborReport} />}
    </div>
  );
}

// ── Helper: calculate task totals across all employees ──────────────────────
function calcTaskTotals(
  taskName: string,
  employeeDetails?: DetailedLabelReportData["employeeDetails"],
): { totalPieces: number; rate: number; totalPay: number } {
  let totalPieces = 0;
  let rate: number | undefined = undefined;
  let totalPay = 0;
  if (employeeDetails) {
    employeeDetails.forEach((emp) => {
      const task = emp.tasksSummary.find((t) => t.taskName === taskName);
      if (task) {
        totalPieces += task.quantity;
        if (rate === undefined) rate = task.rate;
        totalPay += task.cost;
      }
    });
  }
  return { totalPieces, rate: rate ?? 0, totalPay };
}

// ── Inline Labor Report Section ──────────────────────────────────────────────
function LaborReportSection({ report }: { report: DetailedLabelReportData }) {
  const formatCurr = (v: number | undefined | null) =>
    v === undefined || v === null || isNaN(v) ? "$0.00" : `$${v.toFixed(2)}`;

  const sortedDates = Object.keys(report.dailyBreakdown).sort(
    (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime(),
  );

  const formatDateRange = () => {
    if (sortedDates.length === 0) return "";
    const first = parseLocalDate(sortedDates[0]);
    const last = parseLocalDate(sortedDates[sortedDates.length - 1]);
    if (sortedDates.length === 1) return format(first, "EEEE, LLL dd, yyyy");
    const sm = format(first, "LLL");
    const em = format(last, "LLL");
    if (sm === em) {
      return `${format(first, "EEEE")} - ${format(last, "EEEE")}, ${sm} ${format(first, "dd")}-${format(last, "dd")}, ${format(last, "yyyy")}`;
    }
    return `${format(first, "EEEE")}, ${sm} ${format(first, "dd")} - ${format(last, "EEEE")}, ${em} ${format(last, "dd")}, ${format(last, "yyyy")}`;
  };

  const hasEmployeeDetails =
    report.employeeDetails && report.employeeDetails.length > 0;

  const allTaskNames = new Set<string>();
  if (hasEmployeeDetails && report.employeeDetails) {
    report.employeeDetails.forEach((emp) => {
      emp.tasksSummary.forEach((task) => allTaskNames.add(task.taskName));
    });
  }
  const uniqueTasks = Array.from(allTaskNames);

  const hasOvertimeData =
    report.employeeDetails?.some((emp) => (emp.overtimeHours || 0) > 0) ?? false;

  const thStyle: React.CSSProperties = {
    border: "1px solid #16a34a",
    borderBottom: "1px solid #000",
    padding: "4px 6px",
    textAlign: "center",
    fontWeight: "bold",
    backgroundColor: "#dcfce7",
    color: "#000",
    fontSize: "9px",
  };
  const tdStyle: React.CSSProperties = {
    borderLeft: "1px solid #16a34a",
    borderRight: "1px solid #16a34a",
    padding: "3px 6px",
    textAlign: "center",
    fontSize: "9px",
  };

  return (
    <div
      className="report-container bg-white text-black"
      style={{ pageBreakBefore: "always", padding: "24px", marginTop: "0" }}
    >
      {/* Header */}
      <div style={{ marginBottom: "16px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#15803d", marginBottom: "4px" }}>
            Labor Report | J&amp;M Agricultural Labor LLC
          </h1>
          <img src="/logo.jpeg" alt="JM AGRI Logo" style={{ width: "80px", height: "64px", objectFit: "contain" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "11px", marginTop: "8px" }}>
          <div>
            <p><strong>{formatDateRange()}</strong></p>
            <p><strong>$ {(report.client.minimumWage || 19.82).toFixed(2)} :Min Wage</strong></p>
          </div>
          <div>
            <p><strong>EIN#</strong> 33-2236422</p>
            <p><strong>UBI#</strong> 605 650 411</p>
          </div>
          <div>
            <p><strong>LIC#172-25</strong></p>
          </div>
        </div>
        <div style={{ borderBottom: "4px solid #15803d", marginTop: "8px" }} />
      </div>

      {/* Employee table */}
      {hasEmployeeDetails ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Worker Name</th>
                <th style={thStyle}>Hours</th>
                {uniqueTasks.map((taskName, idx) => {
                  const label = String.fromCharCode(65 + idx);
                  return (
                    <React.Fragment key={taskName}>
                      <th style={thStyle}>Piece {label}</th>
                      <th style={thStyle}>Rate {label}</th>
                      <th style={thStyle}>Piece Pay {label}</th>
                    </React.Fragment>
                  );
                })}
                <th style={thStyle}>Total Pieces Pay</th>
                {hasOvertimeData && (
                  <>
                    <th style={thStyle}>OT Hours</th>
                    <th style={thStyle}>Regular Rate</th>
                    <th style={thStyle}>OT Premium</th>
                  </>
                )}
                <th style={thStyle}>Diff Owed/Break</th>
                <th style={thStyle}>PAY REQ</th>
              </tr>
            </thead>
            <tbody>
              {report.employeeDetails?.map((employee, rowIndex) => {
                const taskMap = new Map(
                  employee.tasksSummary.map((task) => [task.taskName, task]),
                );
                const totalPiecesPay = employee.tasksSummary.reduce(
                  (sum, task) => sum + task.cost, 0
                );
                const diffOwed =
                  employee.paidRestBreaks +
                  employee.minimumWageTopUp +
                  (employee.overtimePremium || 0);
                const minPayRequired = totalPiecesPay + diffOwed;
                const rowBg = rowIndex % 2 === 0 ? "#fff" : "#f9fafb";
                return (
                  <tr key={employee.employeeId} style={{ backgroundColor: rowBg }}>
                    <td style={{ ...tdStyle, textAlign: "left", fontWeight: "500" }}>
                      {employee.employeeName}
                    </td>
                    <td style={tdStyle}>{employee.totalHours.toFixed(2)}</td>
                    {uniqueTasks.map((taskName) => {
                      const task = taskMap.get(taskName);
                      return (
                        <React.Fragment key={taskName}>
                          <td style={tdStyle}>{task ? task.quantity.toFixed(2) : "0.00"}</td>
                          <td style={tdStyle}>$ {task ? task.rate.toFixed(2) : "0.00"}</td>
                          <td style={tdStyle}>$ {task ? task.cost.toFixed(2) : "0.00"}</td>
                        </React.Fragment>
                      );
                    })}
                    <td style={{ ...tdStyle, fontWeight: "bold" }}>{formatCurr(totalPiecesPay)}</td>
                    {hasOvertimeData && (
                      <>
                        <td style={{ ...tdStyle, fontWeight: "bold" }}>
                          {(employee.overtimeHours || 0).toFixed(2)} hrs
                        </td>
                        <td style={{ ...tdStyle, fontWeight: "bold" }}>
                          {formatCurr(employee.regularRate || 0)}/hr
                        </td>
                        <td style={{ ...tdStyle, fontWeight: "bold" }}>
                          {formatCurr(employee.overtimePremium || 0)}
                        </td>
                      </>
                    )}
                    <td style={{ ...tdStyle, fontWeight: "bold" }}>{formatCurr(diffOwed)}</td>
                    <td style={{ ...tdStyle, fontWeight: "bold" }}>{formatCurr(minPayRequired)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "32px 0" }}>
          No employee details available for this date range.
        </p>
      )}

      {/* Task Legend and Total Base Labor Cost */}
      {uniqueTasks.length > 0 && (
        <div style={{ marginTop: "24px", borderTop: "1px solid #d1d5db", paddingTop: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", fontSize: "10px" }}>
          {/* Task Legend */}
          <div>
            <p style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "6px" }}>Task Legend:</p>
            {uniqueTasks.map((taskName, idx) => {
              const label = String.fromCharCode(65 + idx);
              return (
                <p key={taskName} style={{ margin: "2px 0" }}>
                  <strong>PIECE {label}</strong> = {taskName}
                </p>
              );
            })}
          </div>
          {/* Total Base Labor Cost */}
          <div>
            <p style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "6px" }}>Total Base Labor Cost</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Pieces</th>
                  <th style={thStyle}>Total Pieces</th>
                  <th style={thStyle}>Rate</th>
                  <th style={thStyle}>Total Pay</th>
                </tr>
              </thead>
              <tbody>
                {uniqueTasks.map((taskName, idx) => {
                  const label = String.fromCharCode(65 + idx);
                  const { totalPieces, rate, totalPay } = calcTaskTotals(taskName, report.employeeDetails);
                  return (
                    <tr key={taskName}>
                      <td style={tdStyle}>Piece {label}</td>
                      <td style={tdStyle}>{totalPieces.toFixed(2)}</td>
                      <td style={tdStyle}>{formatCurr(rate)}</td>
                      <td style={tdStyle}>{formatCurr(totalPay)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={3} style={tdStyle}>Paid Rest Breaks</td>
                  <td style={tdStyle}>{formatCurr(report.paidRestBreaks)}</td>
                </tr>
                <tr>
                  <td colSpan={3} style={tdStyle}>Minimum Wage Adjustments</td>
                  <td style={tdStyle}>{formatCurr(report.minimumWageTopUp)}</td>
                </tr>
                <tr style={{ fontWeight: "bold" }}>
                  <td colSpan={3} style={tdStyle}>Total Amount:</td>
                  <td style={tdStyle}>{formatCurr(report.subtotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
