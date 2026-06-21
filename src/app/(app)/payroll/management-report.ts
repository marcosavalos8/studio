import { parseLocalDateOrDateTime } from "@/lib/utils";
import { format } from "date-fns";
import type { Task, Client, Piecework, TimeEntry } from "@/lib/types";
import type { PayrollRangeData } from "./range-data";

export interface ManagementRow {
  date: string; // yyyy-MM-dd
  clientName: string;
  taskName: string;
  variety: string;
  rateType: "piece" | "hourly";
  price: number;
  quantity: number;
  total: number;
}

export interface ManagementReport {
  rows: ManagementRow[];
  totalQuantity: number;
  totalAmount: number;
}

/**
 * Builds the client-focused consolidated report: every piece recorded in the
 * range for the selected client(s), grouped by Date + Task + Variety + Rate Type
 * + Price, with Quantity = sum of pieces and Total = Quantity x Price (the same
 * piece-price precedence Payroll uses: piecePriceForPayroll ?? piecePrice).
 */
export function buildManagementReport(
  data: PayrollRangeData,
  selectedClientIds: Set<string>,
): ManagementReport {
  const taskMap = new Map<string, Task>(data.tasks.map((t) => [t.id, t]));
  const clientMap = new Map<string, Client>(data.clients.map((c) => [c.id, c]));

  // Accumulate by Date|Client|Task|Variety|RateType|Price
  const groups = new Map<string, ManagementRow>();

  const addPieces = (taskId: string, timestamp: unknown, pieces: number) => {
    if (!taskId || !pieces || pieces <= 0) return;
    const task = taskMap.get(taskId);
    if (!task) return;
    if (!selectedClientIds.has(task.clientId)) return;

    const ts = timestamp ? String(timestamp) : "";
    if (!ts) return;
    const date = format(parseLocalDateOrDateTime(ts), "yyyy-MM-dd");

    const client = clientMap.get(task.clientId);
    const clientName = client?.name ?? "Unknown Client";
    const variety = task.variety ?? "";
    const rateType = task.clientRateType;
    const price =
      rateType === "piece"
        ? (task.piecePriceForPayroll ?? task.piecePrice ?? 0)
        : (task.clientRateForPayroll ?? task.clientRate ?? 0);

    const key = `${date}|${task.clientId}|${task.name}|${variety}|${rateType}|${price}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += pieces;
      existing.total = existing.quantity * existing.price;
    } else {
      groups.set(key, {
        date,
        clientName,
        taskName: task.name,
        variety,
        rateType,
        price,
        quantity: pieces,
        total: pieces * price,
      });
    }
  };

  // Pieces from the piecework collection
  data.piecework.forEach((p: Piecework) => {
    addPieces(p.taskId, p.timestamp, p.pieceCount);
  });

  // Pieces recorded inside time entries (kept consistent with Payroll counting)
  data.timeEntries.forEach((t: TimeEntry) => {
    if (t.piecesWorked && t.piecesWorked > 0) {
      addPieces(t.taskId, t.timestamp, t.piecesWorked);
    }
  });

  const rows = Array.from(groups.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.clientName !== b.clientName)
      return a.clientName.localeCompare(b.clientName);
    if (a.taskName !== b.taskName) return a.taskName.localeCompare(b.taskName);
    return a.variety.localeCompare(b.variety);
  });

  const totalQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.total, 0);

  return { rows, totalQuantity, totalAmount };
}
