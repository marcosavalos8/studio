import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";
import * as fs from "fs";
import * as path from "path";

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

function generateInvoicePdf(body: SendInvoiceBody): string {
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
  const addrLines = [
    "250 Country Heaven Loop",
    "Pasco, WA 99301.",
    "Telf.: 509.380.3385",
    "e-mail: Jmagriculturalabor@outlook.com",
    "EIN #: 33-2236422   UBI #: 605 650 411",
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
  doc.setFontSize(14);
  doc.text(" | J&M AGRICULTURAL LABOR LLC", margin + invTextW, y + 4);

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

  // Left: Bill to
  doc.setFont("helvetica", "bold");
  doc.text("Bill to:", margin, billY);
  doc.text(clientData.name ?? body.clientName, margin + lblW, billY);
  doc.text("Phone:", margin + lblW + 130, billY);
  doc.setFont("helvetica", "normal");
  doc.text(clientData.phone ?? "", margin + lblW + 170, billY);

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

  // Right: Invoice meta
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

  y = billY + 40;

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
      label: `Overdue Interest Accrued (0.033%/day from ${oiDueDate} to ${oiCurrentDate})`,
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
    doc.text(
      truncateToFit(doc, row.label, halfW - 70),
      rightX + 8,
      ry + 11,
    );
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
  y += 10;

  // Footer text with mixed bold / red formatting, matching report-display.tsx exactly
  drawRichText(
    doc,
    [
      { text: '"All invoices are due and payable within ' },
      { text: `${numberToWords(paymentDays)} (${paymentDays})`, bold: true },
      {
        text: " calendar days from the invoice date. Any balance unpaid after the ",
      },
      { text: `${paymentDays}-day`, bold: true },
      { text: " period will accrue interest at a rate of " },
      { text: "1%", bold: true, red: true },
      {
        text: " per month. This interest shall be calculated on a per-diem (daily) basis starting from the first day following the Due Date (Day ",
      },
      { text: `${paymentDays + 1}`, bold: true },
      { text: ') until the payment is received in full by the Contractor."' },
    ],
    margin,
    y,
    contentW,
    11,
    8,
  );

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

  if (!clientEmail) {
    return NextResponse.json(
      { error: "clientEmail is required" },
      { status: 400 },
    );
  }

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
      <p>Also attached is the detailed Labor report for your records.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #ccc; margin: 20px 0;">
        <p style="font-size: 0.9em; margin: 0;">
          <strong>Please note:</strong> This is an automated sending service and this email address is not monitored. 
          For any questions, replies, or future correspondence, please contact us directly at 
          <a href="mailto:Jmagriculturalabor@outlook.com">Jmagriculturalabor@outlook.com</a>.
        </p>
      </div>

      <p>Thank you for your business!</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>J&amp;M Agricultural Labor LLC</strong><br>
        Billing Department<br>
        Email: <a href="mailto:Jmagriculturalabor@outlook.com">Jmagriculturalabor@outlook.com</a><br>
        Phone: 509-380-3385<br>
        License #: 172-25<br>
        Pasco, WA 99301
      </p>
    </div>
  `;

  // Generate PDF attachment
  let pdfBuffer: Buffer | undefined;
  try {
    const pdfBase64 = generateInvoicePdf(body);
    pdfBuffer = Buffer.from(pdfBase64, "base64");
  } catch (pdfErr) {
    console.error("Error generating invoice PDF:", pdfErr);
    // Continue without attachment if PDF generation fails
  }

  try {
    await transporter.sendMail({
      from: `"J&M Agricultural Labor LLC" <${smtpUser}>`,
      to: clientEmail,
      subject: `Invoice ${invoiceNumber} from J&M Agricultural Labor LLC`,
      html,
      attachments: pdfBuffer
        ? [
            {
              filename: `Invoice_${invoiceNumber}_${clientName.replace(/\s+/g, "_")}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        : [],
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
