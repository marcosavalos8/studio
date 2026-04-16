import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { jsPDF } from "jspdf";

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
  laborCost?: number;
  minimumWageTopUp?: number;
  paidRestBreaks?: number;
  overtimePremium?: number;
  overtimeHours?: number;
  subtotal?: number;
  commission?: number;
  dailyBreakdown?: Record<string, InvoiceDayBreakdown>;
  invoiceClientData?: InvoiceClientData;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function generateInvoicePdf(body: SendInvoiceBody): string {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const clientData = body.invoiceClientData ?? {};
  const paymentDays = (() => {
    const match = (clientData.paymentTerms ?? "").match(/\d+/);
    return match ? parseInt(match[0], 10) : 30;
  })();

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(21, 128, 61); // green
  doc.text("INVOICE  |  J&M AGRICULTURAL LABOR LLC", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text("250 Country Heaven Loop, Pasco, WA 99301", margin, y);
  doc.text("Tel: 509-000-1111  |  Lic #: 172-25", margin, y + 12);
  y += 30;

  // ── Divider ──────────────────────────────────────────────────────────────
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  // ── Bill To + Invoice Meta ───────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Bill To:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(clientData.name ?? body.clientName, margin + 50, y);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice #:", pageWidth - margin - 160, y);
  doc.setFont("helvetica", "normal");
  doc.text(body.invoiceNumber, pageWidth - margin - 90, y);
  y += 13;

  if (clientData.billingAddress) {
    doc.setFont("helvetica", "bold");
    doc.text("Address:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(clientData.billingAddress, margin + 50, y);
  }
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Date:", pageWidth - margin - 160, y);
  doc.setFont("helvetica", "normal");
  doc.text(body.invoiceDate ?? "", pageWidth - margin - 90, y);
  y += 13;

  if (clientData.email) {
    doc.setFont("helvetica", "bold");
    doc.text("Email:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(clientData.email, margin + 50, y);
  }
  doc.setFont("helvetica", "bold");
  doc.text("Terms:", pageWidth - margin - 160, y);
  doc.setFont("helvetica", "normal");
  doc.text(clientData.paymentTerms ?? `Net ${paymentDays}`, pageWidth - margin - 90, y);
  y += 13;

  doc.setFont("helvetica", "bold");
  doc.text("Period:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${body.dateFrom} – ${body.dateTo}`, margin + 50, y);
  y += 18;

  // ── Table Header ─────────────────────────────────────────────────────────
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, contentWidth, 16, "F");
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentWidth, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0);
  const colDate = margin + 4;
  const colDesc = margin + 75;
  const colQty = margin + contentWidth - 180;
  const colUnit = margin + contentWidth - 110;
  const colPrice = margin + contentWidth - 65;
  const colTotal = margin + contentWidth - 4;
  doc.text("DATE", colDate, y + 11);
  doc.text("DESCRIPTION", colDesc, y + 11);
  doc.text("QTY", colQty + 30, y + 11, { align: "right" });
  doc.text("UNIT", colUnit + 24, y + 11, { align: "center" });
  doc.text("PRICE", colPrice + 35, y + 11, { align: "right" });
  doc.text("TOTAL", colTotal, y + 11, { align: "right" });
  y += 16;

  // ── Table Rows ────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let rowIdx = 0;

  const dailyBreakdown = body.dailyBreakdown ?? {};
  const sortedDates = Object.keys(dailyBreakdown).sort();

  for (const date of sortedDates) {
    const day = dailyBreakdown[date];
    for (const task of Object.values(day.tasks)) {
      const isHourly = task.clientRateType === "hourly";
      const quantity = isHourly ? task.hours : task.pieces;
      const unit = isHourly ? "Hrs" : "Pcs";

      if (rowIdx % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, y, contentWidth, 14, "F");
      }
      doc.setDrawColor(229, 231, 235);
      doc.rect(margin, y, contentWidth, 14);

      doc.setTextColor(0);
      doc.text(date, colDate, y + 10);
      doc.text(task.taskName, colDesc, y + 10);
      doc.text(quantity.toFixed(2), colQty + 30, y + 10, { align: "right" });
      doc.text(unit, colUnit + 24, y + 10, { align: "center" });
      doc.text(formatCurrency(task.clientRate), colPrice + 35, y + 10, { align: "right" });
      doc.text(formatCurrency(task.cost), colTotal, y + 10, { align: "right" });
      y += 14;
      rowIdx++;

      // Page overflow check
      if (y > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        y = margin;
      }
    }
  }

  y += 6;

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalsX = pageWidth - margin - 220;
  const totalsLabelX = totalsX;
  const totalsValueX = pageWidth - margin;
  const totalsWidth = 220;
  const rowH = 16;

  const addTotalRow = (label: string, value: number, bold = false, highlight = false) => {
    if (highlight) {
      doc.setFillColor(243, 244, 246);
      doc.rect(totalsX, y, totalsWidth, rowH, "F");
    }
    doc.setDrawColor(209, 213, 219);
    doc.rect(totalsX, y, totalsWidth, rowH);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9 : 8);
    doc.setTextColor(0);
    doc.text(label, totalsLabelX + 6, y + 11);
    doc.text(formatCurrency(value), totalsValueX - 4, y + 11, { align: "right" });
    y += rowH;
  };

  addTotalRow("Labor Cost", body.laborCost ?? 0);
  if ((body.minimumWageTopUp ?? 0) > 0) addTotalRow("Min. Wage Top-Up", body.minimumWageTopUp ?? 0);
  if ((body.paidRestBreaks ?? 0) > 0) addTotalRow("Paid Rest Breaks", body.paidRestBreaks ?? 0);
  if ((body.overtimePremium ?? 0) > 0) addTotalRow("OT Premium", body.overtimePremium ?? 0);
  addTotalRow("Subtotal", body.subtotal ?? 0);
  const commRate = clientData.commissionRate;
  addTotalRow(`Contractors Fee${commRate ? ` (${commRate}%)` : ""}`, body.commission ?? 0);
  addTotalRow("INVOICE TOTAL", body.total, true, true);

  y += 16;

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  const footerText = `All invoices are due and payable within ${paymentDays} calendar days from the invoice date. `
    + "Interest at 1.5% per month will accrue on overdue balances. "
    + "Contact: Jmagriculturalabor@outlook.com  |  Phone: 509-000-1111";
  const lines = doc.splitTextToSize(footerText, contentWidth);
  doc.text(lines, margin, y);

  return doc.output("datauristring").split(",")[1];
}

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
  const smtpUser = "m.a.a.g.3008@@gmail.com";
  const smtpPass = "fktg vwoc qqpi qkbq"; // Tu contraseña de aplicación de 16 letras

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
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
        <strong>J&M Agricultural Labor LLC</strong><br>
        Billing Department<br>
        Email: <a href="mailto:Jmagriculturalabor@outlook.com">Jmagriculturalabor@outlook.com</a><br>
        Phone: 509-000-1111<br>
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
