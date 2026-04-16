import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

interface SendInvoiceBody {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientEmail: string;
  dateFrom: string;
  dateTo: string;
  total: number;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function POST(request: Request) {
  let body: SendInvoiceBody;
  try {
    body = (await request.json()) as SendInvoiceBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { invoiceNumber, invoiceDate, clientName, clientEmail, dateFrom, dateTo, total } = body;

  if (!clientEmail) {
    return NextResponse.json({ error: "clientEmail is required" }, { status: 400 });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return NextResponse.json(
      { error: "Email service not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables." },
      { status: 503 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const formattedTotal = `$${(total ?? 0).toFixed(2)}`;

  // Escape all user-provided values to prevent HTML injection
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeInvoiceDate = escapeHtml(invoiceDate);
  const safeClientName = escapeHtml(clientName);
  const safeDateFrom = escapeHtml(dateFrom);
  const safeDateTo = escapeHtml(dateTo);
  const safeTotal = escapeHtml(formattedTotal);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">Invoice #${safeInvoiceNumber}</h2>
      <p>Estimado/a <strong>${safeClientName}</strong>,</p>
      <p>Adjuntamos el detalle de su invoice correspondiente al período indicado.</p>
      <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background:#f5f5f5;">
          <td style="padding:8px; border:1px solid #ddd;"><strong>Invoice #</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">${safeInvoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;"><strong>Fecha de invoice</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">${safeInvoiceDate}</td>
        </tr>
        <tr style="background:#f5f5f5;">
          <td style="padding:8px; border:1px solid #ddd;"><strong>Período</strong></td>
          <td style="padding:8px; border:1px solid #ddd;">${safeDateFrom} – ${safeDateTo}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;"><strong>Total</strong></td>
          <td style="padding:8px; border:1px solid #ddd; font-size: 1.1em; font-weight: bold;">${safeTotal}</td>
        </tr>
      </table>
      <p style="color:#555; font-size:0.9em;">Por favor, realice el pago de acuerdo a sus términos acordados.</p>
      <p style="color:#555; font-size:0.9em;">Gracias por su preferencia.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: clientEmail,
      subject: `Invoice #${invoiceNumber} – ${clientName}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error sending invoice email:", err);
    return NextResponse.json(
      { error: "Failed to send email. Check server SMTP configuration." },
      { status: 500 }
    );
  }
}
