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
  dueDate: string; // Añadimos fecha de vencimiento
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
  const safeDueDate = escapeHtml(dueDate);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
      <p>Hello,</p>
      <p>Please find attached invoice <strong>#${safeInvoiceNumber}</strong> for the agricultural labor services provided during the past week.</p>
      <p>The total amount due is <strong>$${safeTotal}</strong>, with a due date of <strong>${safeDueDate}</strong>.</p>
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

  try {
    await transporter.sendMail({
      from: `"J&M Agricultural Labor LLC" <${smtpUser}>`,
      to: clientEmail,
      subject: `Invoice ${invoiceNumber} from J&M Agricultural Labor LLC`,
      html,
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
