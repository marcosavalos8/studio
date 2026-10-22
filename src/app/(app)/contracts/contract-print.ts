import type { Contract } from "@/lib/types";
import { sanitizeContractHtml } from "./contract-template";

function escapeHtml(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Opens the contract's clauses in a separate browser tab/window and prints
// it there, instead of trying to print the on-screen dialog in place.
// Dialogs are fixed-position overlays, and browsers don't reliably print
// fixed-position content across multiple pages — a fresh, plain document
// avoids that entirely and lets the browser's own pagination handle a
// contract of any length.
//
// Prints the clauses exactly as written — no extra folio/status/dates
// header above it. The clauses themselves already open with the contract's
// own title and company line (from the template or however the user wrote
// it), so the printed page starts there, not with app-generated metadata.
export function printContract(contract: Contract): void {
  const printWindow = window.open("", "_blank", "width=850,height=1100");
  if (!printWindow) {
    window.alert("Please allow pop-ups to print this contract.");
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(contract.contractNumber)} - ${escapeHtml(contract.title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: #111;
    max-width: 800px;
    margin: 0 auto;
    padding: 48px 32px;
  }
  .clauses h1 { font-size: 18px; text-align: center; margin: 8px 0 16px; }
  .clauses h2 { font-size: 14px; margin: 20px 0 8px; }
  .clauses h3 { font-size: 13px; margin: 16px 0 6px; }
  .clauses p { margin: 8px 0; line-height: 1.5; font-size: 12.5px; }
  .clauses ul, .clauses ol { margin: 6px 0 10px 20px; font-size: 12.5px; }
  .clauses li { margin: 3px 0; }
  .clauses .text-center { text-align: center; }
  @media print {
    body { padding: 0; }
    @page { margin: 0.75in; }
  }
</style>
</head>
<body>
  <div class="clauses">${sanitizeContractHtml(contract.clauses)}</div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}
