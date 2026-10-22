import { format } from "date-fns";
import type { Contract } from "@/lib/types";
import { parseLocalDate } from "@/lib/utils";
import { sanitizeContractHtml } from "./contract-template";

function escapeHtml(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return format(parseLocalDate(value), "MM/dd/yyyy");
  } catch {
    return value;
  }
}

// Opens the contract's clauses in a separate browser tab/window and prints
// it there, instead of trying to print the on-screen dialog in place.
// Dialogs are fixed-position overlays, and browsers don't reliably print
// fixed-position content across multiple pages — a fresh, plain document
// avoids that entirely and lets the browser's own pagination handle a
// contract of any length.
export function printContract(contract: Contract): void {
  const printWindow = window.open("", "_blank", "width=850,height=1100");
  if (!printWindow) {
    window.alert("Please allow pop-ups to print this contract.");
    return;
  }

  const metaRows: Array<[string, string]> = [
    ["Client", escapeHtml(contract.clientSnapshot.name)],
    ["Status", escapeHtml(contract.status)],
    ["Effective Date", fmtDate(contract.effectiveDate)],
    ["End Date", fmtDate(contract.endDate)],
    ["Billing Address", escapeHtml(contract.clientSnapshot.billingAddress)],
    ["Payment Terms", escapeHtml(contract.clientSnapshot.paymentTerms)],
  ];
  if (contract.paymentDueDays !== undefined) {
    metaRows.push(["Payment Due", `${contract.paymentDueDays} days`]);
  }
  if (contract.lateFeeInterestPercent !== undefined) {
    metaRows.push(["Late Fee Interest", `${contract.lateFeeInterestPercent}% / month`]);
  }
  if (contract.terminationNoticeDays !== undefined) {
    metaRows.push(["Termination Notice", `${contract.terminationNoticeDays} days`]);
  }
  if (contract.cancellationNoticeDays !== undefined) {
    metaRows.push(["Cancellation Notice", `${contract.cancellationNoticeDays} days`]);
  }
  if (contract.shortfallPenaltyPercent !== undefined) {
    metaRows.push(["Shortfall Penalty", `${contract.shortfallPenaltyPercent}%`]);
  }
  if (contract.shortfallFeePerWorkerDay !== undefined) {
    metaRows.push(["Fixed Fee ($/worker/day)", `$${contract.shortfallFeePerWorkerDay}`]);
  }

  const metaHtml = metaRows
    .map(
      ([label, value]) =>
        `<div class="meta-item"><div class="meta-label">${escapeHtml(label)}</div><div class="meta-value">${value}</div></div>`,
    )
    .join("");

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
  .doc-header { text-align: center; margin-bottom: 24px; }
  .doc-header h1 { font-size: 20px; margin: 0 0 4px; }
  .doc-header .folio { color: #555; font-size: 13px; }
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 24px;
    font-size: 12px;
    margin-bottom: 20px;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 14px 16px;
  }
  .meta-label { color: #666; }
  .meta-value { font-weight: 600; }
  hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
  .clauses h1 { font-size: 18px; text-align: center; margin: 8px 0 16px; }
  .clauses h2 { font-size: 14px; margin: 20px 0 8px; }
  .clauses h3 { font-size: 13px; margin: 16px 0 6px; }
  .clauses p { margin: 8px 0; line-height: 1.5; font-size: 12.5px; }
  .clauses ul, .clauses ol { margin: 6px 0 10px 20px; font-size: 12.5px; }
  .clauses li { margin: 3px 0; }
  @media print {
    body { padding: 0; }
    @page { margin: 0.75in; }
  }
</style>
</head>
<body>
  <div class="doc-header">
    <h1>${escapeHtml(contract.title)}</h1>
    <div class="folio">${escapeHtml(contract.contractNumber)}</div>
  </div>
  <div class="meta-grid">${metaHtml}</div>
  <hr />
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
