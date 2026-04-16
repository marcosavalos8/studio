"use client";

import React from "react";
import { type DetailedInvoiceData } from "./page";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import logo from "../../../components/images/logo.jpeg";
import Image from "next/image";

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

  const adjustmentRows: TableRow[] = [
    {
      date: "",
      description: "Piecework-P/W BREAK",
      quantity: breakQuantity,
      unit: "Hrs",
      price: breakPrice,
      total: report.paidRestBreaks,
    },
    {
      date: "",
      description: "Piecework-OT Premium (0.5x rate)",
      quantity: otHours,
      unit: "OT Hrs",
      price: otPrice,
      total: otPremium,
    },
    {
      date: "",
      description: "Piecework-MW",
      quantity: mwQuantity,
      unit: "MW",
      price: mwPrice,
      total: mwTopUp,
    },
  ];

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

  // Add adjustment subtotals explicitly
  subtotalByUnit.set("P/W BREAK", { quantity: breakQuantity, total: report.paidRestBreaks });
  subtotalByUnit.set("OT Hrs", { quantity: otHours, total: otPremium });
  subtotalByUnit.set("MW", { quantity: mwQuantity, total: mwTopUp });

  // Ordered display: Hrs, Pcs, P/W BREAK, OT Hrs, MW
  const unitOrder = ["Hrs", "Pcs", "P/W BREAK", "OT Hrs", "MW"];
  const subtotalRows = unitOrder.map((unit) => ({
    unit,
    ...(subtotalByUnit.get(unit) ?? { quantity: 0, total: 0 }),
  }));

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
          Generate New Invoice
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
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
            <div>Telf.: 509-000-1111</div>
            <div>e-mail: jmagriculturalabor@gmail.com</div>
            <div>Acct #: XXX-295 &nbsp; Lic #: 172-25</div>
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
            <strong style={{ color: "#dc2626" }}>2%</strong>{" "}
            per month.
            This interest shall be calculated on a per-diem (daily) basis starting from the first day
            following the Due Date (Day <strong>{paymentDays + 1}</strong>) until the payment is received in full by the Contractor.&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
