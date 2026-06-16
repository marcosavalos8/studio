import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminFirestore } from "@/lib/firebase-admin";

// ─── types ─────────────────────────────────────────────────────────────────

interface StoredInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientEmail?: string | null;
  dateFrom: string;
  dateTo: string;
  subtotal: number;
  commission: number;
  total: number;
  overdueInterestAccrued?: number;
  status: string;
  invoiceClientData?: {
    paymentTerms?: string;
  };
}

// ─── helpers ───────────────────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Parse "MM/dd/yyyy" → Date at midnight local time */
function parseInvoiceDate(dateStr: string): Date | null {
  const parts = dateStr?.split("/");
  if (!parts || parts.length !== 3) return null;
  const [month, day, year] = parts.map(Number);
  if (!month || !day || !year) return null;
  return new Date(year, month - 1, day);
}

/** Compute due date from invoiceDate + payment terms */
function computeDueDate(invoice: StoredInvoice): Date | null {
  const base = parseInvoiceDate(invoice.invoiceDate);
  if (!base) return null;
  const paymentTerms = invoice.invoiceClientData?.paymentTerms ?? "";
  const match = paymentTerms.match(/\d+/);
  const days = match ? parseInt(match[0], 10) : 30;
  const due = new Date(base);
  due.setDate(due.getDate() + days);
  return due;
}

function formatDateMDY(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

/** Returns the number of days from todayMidnight to dueDateMidnight */
function daysUntilDue(dueDate: Date): number {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueMidnight = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );
  return Math.floor(
    (dueMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24),
  );
}

// ─── route handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Secure the endpoint with a shared secret to prevent unauthorized calls
  const secret = request.headers.get("x-reminder-secret");
  const expectedSecret = process.env.REMINDER_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminFirestore();
  if (!db) {
    return NextResponse.json(
      {
        error:
          "Firebase Admin SDK is not available. Cannot access Firestore server-side.",
      },
      { status: 503 },
    );
  }

  // Fetch company info from Firestore (fallback to defaults)
  const defaultCo = {
    companyName: "J&M AGRICULTURAL LABOR LLC",
    email: "Jmagriculturalabor@outlook.com",
    phone: "509.380.3385",
    address: "250 Country Heaven Loop, Pasco, WA 99301",
    ein: "33-2236422",
    ubi: "605 650 411",
  };
  let co = defaultCo;
  try {
    const coSnap = await db.collection("company_settings").doc("info").get();
    if (coSnap.exists) co = { ...defaultCo, ...(coSnap.data() as typeof defaultCo) };
  } catch { /* use defaults */ }

  // Fetch all non-paid invoices
  const snapshot = await db
    .collection("invoices")
    .where("status", "!=", "paid")
    .get();

  const smtpUser = "jmagriculturalaborinvoicing@gmail.com";
  const smtpPass = process.env.SMTP_PASS;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const results: { invoiceNumber: string; status: string; error?: string }[] = [];

  for (const docSnap of snapshot.docs) {
    const invoice = docSnap.data() as StoredInvoice;

    // Skip if no email
    if (!invoice.clientEmail) continue;

    const dueDate = computeDueDate(invoice);
    if (!dueDate) continue;

    const days = daysUntilDue(dueDate);
    // Only send when exactly 1 day remains
    if (days !== 1) continue;

    const dueDateStr = formatDateMDY(dueDate);
    const issueDateStr = invoice.invoiceDate ?? "—";
    // invoice.total already incorporates subtotal + commission + any overdueInterestAccrued
    const totalDue = invoice.total;
    const safeNum = escapeHtml(invoice.invoiceNumber);
    const safeName = escapeHtml(invoice.clientName);
    const safeDue = escapeHtml(dueDateStr);
    const safeIssue = escapeHtml(issueDateStr);
    const safeTotal = escapeHtml(`$${totalDue.toFixed(2)}`);

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
        <p>Dear ${safeName},</p>
        <p>I hope this email finds you well.</p>
        <p>This is a friendly reminder that Invoice <strong>#${safeNum}</strong>, issued on <strong>${safeIssue}</strong>,
        is scheduled to reach its due date tomorrow, <strong>${safeDue}</strong>.</p>
        <p>To ensure your account remains current and to avoid any automatic late fees, please make arrangements
        for the payment of <strong>${safeTotal}</strong> by tomorrow.</p>

        <div style="background-color:#fff8e1;border-left:4px solid #f59e0b;padding:14px 18px;margin:20px 0;">
          <strong>Important Note regarding Late Payments:</strong><br>
          Please be advised that payments received after the due date will incur a <strong>1% monthly late fee</strong>.
          This fee is calculated on a daily basis (0.033% per day) for each day the payment is overdue, ensuring
          you are only charged for the exact duration of the delay.
        </div>

        <p><strong>Summary Details:</strong></p>
        <ul>
          <li>Invoice Number: <strong>#${safeNum}</strong></li>
          <li>Amount Due: <strong>${safeTotal}</strong></li>
          <li>Due Date: <strong>${safeDue}</strong></li>
        </ul>

        <p>If you have already sent the payment, please disregard this notice.
        If you have any questions or need assistance regarding this invoice, feel free to reach out.</p>

        <p>Thank you for your business!</p>

        <p style="margin-top:30px;">
          Best regards,<br>
          <strong>${co.companyName}</strong><br>
          Billing Department<br>
          Email: <a href="mailto:${co.email}">${co.email}</a><br>
          Phone: ${co.phone}<br>
          License #: 172-25<br>
          ${co.address}
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"${co.companyName}" <${smtpUser}>`,
        to: invoice.clientEmail,
        subject: `Reminder: Invoice #${invoice.invoiceNumber} is due tomorrow`,
        html,
      });
      results.push({ invoiceNumber: invoice.invoiceNumber, status: "sent" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to send reminder for invoice ${invoice.invoiceNumber}:`, err);
      results.push({ invoiceNumber: invoice.invoiceNumber, status: "error", error: msg });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}
