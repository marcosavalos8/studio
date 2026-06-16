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
import { useCompanyInfo } from "@/hooks/use-company-info";

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
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  if (n < 20) return ones[n] ?? String(n);
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o > 0 ? `${tens[t]}-${ones[o]}` : (tens[t] ?? String(n));
};

export function InvoiceReportDisplay({
  report,
  onBack,
  laborReport,
  onSave,
  isSaving,
  isSaved,
}: ReportDisplayProps) {
  const { companyInfo } = useCompanyInfo();
  const handlePrint = () => {
    window.print();
  };

  const sortedDates = Object.keys(report.dailyBreakdown).sort(
    (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime(),
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
    [...sortedDates]
      .reverse()
      .find((date) =>
        Object.values(report.dailyBreakdown[date].tasks).some(
          (task) => task.clientRateType === "piece",
        ),
      ) ??
    sortedDates[sortedDates.length - 1] ??
    "";

  // Compute adjustment rows: P/W BREAK, OT Premium, MW
  const otHours = report.overtimeHours ?? 0;
  const otPremium = report.overtimePremium ?? 0;
  const otPrice = otHours > 0 ? otPremium / otHours : 0;

  const mwTopUp = report.minimumWageTopUp;
  const numWorkersMW = (report.employeeDetails ?? []).filter(
    (e) => e.minimumWageTopUp > 0,
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
      subtotalByUnit.set(row.unit, {
        quantity: row.quantity,
        total: row.total,
      });
    }
  });

  // Merge P/W BREAK hours into the Hrs row of the subtotal (only if > 0)
  if (report.paidRestBreaks > 0) {
    const existingHrs = subtotalByUnit.get("Hrs");
    if (existingHrs) {
      existingHrs.quantity += breakQuantity;
      existingHrs.total += report.paidRestBreaks;
    } else {
      subtotalByUnit.set("Hrs", {
        quantity: breakQuantity,
        total: report.paidRestBreaks,
      });
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

      {/* print-root wraps ALL printable pages so the visibility trick works correctly
          across multiple pages. Individual pages inside use normal flow + page-break. */}
      <div className="print-root">
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
            .print-root,
            .print-root * {
              visibility: visible;
            }
            .print-root {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
              color: #000;
              font-size: 10px;
            }
            .print-page {
              width: 100%;
              padding: 16px;
              box-sizing: border-box;
            }
            .print-page + .print-page {
              page-break-before: always;
            }
            .print\\:hidden {
              display: none;
            }
          }
          @page {
            size: auto;
            margin: 0.4in;
          }
          @page labor-report-page {
            size: landscape;
            margin: 0.3in;
          }
          @media print {
            .labor-report-section {
              page: labor-report-page;
              font-size: 8px;
            }
            .labor-report-section table {
              font-size: 7px;
            }
            .labor-report-section table th,
            .labor-report-section table td {
              padding: 2px 4px !important;
              border: 1px solid #000 !important;
            }
          }
        `}</style>

        <div
          className="print-page report-container bg-white text-black rounded-lg border shadow-sm"
          style={{ padding: "24px" }}
        >
          {/* ── TOP HEADER: Title row + Logo below + Company info ── */}
          {/* Row 1: INVOICE title (left) + Company address (right) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            {/* Left: INVOICE label + company name, with logo below */}
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    letterSpacing: "2px",
                    color: "#15803d",
                  }}
                >
                  INVOICE
                </span>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "#15803d",
                  }}
                >
                  | {companyInfo.companyName}
                </span>
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
              {companyInfo.address.split(",").map((part, i) => (
                <div key={i}>{part.trim()}{i === 0 ? "" : "."}</div>
              ))}
              <div>PH #: {companyInfo.phone}</div>
              <div>e-mail: {companyInfo.email}</div>
              <div>EIN #: {companyInfo.ein} &nbsp; UBI #: {companyInfo.ubi}</div>
            </div>
          </div>

          {/* ── DIVIDER ── */}
          <hr style={{ borderTop: "4px solid #15803d", margin: "8px 0" }} />

          {/* ── BILL TO + INVOICE INFO ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "12px",
              fontSize: "12px",
            }}
          >
            {/* Left: Bill To */}
            <div>
              <table style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingRight: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Bill to:
                    </td>
                    <td>{report.client.name}</td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingRight: "8px",
                        verticalAlign: "top",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Address:
                    </td>
                    <td>{report.client.billingAddress}</td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingRight: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      e-mail:
                    </td>
                    <td>{report.client.email ?? ""}</td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingRight: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Phone:
                    </td>
                    <td>{report.client.phone ?? ""}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* Right: Invoice meta */}
            <div style={{ textAlign: "right" }}>
              <table style={{ borderCollapse: "collapse", marginLeft: "auto" }}>
                <tbody>
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingRight: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Invoice #:
                    </td>
                    <td style={{ fontWeight: "bold" }}>
                      {report.invoiceNumber}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingRight: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Invoice Date:
                    </td>
                    <td>{report.invoiceDate}</td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingRight: "8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Terms:
                    </td>
                    <td>{report.client.paymentTerms}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── MAIN LABOR TABLE ── */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12px",
              marginBottom: "16px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                <th
                  style={{
                    border: "1px solid #d1d5db",
                    padding: "4px 8px",
                    textAlign: "left",
                  }}
                >
                  DATE
                </th>
                <th
                  style={{
                    border: "1px solid #d1d5db",
                    padding: "4px 8px",
                    textAlign: "left",
                  }}
                >
                  DESCRIPTION
                </th>
                <th
                  style={{
                    border: "1px solid #d1d5db",
                    padding: "4px 8px",
                    textAlign: "right",
                  }}
                >
                  QUANTITY
                </th>
                <th
                  style={{
                    border: "1px solid #d1d5db",
                    padding: "4px 8px",
                    textAlign: "center",
                  }}
                >
                  UNIT
                </th>
                <th
                  style={{
                    border: "1px solid #d1d5db",
                    padding: "4px 8px",
                    textAlign: "right",
                  }}
                >
                  PRICE
                </th>
                <th
                  style={{
                    border: "1px solid #d1d5db",
                    padding: "4px 8px",
                    textAlign: "right",
                  }}
                >
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => (
                <tr
                  key={idx}
                  style={{
                    backgroundColor: idx % 2 === 0 ? "#fff" : "#f9fafb",
                  }}
                >
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "4px 8px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.date
                      ? format(parseLocalDate(row.date), "MM/dd/yyyy")
                      : "-"}
                  </td>
                  <td
                    style={{ border: "1px solid #e5e7eb", padding: "4px 8px" }}
                  >
                    {row.description}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "4px 8px",
                      textAlign: "right",
                    }}
                  >
                    {formatNumber(row.quantity)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "4px 8px",
                      textAlign: "center",
                    }}
                  >
                    {row.unit}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "4px 8px",
                      textAlign: "right",
                    }}
                  >
                    ${row.price.toFixed(4)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e5e7eb",
                      padding: "4px 8px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── LABOR SUBTOTAL + TOTALS SIDE BY SIDE ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              fontSize: "12px",
              alignItems: "start",
            }}
          >
            {/* Left: Labor Subtotal */}
            <div>
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                Labor Subtotal
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <th
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 8px",
                        textAlign: "right",
                      }}
                    >
                      QUANTITY
                    </th>
                    <th
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 8px",
                        textAlign: "center",
                      }}
                    >
                      UNIT
                    </th>
                    <th
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 8px",
                        textAlign: "right",
                      }}
                    >
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subtotalRows.map((row, idx) => (
                    <tr key={idx}>
                      <td
                        style={{
                          border: "1px solid #e5e7eb",
                          padding: "4px 8px",
                          textAlign: "right",
                        }}
                      >
                        {formatNumber(row.quantity)}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e5e7eb",
                          padding: "4px 8px",
                          textAlign: "center",
                        }}
                      >
                        {row.unit}
                      </td>
                      <td
                        style={{
                          border: "1px solid #e5e7eb",
                          padding: "4px 8px",
                          textAlign: "right",
                        }}
                      >
                        {formatCurrency(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <td
                      colSpan={2}
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 8px",
                        fontWeight: "bold",
                      }}
                    >
                      Invoice Subtotal
                    </td>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "4px 8px",
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      {formatCurrency(invoiceSubtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Right: Invoice summary — vertically aligned with the Labor Subtotal table body */}
            <div>
              {/* Spacer matching the "Labor Subtotal" label + table header row height on the left */}
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "4px",
                  visibility: "hidden",
                }}
              >
                Labor Subtotal
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ visibility: "hidden" }}>
                    <th style={{ padding: "4px 8px" }}>&nbsp;</th>
                    <th style={{ padding: "4px 8px" }}>&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: "6px 12px",
                        fontWeight: "bold",
                      }}
                    >
                      Invoice Subtotal
                    </td>
                    <td
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: "6px 12px",
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(invoiceSubtotal)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: "6px 12px",
                      }}
                    >
                      Contractors Fee
                      {report.client.commissionRate
                        ? ` (${report.client.commissionRate}%)`
                        : ""}
                    </td>
                    <td
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: "6px 12px",
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(contractorsFee)}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: "6px 12px",
                      }}
                    >
                      Total Field Charges
                    </td>
                    <td
                      style={{
                        border: "1px solid #e5e7eb",
                        padding: "6px 12px",
                        textAlign: "right",
                      }}
                    >
                      {formatCurrency(invoiceTotal)}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: "#f3f4f6" }}>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "6px 12px",
                        fontWeight: "bold",
                        fontSize: "14px",
                      }}
                    >
                      Invoice Total
                    </td>
                    <td
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "6px 12px",
                        textAlign: "right",
                        fontWeight: "bold",
                        fontSize: "14px",
                      }}
                    >
                      {formatCurrency(invoiceTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div
            style={{
              marginTop: "24px",
              fontSize: "11px",
              color: "#374151",
              borderTop: "1px solid #d1d5db",
              paddingTop: "12px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 4px 0" }}>
              Make all checks payable to{" "}
              <strong>J&amp;M Agricultural Labor LLC</strong>
            </p>
            <p style={{ margin: "0 0 4px 0" }}>
              Any unpaid invoices after {paymentDays} days will incur additional
              fees
            </p>
            <p style={{ margin: "0", fontWeight: "bold" }}>
              THANK YOU FOR YOUR BUSINESS!
            </p>
          </div>
        </div>
        {/* end .print-page (invoice) */}

        {/* ── LABOR REPORT: second printed page ── */}
        {laborReport && <LaborReportSection report={laborReport} />}
      </div>
      {/* end .print-root */}
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
  const { companyInfo } = useCompanyInfo();
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
    report.employeeDetails?.some((emp) => (emp.overtimeHours || 0) > 0) ??
    false;

  const truncateWorkerName = (fullName: string): string => {
    if (!fullName || typeof fullName !== "string") return "";
    const nameParts = fullName
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);
    if (nameParts.length <= 2) return fullName;
    return `${nameParts[0]} ${nameParts[1]}`;
  };

  return (
    <div
      className="print-page labor-report-section bg-white text-black p-8 rounded-lg border shadow-sm"
      style={{ marginTop: "24px" }}
    >
      {/* Header con logo */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                textAlign: "left",
                marginBottom: "4px",
                color: "#15803d",
              }}
            >
              Labor Report | {companyInfo.companyName}
            </h1>
          </div>
          <div className="flex-shrink-0">
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
              <strong>
                $ {(report.client.minimumWage || 19.82).toFixed(2)} :Min Wage
              </strong>
            </p>
          </div>
          <div>
            <p>
              <strong>EIN#</strong> {companyInfo.ein}
            </p>
            <p>
              <strong>UBI#</strong> {companyInfo.ubi}
            </p>
          </div>
          <div>
            <p>
              <strong>LIC#172-25</strong>
            </p>
          </div>
        </div>
        {/* Green bottom border after company info */}
        <div className="border-b-2 border-green-700 mt-2"></div>
      </div>

      {hasEmployeeDetails ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs mt-4">
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
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-1 py-1 text-center font-bold bg-green-100 text-black">
                        Piece {label}
                      </th>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-1 py-1 text-center font-bold bg-green-100 text-black">
                        Rate {label}
                      </th>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-1 py-1 text-center font-bold bg-green-100 text-black">
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
                  Diff Owed/Break
                </th>
                <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                  PAY REQ
                </th>
              </tr>
            </thead>
            <tbody>
              {report.employeeDetails?.map((employee, rowIndex) => {
                const taskMap = new Map(
                  employee.tasksSummary.map((task) => [task.taskName, task]),
                );
                const totalPiecesPay = employee.tasksSummary.reduce(
                  (sum, task) => sum + task.cost,
                  0,
                );
                const diffOwed =
                  employee.paidRestBreaks +
                  employee.minimumWageTopUp +
                  (employee.overtimePremium || 0);
                const minPayRequired = totalPiecesPay + diffOwed;
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
                      {formatCurr(totalPiecesPay)}
                    </td>
                    {hasOvertimeData && (
                      <>
                        <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                          {(employee.overtimeHours || 0).toFixed(2)} hrs
                        </td>
                        <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                          {formatCurr(employee.regularRate || 0)}/hr
                        </td>
                        <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                          {formatCurr(employee.overtimePremium || 0)}
                        </td>
                      </>
                    )}
                    <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                      {formatCurr(diffOwed)}
                    </td>
                    <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center font-bold">
                      {formatCurr(minPayRequired)}
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

      {/* Task Legend and Total Base Labor Cost */}
      {uniqueTasks.length > 0 && (
        <div className="mt-8 pt-4 border-t">
          <div className="grid grid-cols-2 gap-8 items-start">
            {/* Task Legend Section */}
            <div>
              <h3 className="font-bold mb-2 text-[12px]">Task Legend:</h3>
              <div className="text-sm space-y-1">
                {uniqueTasks.map((taskName, idx) => {
                  const label = String.fromCharCode(65 + idx);
                  return (
                    <p key={taskName} className="text-[10px]">
                      <strong>PIECE {label}</strong> = {taskName}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* Total Base Labor Cost Section */}
            <div>
              <h3 className="font-bold mb-2 text-[12px]">
                Total Base Labor Cost
              </h3>
              <div className="text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-left font-bold bg-green-100 text-black">
                        Pieces
                      </th>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                        Total Pieces
                      </th>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                        Rate
                      </th>
                      <th className="border-l-2 border-r-2 border-green-700 border-t-0 border-b border-black px-2 py-1 text-center font-bold bg-green-100 text-black">
                        Total Pay
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniqueTasks.map((taskName, idx) => {
                      const label = String.fromCharCode(65 + idx);
                      const { totalPieces, rate, totalPay } = calcTaskTotals(
                        taskName,
                        report.employeeDetails,
                      );
                      return (
                        <tr key={taskName}>
                          <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1">
                            Piece {label}
                          </td>
                          <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center">
                            {totalPieces.toFixed(2)}
                          </td>
                          <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center">
                            {formatCurr(rate)}
                          </td>
                          <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center">
                            {formatCurr(totalPay)}
                          </td>
                        </tr>
                      );
                    })}
                    {(report.paidRestBreaks ?? 0) > 0 && (
                      <tr>
                        <td
                          className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1"
                          colSpan={3}
                        >
                          Paid Rest Breaks
                        </td>
                        <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center">
                          {formatCurr(report.paidRestBreaks)}
                        </td>
                      </tr>
                    )}
                    {(report.overtimePremium ?? 0) > 0 && (
                      <tr>
                        <td
                          className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1"
                          colSpan={3}
                        >
                          Overtime Premium (0.5x rate)
                        </td>
                        <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center">
                          {formatCurr(report.overtimePremium)}
                        </td>
                      </tr>
                    )}
                    {(report.minimumWageTopUp ?? 0) > 0 && (
                      <tr>
                        <td
                          className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1"
                          colSpan={3}
                        >
                          Minimum Wage Adjustments
                        </td>
                        <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center">
                          {formatCurr(report.minimumWageTopUp)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t font-bold">
                      <td
                        className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1"
                        colSpan={3}
                      >
                        Total Amount:
                      </td>
                      <td className="border-l-2 border-r-2 border-l-green-700 border-r-green-700 px-2 py-1 text-center">
                        {formatCurr(report.subtotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
