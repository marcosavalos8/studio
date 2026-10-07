import { jsPDF } from "jspdf";

// Self-contained module: no imports from the API route, so it can be unit-tested
// on its own and never risks breaking the existing (old design) PDF generator.

export interface CompanyInfo {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  ein: string;
  ubi: string;
}

export interface LaborReportEmployeeDetail {
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
    hours?: number;
    pieces?: number;
  }>;
}

export interface LaborReportData {
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

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const [y, m, d] = parts;
  if (parts.length !== 3 || !y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) {
    return new Date(NaN);
  }
  return new Date(y, m - 1, d);
}

// Task names are labeled with their rate ("Name · $22.00") upstream so tasks with
// the same name but different rates stay on separate rows; the rate gets its own
// column here, so strip the suffix back off for display.
function plainName(label: string): string {
  return label.replace(/ · \$[\d.,]+$/, "");
}

// Binary-search the longest prefix (plus an ellipsis) that fits maxWidth, so a
// long task name can never wrap to a second line and overlap the row below it.
function truncateToFit(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
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

type Row = {
  taskName: string;
  rateType: "hourly" | "piece";
  rate: number;
  hours: number;
  pieces: number;
  cost: number;
};

function buildRows(emp: LaborReportEmployeeDetail): Row[] {
  return emp.tasksSummary
    .map((t) => ({
      taskName: plainName(t.taskName),
      rateType: t.rateType,
      rate: t.rate,
      hours: t.hours ?? (t.rateType === "hourly" ? t.quantity : 0),
      pieces: t.pieces ?? (t.rateType === "piece" ? t.quantity : 0),
      cost: t.cost,
    }))
    .sort((a, b) => a.taskName.localeCompare(b.taskName));
}

export function generateLaborReportPdfNewDesign(
  data: LaborReportData,
  co: CompanyInfo,
  // Base64-encoded logo (no data: prefix). Loading it is the caller's job, since
  // this module has to work both on the server (fs) and in the browser (fetch).
  logoBase64?: string | null,
): string {
  // Landscape letter, same as the existing (old design) labor report PDF.
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 30;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Date range ────────────────────────────────────────────────────────
  const fromDate = parseLocalDate(data.dateFrom);
  const toDate = parseLocalDate(data.dateTo);
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

  // ── HEADER (same layout as the old design PDF) ───────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(21, 128, 61);
  doc.text(`Labor Report | ${co.companyName}`, margin, y + 4);
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", pageW - margin - 64, y - 4, 64, 52);
  }
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text(dateRangeStr, margin, y + 10);
  doc.text(`$ ${(data.minimumWage ?? 19.82).toFixed(2)} :Min Wage`, margin, y + 22);
  doc.text(`EIN# ${co.ein}`, margin + 200, y + 10);
  doc.text(`UBI# ${co.ubi}`, margin + 200, y + 22);
  doc.text("LIC#172-25", margin + 380, y + 10);
  y += 36;

  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(3);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // ── EMPLOYEE TABLE: one row per task, worker merged across their rows ────
  const employees = data.employeeDetails ?? [];
  const employeeRows = employees.map((emp) => {
    const rows = buildRows(emp);
    const totalPay = emp.tasksSummary.reduce((s, t) => s + t.cost, 0);
    const otHours = emp.overtimeHours ?? 0;
    const otPremium = emp.overtimePremium ?? 0;
    const otRate = emp.regularRate ?? (otHours > 0 ? otPremium / (0.5 * otHours) : 0);
    const breaks = emp.paidRestBreaks ?? 0;
    const minWage = emp.minimumWageTopUp ?? 0;
    return {
      emp,
      rows,
      otHours,
      otPremium,
      otRate,
      breaks,
      minWage,
      payReq: totalPay + breaks + minWage + otPremium,
    };
  });

  const hasPieces = employeeRows.some((e) => e.rows.some((r) => r.rateType === "piece"));
  const hasOT = employeeRows.some((e) => e.otHours > 0);

  // Column widths (unscaled reference values, same convention as the old design)
  const nameW = 90;
  const taskW = 170;
  const hoursW = 36;
  const piecesW = 34;
  const rateW = 42;
  const totalPayW = 48;
  const otHoursW = 40;
  const otRateW = 46;
  const otPremiumW = 46;
  const breakW = 40;
  const minWageW = 46;
  const payReqW = 50;

  const tableW =
    nameW +
    taskW +
    hoursW +
    (hasPieces ? piecesW : 0) +
    rateW +
    totalPayW +
    (hasOT ? otHoursW + otRateW + otPremiumW : 0) +
    (hasPieces ? breakW + minWageW : 0) +
    payReqW;
  const scaleFactor = contentW / tableW;
  const tFS = Math.min(9, Math.max(6, Math.floor(8 * scaleFactor)));
  const rowH = Math.min(20, Math.max(12, Math.floor(15 * scaleFactor)));
  const headerFS = 7;
  const jsPdfLineH = headerFS * 1.15;
  const hRowH = 36;

  let cx = margin;

  const thStyle = (w: number) => {
    doc.setFillColor(220, 252, 231);
    doc.rect(cx, y, w, hRowH, "F");
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.5);
    doc.rect(cx, y, w, hRowH);
    cx += w;
  };

  const drawHeader = (cols: Array<{ label: string; w: number }>) => {
    cx = margin;
    cols.forEach(({ label, w }) => {
      thStyle(w);
      cx -= w;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(headerFS);
      doc.setTextColor(0);
      const lines = doc.splitTextToSize(label, w - 4);
      const textBlockH = headerFS * 0.8 + (lines.length - 1) * jsPdfLineH;
      const textStartY = Math.max(y + headerFS, y + (hRowH - textBlockH) / 2 + headerFS * 0.8);
      doc.text(lines, cx + w / 2, textStartY, { align: "center" });
      cx += w;
    });
    y += hRowH;
    cx = margin;
  };

  const headers: Array<{ label: string; w: number }> = [
    { label: "Worker Name", w: nameW * scaleFactor },
    { label: "Task/Description", w: taskW * scaleFactor },
    { label: "Hours", w: hoursW * scaleFactor },
  ];
  if (hasPieces) headers.push({ label: "Pieces", w: piecesW * scaleFactor });
  headers.push({ label: "Rate", w: rateW * scaleFactor });
  headers.push({ label: "Total Pay", w: totalPayW * scaleFactor });
  if (hasOT) {
    headers.push({ label: "Overtime Hours", w: otHoursW * scaleFactor });
    headers.push({ label: "Regular Rate for OT", w: otRateW * scaleFactor });
    headers.push({ label: "Overtime Premium (0.5x rate)", w: otPremiumW * scaleFactor });
  }
  if (hasPieces) {
    headers.push({ label: "Break", w: breakW * scaleFactor });
    headers.push({ label: "Min. Wage", w: minWageW * scaleFactor });
  }
  headers.push({ label: "PAY REQ", w: payReqW * scaleFactor });

  const fullTableW = headers.reduce((s, h) => s + h.w, 0);

  drawHeader(headers);

  // Column lines only (no horizontal line between a worker's own task rows); a
  // darker line is drawn at the top and bottom of each worker's block instead.
  const drawCell = (
    text: string,
    x: number,
    rowTop: number,
    w: number,
    h: number,
    align: "left" | "center" | "right",
    bold: boolean,
    bg: [number, number, number],
  ) => {
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(x, rowTop, w, h, "F");
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.4);
    doc.line(x, rowTop, x, rowTop + h);
    doc.line(x + w, rowTop, x + w, rowTop + h);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(tFS);
    doc.setTextColor(0);
    const tx = align === "left" ? x + 2 : align === "right" ? x + w - 2 : x + w / 2;
    const ty = h > rowH ? rowTop + h / 2 + tFS * 0.35 : rowTop + h - 3;
    doc.text(truncateToFit(doc, text, w - 4), tx, ty, { align });
  };

  employeeRows.forEach((e, empIdx) => {
    const rows = e.rows.length > 0 ? e.rows : null;
    const rowCount = rows ? rows.length : 1;
    const blockH = rowCount * rowH;

    if (y + blockH > pageH - margin) {
      doc.addPage();
      y = margin;
      drawHeader(headers);
    }

    const blockTop = y;
    const bg: [number, number, number] = empIdx % 2 === 0 ? [255, 255, 255] : [249, 250, 251];

    let colX = margin;
    drawCell(e.emp.employeeName, colX, blockTop, nameW * scaleFactor, blockH, "left", false, bg);
    colX += nameW * scaleFactor;

    const perRowStartX = colX;
    for (let i = 0; i < rowCount; i++) {
      const row = rows ? rows[i]! : null;
      const rowTop = blockTop + i * rowH;
      let rx = perRowStartX;
      drawCell(row ? row.taskName : "—", rx, rowTop, taskW * scaleFactor, rowH, "left", false, bg);
      rx += taskW * scaleFactor;
      drawCell(row ? row.hours.toFixed(2) : "-", rx, rowTop, hoursW * scaleFactor, rowH, "right", false, bg);
      rx += hoursW * scaleFactor;
      if (hasPieces) {
        drawCell(
          row && row.rateType === "piece" ? row.pieces.toFixed(2) : "-",
          rx,
          rowTop,
          piecesW * scaleFactor,
          rowH,
          "right",
          false,
          bg,
        );
        rx += piecesW * scaleFactor;
      }
      drawCell(row ? `$ ${row.rate.toFixed(2)}` : "-", rx, rowTop, rateW * scaleFactor, rowH, "right", false, bg);
      rx += rateW * scaleFactor;
      drawCell(row ? `$ ${row.cost.toFixed(2)}` : "-", rx, rowTop, totalPayW * scaleFactor, rowH, "right", false, bg);
    }
    colX +=
      taskW * scaleFactor + hoursW * scaleFactor + (hasPieces ? piecesW * scaleFactor : 0) + rateW * scaleFactor + totalPayW * scaleFactor;

    if (hasOT) {
      drawCell(
        e.otHours > 0 ? `${e.otHours.toFixed(2)} hrs` : "-",
        colX,
        blockTop,
        otHoursW * scaleFactor,
        blockH,
        "right",
        false,
        bg,
      );
      colX += otHoursW * scaleFactor;
      drawCell(
        e.otRate > 0 ? `$ ${e.otRate.toFixed(2)}/hr` : "-",
        colX,
        blockTop,
        otRateW * scaleFactor,
        blockH,
        "right",
        false,
        bg,
      );
      colX += otRateW * scaleFactor;
      drawCell(
        e.otPremium > 0 ? `$ ${e.otPremium.toFixed(2)}` : "-",
        colX,
        blockTop,
        otPremiumW * scaleFactor,
        blockH,
        "right",
        false,
        bg,
      );
      colX += otPremiumW * scaleFactor;
    }

    if (hasPieces) {
      drawCell(e.breaks > 0 ? `$ ${e.breaks.toFixed(2)}` : "-", colX, blockTop, breakW * scaleFactor, blockH, "right", false, bg);
      colX += breakW * scaleFactor;
      drawCell(e.minWage > 0 ? `$ ${e.minWage.toFixed(2)}` : "-", colX, blockTop, minWageW * scaleFactor, blockH, "right", false, bg);
      colX += minWageW * scaleFactor;
    }

    drawCell(`$ ${e.payReq.toFixed(2)}`, colX, blockTop, payReqW * scaleFactor, blockH, "right", true, bg);

    // Darker line marking the start and end of this worker's block
    doc.setDrawColor(107, 114, 128);
    doc.setLineWidth(0.6);
    doc.line(margin, blockTop, margin + fullTableW, blockTop);
    doc.line(margin, blockTop + blockH, margin + fullTableW, blockTop + blockH);

    y = blockTop + blockH;
  });

  y += 16;

  // ── TOTAL BASE LABOR COST (same content/layout as the old design PDF) ───
  const taskNameSet = new Set<string>();
  employees.forEach((emp) => emp.tasksSummary.forEach((t) => taskNameSet.add(t.taskName)));
  const uniqueTasks = Array.from(taskNameSet);

  if (uniqueTasks.length > 0) {
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

    const rightX = margin + halfW + 32;
    let ry = y;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Total Base Labor Cost", rightX, ry);
    ry += 14;

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
        doc.text(lbl, sx + widths[i]! / 2, ry + subRowH - 3, { align: "center" });
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
        doc.text(cell, sx + widths[i]! / 2, ry + subRowH - 3, { align: "center", maxWidth: widths[i]! - 4 });
        sx += widths[i]!;
      });
      ry += subRowH;
    };

    const drawSubRowSpanned = (label: string, value: string, bold = false) => {
      const spanW = col1W + col2W + col3W;
      doc.setFillColor(255, 255, 255);
      doc.rect(rightX, ry, spanW, subRowH, "F");
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.4);
      doc.rect(rightX, ry, spanW, subRowH);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(thFS);
      doc.setTextColor(0);
      doc.text(label, rightX + 4, ry + subRowH - 3, { maxWidth: spanW - 6 });
      const valX = rightX + spanW;
      doc.setFillColor(255, 255, 255);
      doc.rect(valX, ry, col4W, subRowH, "F");
      doc.setDrawColor(22, 163, 74);
      doc.rect(valX, ry, col4W, subRowH);
      doc.text(value, valX + col4W / 2, ry + subRowH - 3, { align: "center", maxWidth: col4W - 4 });
      ry += subRowH;
    };

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
      doc.text(value, valX + col4W / 2, ry + subRowH - 3, { align: "center", maxWidth: col4W - 4 });
      ry += subRowH;
    };

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
      drawSubRow([`Piece ${label}`, totalPcs.toFixed(2), `$ ${rate.toFixed(2)}`, `$ ${totalPay.toFixed(2)}`]);
    });

    const totalPaidRestBreaks = data.paidRestBreaks;
    const totalOtPremium = data.overtimePremium ?? 0;
    const totalMwTopUp = data.minimumWageTopUp;
    const totalSubtotal = data.subtotal;

    if (totalPaidRestBreaks > 0) {
      drawSubRowSpanned("Paid Rest Breaks", `$ ${totalPaidRestBreaks.toFixed(2)}`);
    }
    if (totalOtPremium > 0) {
      drawSubRowSpanned("Overtime Premium (0.5x rate)", `$ ${totalOtPremium.toFixed(2)}`);
    }
    if (totalMwTopUp > 0) {
      drawSubRowSpanned("Minimum Wage Adjustments", `$ ${totalMwTopUp.toFixed(2)}`);
    }

    drawSubTotalRow("Total Amount:", `$ ${totalSubtotal.toFixed(2)}`);
  }

  return doc.output("datauristring").split(",")[1]!;
}
