import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";
import * as fs from "fs";
import * as path from "path";
import { adminFirestore } from "@/lib/firebase-admin";

interface CompanyInfo {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  ein: string;
  ubi: string;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  companyName: "J&M AGRICULTURAL LABOR LLC",
  address: "250 Country Heaven Loop, Pasco, WA 99301",
  phone: "509.380.3385",
  email: "Jmagriculturalabor@outlook.com",
  ein: "33-2236422",
  ubi: "605 650 411",
};

async function fetchCompanyInfo(): Promise<CompanyInfo> {
  try {
    const db = adminFirestore();
    if (!db) return DEFAULT_COMPANY_INFO;
    const snap = await db.collection("company_settings").doc("info").get();
    if (snap.exists) {
      return { ...DEFAULT_COMPANY_INFO, ...(snap.data() as Partial<CompanyInfo>) };
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_COMPANY_INFO;
}

// ─── interfaces ───────────────────────────────────────────────────────────────

interface InvoiceTaskDetail {
  taskName: string;
  hours: number;
  pieces: number;
  cost: number;
  clientRate: number;
  clientRateType: "hourly" | "piece";
}

interface InvoiceDayBreakdown {
  tasks: Record<string, InvoiceTaskDetail>;
  total: number;
}

interface InvoiceClientData {
  name?: string;
  billingAddress?: string;
  email?: string;
  phone?: string;
  commissionRate?: number;
  paymentTerms?: string;
}

interface LaborReportEmployeeDetail {
  employeeName: string;
  employeeId: string;
  totalHours: number;
  totalPieces: number;
  paidRestBreaks: number;
  minimumWageTopUp: number;
  overtimeHours?: number;
  overtimePremium?: number;
  regularRate?: number;
  tasksSummary: Array<{
    taskName: string;
    quantity: number;
    rate: number;
    rateType: "hourly" | "piece";
    cost: number;
  }>;
}

interface LaborReportData {
  clientName: string;
  dateFrom: string;
  dateTo: string;
  minimumWage?: number;
  paidRestBreaks: number;
  minimumWageTopUp: number;
  overtimePremium?: number;
  subtotal: number;
  commission: number;
  total: number;
  employeeDetails: LaborReportEmployeeDetail[];
}

interface SendInvoiceBody {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientEmail: string;
  dateFrom: string;
  dateTo: string;
  total: number;
  dueDate?: string;
  minimumWageTopUp?: number;
  paidRestBreaks?: number;
  overtimePremium?: number;
  overtimeHours?: number;
  subtotal?: number;
  commission?: number;
  overdueInterestAccrued?: number;
  overdueInterestDueDate?: string;
  overdueInterestCurrentDate?: string;
  dailyBreakdown?: Record<string, InvoiceDayBreakdown>;
  invoiceClientData?: InvoiceClientData;
  employeeDetails?: Array<{ minimumWageTopUp?: number }>;
  includeLaborReport?: boolean;
  laborReportData?: LaborReportData | null;
}

// ─── utility ──────────────────────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function fmtNum(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Parse "YYYY-MM-DD" as a local (not UTC) date — same as parseLocalDate in report-display */
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts;
  if (
    parts.length !== 3 ||
    !y ||
    !m ||
    !d ||
    isNaN(y) ||
    isNaN(m) ||
    isNaN(d)
  ) {
    return new Date(NaN); // Invalid date — formatDateMDY guards against this
  }
  return new Date(y, m - 1, d);
}

function formatDateMDY(dateStr: string): string {
  if (!dateStr) return "-";
  const dt = parseLocalDate(dateStr);
  return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}/${dt.getFullYear()}`;
}

/** Convert integer 0–99 to English words (used for payment terms, e.g. 10 → "ten"). */
function numberToWords(n: number): string {
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
}

/** Truncate text so its rendered width fits within maxWidth, appending "…" if cut. */
function truncateToFit(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  // Binary-search the longest prefix that still fits (including ellipsis)
  const ellipsis = "…";
  const ellipsisW = doc.getTextWidth(ellipsis);
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.getTextWidth(text.slice(0, mid)) + ellipsisW <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? text.slice(0, lo) + ellipsis : ellipsis;
}

// Renders segments of text with different font/color inline, wrapping at maxW.

type RichSegment = { text: string; bold?: boolean; red?: boolean };

function drawRichText(
  doc: jsPDF,
  segments: RichSegment[],
  x: number,
  startY: number,
  maxW: number,
  lineH: number,
  fontSize: number,
): number {
  let cx = x;
  let cy = startY;
  doc.setFontSize(fontSize);

  for (const seg of segments) {
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    if (seg.red) {
      doc.setTextColor(220, 38, 38);
    } else {
      doc.setTextColor(55, 65, 81);
    }

    // Split keeping whitespace tokens so we can detect leading-space at line start
    const tokens = seg.text.split(/(\s+)/);
    for (const token of tokens) {
      if (!token) continue;
      const tw = doc.getTextWidth(token);
      if (tw === 0) continue;
      // Wrap: if adding this token would exceed the line and we are not at the start
      if (cx > x && cx + tw > x + maxW) {
        cy += lineH;
        cx = x;
        // Skip leading whitespace at the beginning of a new line
        if (/^\s+$/.test(token)) continue;
      }
      doc.text(token, cx, cy);
      cx += tw;
    }
  }

  return cy + lineH;
}

// ─── PDF generation (exact replica of InvoiceReportDisplay) ───────────────────

function generateInvoicePdf(body: SendInvoiceBody, co: CompanyInfo = DEFAULT_COMPANY_INFO): string {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth(); // 612
  const pageH = doc.internal.pageSize.getHeight(); // 792
  const margin = 40;
  const contentW = pageW - margin * 2; // 532
  let y = margin;

  const clientData = body.invoiceClientData ?? {};

  const paymentDays = (() => {
    const match = (clientData.paymentTerms ?? "").match(/\d+/);
    return match ? parseInt(match[0], 10) : 30;
  })();

  // ── Load logo from the filesystem ───────────────────────────────────────
  let logoBase64: string | null = null;
  try {
    const logoPath = path.join(
      process.cwd(),
      "src",
      "components",
      "images",
      "logo.jpeg",
    );
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  } catch {
    // Logo not available — skip silently
  }

  // ── HEADER: "INVOICE | J&M AGRICULTURAL LABOR LLC" + logo + company addr ─

  // Right side: company address block (right-aligned)
  const addrParts = co.address.split(",").map((p) => p.trim());
  const addrLines = [
    ...addrParts,
    `PH #: ${co.phone}`,
    `e-mail: ${co.email}`,
    `EIN #: ${co.ein}   UBI #: ${co.ubi}`,
    "Lic #: 172-25",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0);
  addrLines.forEach((line, i) => {
    doc.text(line, pageW - margin, y + i * 12, { align: "right" });
  });

  // Left side: "INVOICE" (larger) + " | J&M AGRICULTURAL LABOR LLC" (smaller)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(21, 128, 61);
  doc.text("INVOICE", margin, y + 4);
  const invTextW = doc.getTextWidth("INVOICE");
  doc.setFontSize(20);
  doc.text(` | ${co.companyName}`, margin + invTextW, y + 4);

  y += 16;

  // Logo below the title (80×80 on screen → 60×60 pt in PDF)
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", margin, y, 60, 60);
  }
  y += logoBase64 ? 68 : 8;

  // ── GREEN DIVIDER ────────────────────────────────────────────────────────
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(3);
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  // ── BILL TO (left) + INVOICE META (right) ───────────────────────────────
  doc.setFontSize(9);
  doc.setTextColor(0);
  const billY = y;
  const lblW = 55; // width of "Address: " label area

  // Left: Bill to - 4 row layout
  doc.setFont("helvetica", "bold");
  doc.text("Bill to:", margin, billY);
  doc.setFont("helvetica", "normal");
  doc.text(clientData.name ?? body.clientName, margin + lblW, billY);

  doc.setFont("helvetica", "bold");
  doc.text("Address:", margin, billY + 13);
  doc.setFont("helvetica", "normal");
  const addrMaxW = contentW / 2 - lblW - 10;
  doc.text(
    truncateToFit(doc, clientData.billingAddress ?? "", addrMaxW),
    margin + lblW,
    billY + 13,
  );

  doc.setFont("helvetica", "bold");
  doc.text("e-mail:", margin, billY + 26);
  doc.setFont("helvetica", "normal");
  doc.text(clientData.email ?? "", margin + lblW, billY + 26);

  doc.setFont("helvetica", "bold");
  doc.text("Phone:", margin, billY + 39);
  doc.setFont("helvetica", "normal");
  doc.text(clientData.phone ?? "", margin + lblW, billY + 39);

  // Right: Invoice meta (adjusted for 4-row Bill To)
  const rmX = pageW - margin;
  const metaX = rmX - 160;
  doc.setFont("helvetica", "bold");
  doc.text("Invoice #:", metaX, billY);
  doc.text(body.invoiceNumber, rmX, billY, { align: "right" });

  doc.text("Invoice Date:", metaX, billY + 13);
  doc.setFont("helvetica", "normal");
  doc.text(body.invoiceDate ?? "", rmX, billY + 13, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text("Terms:", metaX, billY + 26);
  doc.setFont("helvetica", "normal");
  doc.text(clientData.paymentTerms ?? `Net ${paymentDays}`, rmX, billY + 26, {
    align: "right",
  });

  y = billY + 52;

  // ── CALCULATIONS — exact replica of report-display.tsx ───────────────────

  type TableRow = {
    date: string;
    description: string;
    quantity: number;
    unit: string;
    price: number;
    total: number;
  };

  const dailyBreakdown = body.dailyBreakdown ?? {};
  const sortedDates = Object.keys(dailyBreakdown).sort();

  // Regular rows (one per task per date)
  const regularRows: TableRow[] = [];
  sortedDates.forEach((date) => {
    const day = dailyBreakdown[date];
    if (!day) return;
    Object.values(day.tasks).forEach((task) => {
      const isHourly = task.clientRateType === "hourly";
      regularRows.push({
        date,
        description: task.taskName,
        quantity: isHourly ? task.hours : task.pieces,
        unit: isHourly ? "Hrs" : "Pcs",
        price: task.clientRate,
        total: task.cost,
      });
    });
  });

  // Piecework task names → prefix for adjustment rows
  const pieceworkTaskNames = new Set<string>();
  sortedDates.forEach((date) => {
    const day = dailyBreakdown[date];
    if (!day) return;
    Object.values(day.tasks).forEach((t) => {
      if (t.clientRateType === "piece") pieceworkTaskNames.add(t.taskName);
    });
  });
  const pieceworkPrefix =
    pieceworkTaskNames.size === 1
      ? `${Array.from(pieceworkTaskNames)[0]}-`
      : "Piecework-";

  // Last date with a piecework task (used for adjustment row dates)
  const lastPieceworkDate =
    [...sortedDates].reverse().find((date) => {
      const day = dailyBreakdown[date];
      return (
        day &&
        Object.values(day.tasks).some((t) => t.clientRateType === "piece")
      );
    }) ??
    sortedDates[sortedDates.length - 1] ??
    "";

  // OT
  const otHours = body.overtimeHours ?? 0;
  const otPremium = body.overtimePremium ?? 0;
  const otPrice = otHours > 0 ? otPremium / otHours : 0;

  // MW
  const mwTopUp = body.minimumWageTopUp ?? 0;
  const numWorkersMW = (body.employeeDetails ?? []).filter(
    (e) => (e.minimumWageTopUp ?? 0) > 0,
  ).length;
  const mwQuantity = numWorkersMW;
  const mwPrice = mwQuantity > 0 ? mwTopUp / mwQuantity : 0;

  // Paid rest breaks
  const paidRestBreaks = body.paidRestBreaks ?? 0;
  const totalPieceworkHours = sortedDates.reduce((sum, date) => {
    const day = dailyBreakdown[date];
    if (!day) return sum;
    return (
      sum +
      Object.values(day.tasks)
        .filter((t) => t.clientRateType === "piece")
        .reduce((s, t) => s + t.hours, 0)
    );
  }, 0);
  const breakQuantity = totalPieceworkHours * 0.0417;
  const breakPrice = breakQuantity > 0 ? paidRestBreaks / breakQuantity : 0;

  // Adjustment rows (same order as report-display.tsx, only include when total > 0)
  const allAdjustmentRows: TableRow[] = [
    {
      date: lastPieceworkDate,
      description: `${pieceworkPrefix}P/W BREAK`,
      quantity: breakQuantity,
      unit: "Hrs",
      price: breakPrice,
      total: paidRestBreaks,
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

  // Labor Subtotal: aggregate by unit from regular rows + merge adjustments
  const subtotalByUnit = new Map<string, { quantity: number; total: number }>();
  regularRows.forEach((row) => {
    const ex = subtotalByUnit.get(row.unit);
    if (ex) {
      ex.quantity += row.quantity;
      ex.total += row.total;
    } else {
      subtotalByUnit.set(row.unit, {
        quantity: row.quantity,
        total: row.total,
      });
    }
  });
  // Merge P/W BREAK hours into Hrs (only if > 0)
  if (paidRestBreaks > 0) {
    const hrsEntry = subtotalByUnit.get("Hrs");
    if (hrsEntry) {
      hrsEntry.quantity += breakQuantity;
      hrsEntry.total += paidRestBreaks;
    } else {
      subtotalByUnit.set("Hrs", {
        quantity: breakQuantity,
        total: paidRestBreaks,
      });
    }
  }
  if (otPremium > 0) {
    subtotalByUnit.set("OT Hrs", { quantity: otHours, total: otPremium });
  }
  if (mwTopUp > 0) {
    subtotalByUnit.set("MW", { quantity: mwQuantity, total: mwTopUp });
  }

  const unitOrder = ["Hrs", "Pcs", "OT Hrs", "MW"];
  const subtotalRows = unitOrder
    .map((unit) => ({
      unit,
      ...(subtotalByUnit.get(unit) ?? { quantity: 0, total: 0 }),
    }))
    .filter((r) => r.total > 0);

  const invoiceSubtotal = subtotalRows.reduce((sum, r) => sum + r.total, 0);
  const contractorsFee = body.commission ?? 0;
  const overdueInterest = body.overdueInterestAccrued ?? 0;
  const invoiceTotal = body.total ?? 0;

  // ── MAIN LABOR TABLE ─────────────────────────────────────────────────────
  const tFS = 8;
  const rowH = 14;

  // Column layout: DATE | DESCRIPTION | QUANTITY | UNIT | PRICE | TOTAL
  const dateW = 72;
  const qtyW = 60;
  const unitW = 42;
  const priceW = 62;
  const totW = 60;
  const descW = contentW - dateW - qtyW - unitW - priceW - totW;

  const colX = {
    date: margin,
    desc: margin + dateW,
    qty: margin + dateW + descW,
    unit: margin + dateW + descW + qtyW,
    price: margin + dateW + descW + qtyW + unitW,
    total: margin + dateW + descW + qtyW + unitW + priceW,
  };

  const drawMainHeader = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y, contentW, rowH, "F");
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentW, rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(tFS);
    doc.setTextColor(0);
    doc.text("DATE", colX.date + 4, y + 10);
    doc.text("DESCRIPTION", colX.desc + 4, y + 10);
    doc.text("QUANTITY", colX.qty + qtyW - 4, y + 10, { align: "right" });
    doc.text("UNIT", colX.unit + unitW / 2, y + 10, { align: "center" });
    doc.text("PRICE", colX.price + priceW - 4, y + 10, { align: "right" });
    doc.text("TOTAL", colX.total + totW - 4, y + 10, { align: "right" });
    y += rowH;
  };

  drawMainHeader();

  doc.setFont("helvetica", "normal");
  tableRows.forEach((row, idx) => {
    // Overflow → new page, redraw header
    if (y + rowH > pageH - 200) {
      doc.addPage();
      y = margin;
      drawMainHeader();
      doc.setFont("helvetica", "normal");
    }

    const bg = idx % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
    doc.setFillColor(bg[0]!, bg[1]!, bg[2]!);
    doc.rect(margin, y, contentW, rowH, "F");
    doc.setDrawColor(229, 231, 235);
    doc.rect(margin, y, contentW, rowH);
    doc.setFontSize(tFS);
    doc.setTextColor(0);

    doc.text(formatDateMDY(row.date), colX.date + 4, y + 10);
    doc.text(
      truncateToFit(doc, row.description, descW - 8),
      colX.desc + 4,
      y + 10,
    );

    doc.text(fmtNum(row.quantity), colX.qty + qtyW - 4, y + 10, {
      align: "right",
    });
    doc.text(row.unit, colX.unit + unitW / 2, y + 10, { align: "center" });
    doc.text(`$${row.price.toFixed(4)}`, colX.price + priceW - 4, y + 10, {
      align: "right",
    });
    doc.text(fmtCurrency(row.total), colX.total + totW - 4, y + 10, {
      align: "right",
    });
    y += rowH;
  });

  y += 8;

  // ── BOTTOM SECTION: Labor Subtotal (left) + Invoice Summary (right) ──────
  const gap = 24;
  const halfW = (contentW - gap) / 2;
  const leftX = margin;
  const rightX = margin + halfW + gap;
  const subRowH = 16;
  const subFS = 8;
  const sectionStartY = y;

  // === LEFT: Labor Subtotal ===
  let ly = sectionStartY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Labor Subtotal", leftX, ly + 10);
  ly += 15;

  // Sub-table header
  const lqW = halfW * 0.4;
  const luW = halfW * 0.25;
  doc.setFillColor(243, 244, 246);
  doc.rect(leftX, ly, halfW, subRowH, "F");
  doc.setDrawColor(209, 213, 219);
  doc.rect(leftX, ly, halfW, subRowH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(subFS);
  doc.text("QUANTITY", leftX + lqW - 4, ly + 11, { align: "right" });
  doc.text("UNIT", leftX + lqW + luW / 2, ly + 11, { align: "center" });
  doc.text("TOTAL", leftX + halfW - 4, ly + 11, { align: "right" });
  ly += subRowH;

  // Sub-table body
  doc.setFont("helvetica", "normal");
  subtotalRows.forEach((row) => {
    doc.setDrawColor(229, 231, 235);
    doc.rect(leftX, ly, halfW, subRowH);
    doc.setFontSize(subFS);
    doc.setTextColor(0);
    doc.text(fmtNum(row.quantity), leftX + lqW - 4, ly + 11, {
      align: "right",
    });
    doc.text(row.unit, leftX + lqW + luW / 2, ly + 11, { align: "center" });
    doc.text(fmtCurrency(row.total), leftX + halfW - 4, ly + 11, {
      align: "right",
    });
    ly += subRowH;
  });

  // Sub-table footer: Invoice Subtotal row
  doc.setFillColor(243, 244, 246);
  doc.rect(leftX, ly, halfW, subRowH, "F");
  doc.setDrawColor(209, 213, 219);
  doc.rect(leftX, ly, halfW, subRowH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(subFS);
  doc.setTextColor(0);
  doc.text("Invoice Subtotal", leftX + 6, ly + 11);
  doc.text(fmtCurrency(invoiceSubtotal), leftX + halfW - 4, ly + 11, {
    align: "right",
  });
  ly += subRowH;

  // === RIGHT: Invoice Summary ===
  // Vertically aligned with Labor Subtotal body
  // (skip "Labor Subtotal" label height + sub-header row)
  let ry = sectionStartY + 15 + subRowH;

  // Build summary rows; insert Overdue Interest after Contractors Fee if present
  type SummaryRow = {
    label: string;
    value: number;
    bold: boolean;
    highlight: boolean;
    large: boolean;
    red?: boolean;
  };
  const summaryData: SummaryRow[] = [
    {
      label: "Invoice Subtotal",
      value: invoiceSubtotal,
      bold: true,
      highlight: false,
      large: false,
    },
    {
      label: `Contractors Fee${clientData.commissionRate ? ` (${clientData.commissionRate}%)` : ""}`,
      value: contractorsFee,
      bold: false,
      highlight: false,
      large: false,
    },
  ];

  if (overdueInterest > 0) {
    const oiDueDate = body.overdueInterestDueDate ?? "—";
    const oiCurrentDate = body.overdueInterestCurrentDate ?? "—";
    summaryData.push({
      label: `Overdue Interest Accrued`,
      value: overdueInterest,
      bold: false,
      highlight: false,
      large: false,
      red: true,
    });
  }

  summaryData.push(
    {
      label: "Total Field Charges",
      value: invoiceTotal,
      bold: false,
      highlight: false,
      large: false,
    },
    {
      label: "Invoice Total",
      value: invoiceTotal,
      bold: true,
      highlight: true,
      large: true,
    },
  );

  summaryData.forEach((row) => {
    if (row.highlight) {
      doc.setFillColor(243, 244, 246);
      doc.rect(rightX, ry, halfW, subRowH, "F");
      doc.setDrawColor(209, 213, 219);
    } else {
      doc.setDrawColor(229, 231, 235);
    }
    doc.rect(rightX, ry, halfW, subRowH);
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(row.large ? 10 : subFS);
    doc.setTextColor(row.red ? 220 : 0, row.red ? 38 : 0, row.red ? 38 : 0);
    doc.text(truncateToFit(doc, row.label, halfW - 70), rightX + 8, ry + 11);
    doc.setTextColor(0);
    doc.text(fmtCurrency(row.value), rightX + halfW - 4, ry + 11, {
      align: "right",
    });
    ry += subRowH;
  });

  y = Math.max(ly, ry) + 12;

  // ── FOOTER ──────────────────────────────────────────────────────────────
  if (y + 60 > pageH - margin) {
    doc.addPage();
    y = margin;
  }

  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  // Footer: 3 centered lines
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Make all checks payable to ${co.companyName}`,
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 12;
  doc.text(
    `Any unpaid invoices after ${paymentDays} days will incur additional fees`,
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("THANK YOU FOR YOUR BUSINESS!", pageW / 2, y, { align: "center" });

  return doc.output("datauristring").split(",")[1];
}

// ─── Labor Report PDF generation ─────────────────────────────────────────────

function generateLaborReportPdf(data: LaborReportData, co: CompanyInfo = DEFAULT_COMPANY_INFO): string {
  // Use landscape letter for wide employee table
  const doc = new jsPDF({
    unit: "pt",
    format: "letter",
    orientation: "landscape",
  });
  const pageW = doc.internal.pageSize.getWidth(); // 792
  const pageH = doc.internal.pageSize.getHeight(); // 612
  const margin = 30;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Load logo ──────────────────────────────────────────────────────────
  let logoBase64: string | null = null;
  try {
    const logoPath = path.join(
      process.cwd(),
      "src",
      "components",
      "images",
      "logo.jpeg",
    );
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  } catch {
    // Logo not available — skip silently
  }

  // ── Date range helpers ──────────────────────────────────────────────────
  const fromDate = parseLocalDate(data.dateFrom);
  const toDate = parseLocalDate(data.dateTo);

  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  let dateRangeStr = "";
  if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
    const fromDay = daysOfWeek[fromDate.getDay()] ?? "";
    const toDay = daysOfWeek[toDate.getDay()] ?? "";
    const fromMon = monthNames[fromDate.getMonth()] ?? "";
    const toMon = monthNames[toDate.getMonth()] ?? "";
    if (fromMon === toMon) {
      dateRangeStr = `${fromDay} - ${toDay}, ${fromMon} ${String(fromDate.getDate()).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}, ${toDate.getFullYear()}`;
    } else {
      dateRangeStr = `${fromDay}, ${fromMon} ${String(fromDate.getDate()).padStart(2, "0")} - ${toDay}, ${toMon} ${String(toDate.getDate()).padStart(2, "0")}, ${toDate.getFullYear()}`;
    }
  }

  // ── HEADER ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(21, 128, 61);
  doc.text(`Labor Report | ${co.companyName}`, margin, y + 4);

  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", pageW - margin - 64, y - 4, 64, 52);
  }

  y += 16;

  // Meta row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text(dateRangeStr, margin, y + 10);
  doc.text(
    `$ ${(data.minimumWage ?? 19.82).toFixed(2)} :Min Wage`,
    margin,
    y + 22,
  );
  doc.text(`EIN# ${co.ein}`, margin + 200, y + 10);
  doc.text(`UBI# ${co.ubi}`, margin + 200, y + 22);
  doc.text("LIC#172-25", margin + 380, y + 10);

  y += 36;

  // Green divider
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(3);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // ── EMPLOYEE TABLE ──────────────────────────────────────────────────────
  const employees = data.employeeDetails ?? [];

  // Collect unique task names
  const taskNameSet = new Set<string>();
  employees.forEach((emp) => {
    emp.tasksSummary.forEach((t) => taskNameSet.add(t.taskName));
  });
  const uniqueTasks = Array.from(taskNameSet);

  const hasOT = employees.some((emp) => (emp.overtimeHours ?? 0) > 0);

  // Column widths
  const nameW = 90;
  const hoursW = 36;
  const taskColW = 38; // each of: Piece, Rate, Piece Pay
  const totalPiecesPayW = 46;
  const otHoursW = 36;
  const regRateW = 40;
  const otPremiumW = 40;
  const diffOwedW = 42;
  const payReqW = 46;

  const taskBlockW = taskColW * 3;
  const tasksTotalW = uniqueTasks.length * taskBlockW;
  const otBlockW = hasOT ? otHoursW + regRateW + otPremiumW : 0;
  const tableW =
    nameW +
    hoursW +
    tasksTotalW +
    totalPiecesPayW +
    otBlockW +
    diffOwedW +
    payReqW;

  // Always scale to fill the full content width (scale up or down as needed)
  const scaleFactor = contentW / tableW;
  // Data-row font: min 6pt (readability floor), max 9pt (avoid oversized text when few columns)
  const tFS = Math.min(9, Math.max(6, Math.floor(8 * scaleFactor)));
  // Row height: min 12pt, max 20pt — scales with font size
  const rowH = Math.min(20, Math.max(12, Math.floor(15 * scaleFactor)));
  // Header cells use a fixed smaller font so long labels (e.g. "Overtime Hours (over 40/week)")
  // never wrap into more lines than hRowH can contain regardless of scaleFactor.
  const headerFS = 7;
  // jsPDF default lineHeightFactor is 1.15 — used to compute the actual rendered block height.
  const jsPdfLineH = headerFS * 1.15;
  // Header row tall enough for 3 lines at 7pt with comfortable top/bottom padding.
  const hRowH = 36;

  let cx = margin;

  const thStyle = (w: number) => {
    doc.setFillColor(220, 252, 231); // #dcfce7
    doc.rect(cx, y, w, hRowH, "F");
    doc.setDrawColor(22, 163, 74); // #16a34a
    doc.setLineWidth(0.5); // reset lineWidth so header borders are thin (not 3pt from divider)
    doc.rect(cx, y, w, hRowH);
    cx += w;
  };

  // Helper to draw header row with centered, wrapped text
  const drawHeader = (cols: Array<{ label: string; w: number }>) => {
    cx = margin;
    cols.forEach(({ label, w }) => {
      thStyle(w);
      cx -= w;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(headerFS);
      doc.setTextColor(0);
      const lines = doc.splitTextToSize(label, w - 4);
      // Height of the text block: first line cap height + subsequent line steps
      const textBlockH = headerFS * 0.8 + (lines.length - 1) * jsPdfLineH;
      // Clamp so the first-line baseline never falls above the cell top
      const textStartY = Math.max(
        y + headerFS,
        y + (hRowH - textBlockH) / 2 + headerFS * 0.8,
      );
      doc.text(lines, cx + w / 2, textStartY, { align: "center" });
      cx += w;
    });
    y += hRowH;
    cx = margin;
  };

  const headers: Array<{ label: string; w: number }> = [
    { label: "Worker Name", w: nameW * scaleFactor },
    { label: "Hours", w: hoursW * scaleFactor },
  ];
  uniqueTasks.forEach((taskName, idx) => {
    const label = String.fromCharCode(65 + idx);
    headers.push({ label: `Piece ${label}`, w: taskColW * scaleFactor });
    headers.push({ label: `Rate ${label}`, w: taskColW * scaleFactor });
    headers.push({ label: `Piece Pay ${label}`, w: taskColW * scaleFactor });
  });
  headers.push({ label: "Total Pieces Pay", w: totalPiecesPayW * scaleFactor });
  if (hasOT) {
    headers.push({
      label: "Overtime Hours (over 40/week)",
      w: otHoursW * scaleFactor,
    });
    headers.push({
      label: "Regular Rate for OT Calculation",
      w: regRateW * scaleFactor,
    });
    headers.push({
      label: "Overtime Premium (0.5x rate)",
      w: otPremiumW * scaleFactor,
    });
  }
  headers.push({ label: "Diff Owed/Break", w: diffOwedW * scaleFactor });
  headers.push({ label: "PAY REQ", w: payReqW * scaleFactor });

  drawHeader(headers);

  // Data rows
  employees.forEach((emp, rowIdx) => {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
      drawHeader(headers);
    }

    const taskMap = new Map(emp.tasksSummary.map((t) => [t.taskName, t]));
    const totalPiecesPay = emp.tasksSummary.reduce((s, t) => s + t.cost, 0);
    const diffOwed =
      emp.paidRestBreaks + emp.minimumWageTopUp + (emp.overtimePremium ?? 0);
    const payReq = totalPiecesPay + diffOwed;

    const rowBg = rowIdx % 2 === 0 ? [255, 255, 255] : [249, 250, 251];

    cx = margin;

    const drawCell = (
      text: string,
      w: number,
      align: "left" | "center" | "right" = "center",
    ) => {
      doc.setFillColor(rowBg[0]!, rowBg[1]!, rowBg[2]!);
      doc.rect(cx, y, w, rowH, "F");
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.4);
      doc.rect(cx, y, w, rowH);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(tFS);
      doc.setTextColor(0);
      const tx =
        align === "left" ? cx + 2 : align === "right" ? cx + w - 2 : cx + w / 2;
      doc.text(text, tx, y + rowH - 3, { align, maxWidth: w - 2 });
      cx += w;
    };

    drawCell(emp.employeeName, nameW * scaleFactor, "left");
    drawCell(emp.totalHours.toFixed(2), hoursW * scaleFactor);

    uniqueTasks.forEach((taskName) => {
      const task = taskMap.get(taskName);
      drawCell(
        task ? task.quantity.toFixed(2) : "0.00",
        taskColW * scaleFactor,
      );
      drawCell(
        task ? `$ ${task.rate.toFixed(2)}` : "$ 0.00",
        taskColW * scaleFactor,
      );
      drawCell(
        task ? `$ ${task.cost.toFixed(2)}` : "$ 0.00",
        taskColW * scaleFactor,
      );
    });

    drawCell(`$ ${totalPiecesPay.toFixed(2)}`, totalPiecesPayW * scaleFactor);

    if (hasOT) {
      drawCell(
        `${(emp.overtimeHours ?? 0).toFixed(2)} hrs`,
        otHoursW * scaleFactor,
      );
      drawCell(
        `$ ${(emp.regularRate ?? 0).toFixed(2)}/hr`,
        regRateW * scaleFactor,
      );
      drawCell(
        `$ ${(emp.overtimePremium ?? 0).toFixed(2)}`,
        otPremiumW * scaleFactor,
      );
    }

    drawCell(`$ ${diffOwed.toFixed(2)}`, diffOwedW * scaleFactor);
    drawCell(`$ ${payReq.toFixed(2)}`, payReqW * scaleFactor);

    y += rowH;
  });

  y += 16;

  // ── TASK LEGEND + TOTAL BASE LABOR COST ──────────────────────────────────
  if (uniqueTasks.length > 0) {
    // Check if there's enough space on the current page
    const estimatedHeight = uniqueTasks.length * 14 + 80;
    if (y + estimatedHeight > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;

    const halfW = contentW / 2 - 16;

    // Task Legend (left)
    let ly = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Task Legend:", margin, ly);
    ly += 14;

    uniqueTasks.forEach((taskName, idx) => {
      const label = String.fromCharCode(65 + idx);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`PIECE ${label} = `, margin, ly);
      doc.setFont("helvetica", "normal");
      doc.text(taskName, margin + doc.getTextWidth(`PIECE ${label} = `), ly);
      ly += 12;
    });

    // Total Base Labor Cost (right)
    const rightX = margin + halfW + 32;
    let ry = y;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Total Base Labor Cost", rightX, ry);
    ry += 14;

    // Sub-table header
    const thFS = 8;
    const subRowH = 14;
    const col1W = halfW * 0.25;
    const col2W = halfW * 0.25;
    const col3W = halfW * 0.25;
    const col4W = halfW - col1W - col2W - col3W;

    const drawSubHeader = (labels: string[]) => {
      let sx = rightX;
      const widths = [col1W, col2W, col3W, col4W];
      labels.forEach((lbl, i) => {
        doc.setFillColor(220, 252, 231);
        doc.rect(sx, ry, widths[i]!, subRowH, "F");
        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(0.4);
        doc.rect(sx, ry, widths[i]!, subRowH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(thFS);
        doc.setTextColor(0);
        doc.text(lbl, sx + widths[i]! / 2, ry + subRowH - 3, {
          align: "center",
        });
        sx += widths[i]!;
      });
      ry += subRowH;
    };

    drawSubHeader(["Pieces", "Total Pieces", "Rate", "Total Pay"]);

    const drawSubRow = (cells: string[]) => {
      let sx = rightX;
      const widths = [col1W, col2W, col3W, col4W];
      cells.forEach((cell, i) => {
        doc.setFillColor(255, 255, 255);
        doc.rect(sx, ry, widths[i]!, subRowH, "F");
        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(0.4);
        doc.rect(sx, ry, widths[i]!, subRowH);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(thFS);
        doc.setTextColor(0);
        doc.text(cell, sx + widths[i]! / 2, ry + subRowH - 3, {
          align: "center",
          maxWidth: widths[i]! - 4,
        });
        sx += widths[i]!;
      });
      ry += subRowH;
    };

    // Draw a row where the label spans the first 3 columns (matching colSpan={3} in HTML)
    const drawSubRowSpanned = (label: string, value: string, bold = false) => {
      const spanW = col1W + col2W + col3W;
      // Spanned label cell
      doc.setFillColor(255, 255, 255);
      doc.rect(rightX, ry, spanW, subRowH, "F");
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.4);
      doc.rect(rightX, ry, spanW, subRowH);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(thFS);
      doc.setTextColor(0);
      doc.text(label, rightX + 4, ry + subRowH - 3, { maxWidth: spanW - 6 });
      // Value cell
      const valX = rightX + spanW;
      doc.setFillColor(255, 255, 255);
      doc.rect(valX, ry, col4W, subRowH, "F");
      doc.setDrawColor(22, 163, 74);
      doc.rect(valX, ry, col4W, subRowH);
      doc.text(value, valX + col4W / 2, ry + subRowH - 3, {
        align: "center",
        maxWidth: col4W - 4,
      });
      ry += subRowH;
    };

    // Draw the bold Total Amount row spanning first 3 columns
    const drawSubTotalRow = (label: string, value: string) => {
      const spanW = col1W + col2W + col3W;
      doc.setFillColor(243, 244, 246);
      doc.rect(rightX, ry, spanW, subRowH, "F");
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.4);
      doc.rect(rightX, ry, spanW, subRowH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(thFS);
      doc.setTextColor(0);
      doc.text(label, rightX + 4, ry + subRowH - 3, { maxWidth: spanW - 6 });
      const valX = rightX + spanW;
      doc.setFillColor(243, 244, 246);
      doc.rect(valX, ry, col4W, subRowH, "F");
      doc.setDrawColor(22, 163, 74);
      doc.rect(valX, ry, col4W, subRowH);
      doc.text(value, valX + col4W / 2, ry + subRowH - 3, {
        align: "center",
        maxWidth: col4W - 4,
      });
      ry += subRowH;
    };

    // Calc task totals across employees
    uniqueTasks.forEach((taskName, idx) => {
      const label = String.fromCharCode(65 + idx);
      let totalPcs = 0;
      let rate = 0;
      let totalPay = 0;
      employees.forEach((emp) => {
        const task = emp.tasksSummary.find((t) => t.taskName === taskName);
        if (task) {
          totalPcs += task.quantity;
          rate = task.rate;
          totalPay += task.cost;
        }
      });
      drawSubRow([
        `Piece ${label}`,
        totalPcs.toFixed(2),
        `$ ${rate.toFixed(2)}`,
        `$ ${totalPay.toFixed(2)}`,
      ]);
    });

    const totalPaidRestBreaks = data.paidRestBreaks;
    const totalOtPremium = data.overtimePremium ?? 0;
    const totalMwTopUp = data.minimumWageTopUp;
    const totalSubtotal = data.subtotal;

    if (totalPaidRestBreaks > 0) {
      drawSubRowSpanned(
        "Paid Rest Breaks",
        `$ ${totalPaidRestBreaks.toFixed(2)}`,
      );
    }
    if (totalOtPremium > 0) {
      drawSubRowSpanned(
        "Overtime Premium (0.5x rate)",
        `$ ${totalOtPremium.toFixed(2)}`,
      );
    }
    if (totalMwTopUp > 0) {
      drawSubRowSpanned(
        "Minimum Wage Adjustments",
        `$ ${totalMwTopUp.toFixed(2)}`,
      );
    }

    drawSubTotalRow("Total Amount:", `$ ${totalSubtotal.toFixed(2)}`);
  }

  return doc.output("datauristring").split(",")[1];
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: SendInvoiceBody;
  try {
    body = (await request.json()) as SendInvoiceBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { invoiceNumber, clientEmail, total, dueDate, clientName } = body;
  const includeLaborReport = body.includeLaborReport ?? false;
  if (!clientEmail) {
    return NextResponse.json(
      { error: "clientEmail is required" },
      { status: 400 },
    );
  }
  console.log("variable de,labor report", includeLaborReport);

  const co = await fetchCompanyInfo();

  // --- CONFIGURACIÓN GMAIL ---
  const smtpUser = "jmagriculturalaborinvoicing@gmail.com";
  const smtpPass = process.env.SMTP_PASS;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeTotal = escapeHtml((total ?? 0).toFixed(2));
  const safeDueDate = escapeHtml(dueDate ?? "");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
      <p>Hello,</p>
      <p>Please find attached invoice <strong>#${safeInvoiceNumber}</strong> for the agricultural labor services provided during the past week.</p>
      <p>The total amount due is <strong>$${safeTotal}</strong>${safeDueDate ? `, with a due date of <strong>${safeDueDate}</strong>` : ""}.</p>
      ${includeLaborReport ? "<p>Also attached is the detailed Labor report for your records.</p>" : ""}
      
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #ccc; margin: 20px 0;">
        <p style="font-size: 0.9em; margin: 0;">
          <strong>Please note:</strong> This is an automated sending service and this email address is not monitored. 
          For any questions, replies, or future correspondence, please contact us directly at
          <a href="mailto:${co.email}">${co.email}</a>.
        </p>
      </div>

      <p>Thank you for your business!</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>${co.companyName}</strong><br>
        Billing Department<br>
        Email: <a href="mailto:${co.email}">${co.email}</a><br>
        Phone: ${co.phone}<br>
        License #: 172-25<br>
        Pasco, WA 99301
      </p>
    </div>
  `;

  // Generate PDF attachments
  let pdfBuffer: Buffer | undefined;
  try {
    const pdfBase64 = generateInvoicePdf(body, co);
    pdfBuffer = Buffer.from(pdfBase64, "base64");
  } catch (pdfErr) {
    console.error("Error generating invoice PDF:", pdfErr);
    // Continue without attachment if PDF generation fails
  }

  let laborReportPdfBuffer: Buffer | undefined;
  if (body.includeLaborReport && body.laborReportData) {
    try {
      const laborBase64 = generateLaborReportPdf(body.laborReportData, co);
      laborReportPdfBuffer = Buffer.from(laborBase64, "base64");
    } catch (laborPdfErr) {
      console.error("Error generating labor report PDF:", laborPdfErr);
      // Continue without labor report attachment
    }
  }

  const attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }> = [];
  if (pdfBuffer) {
    attachments.push({
      filename: `Invoice_${invoiceNumber}_${clientName.replace(/\s+/g, "_")}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  }
  if (laborReportPdfBuffer) {
    attachments.push({
      filename: `LaborReport_${invoiceNumber}_${clientName.replace(/\s+/g, "_")}.pdf`,
      content: laborReportPdfBuffer,
      contentType: "application/pdf",
    });
  }

  try {
    await transporter.sendMail({
      from: `"${co.companyName}" <${smtpUser}>`,
      to: clientEmail,
      subject: `Invoice ${invoiceNumber} from ${co.companyName}`,
      html,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error sending email:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
