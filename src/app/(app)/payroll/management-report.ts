import { parseLocalDateOrDateTime } from "@/lib/utils";
import { roundToQuarterHour } from "@/lib/calculations";
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
  hours: number;
  total: number;
}

export interface ManagementReport {
  rows: ManagementRow[];
  totalQuantity: number;
  totalHours: number;
  totalAmount: number;
}

// Same rule Payroll uses: after 5 worked hours a 30 minute unpaid lunch is removed,
// and hours are rounded to the quarter hour.
function hoursWorked(entry: TimeEntry): number {
  if (!entry.timestamp || !entry.endTime || entry.isSickLeave) return 0;
  const start = parseLocalDateOrDateTime(String(entry.timestamp));
  const end = parseLocalDateOrDateTime(String(entry.endTime));
  let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (hours <= 0) return 0;
  if (hours > 5) hours -= 0.5;
  return roundToQuarterHour(hours);
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

  const addEntry = (taskId: string, timestamp: unknown, pieces: number, hours: number) => {
    if (!taskId || (pieces <= 0 && hours <= 0)) return;
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
      existing.hours += hours;
      existing.total = (rateType === "piece" ? existing.quantity : existing.hours) * existing.price;
    } else {
      groups.set(key, {
        date,
        clientName,
        taskName: task.name,
        variety,
        rateType,
        price,
        quantity: pieces,
        hours,
        total: (rateType === "piece" ? pieces : hours) * price,
      });
    }
  };

  // Pieces from the piecework collection
  data.piecework.forEach((p: Piecework) => {
    addEntry(p.taskId, p.timestamp, p.pieceCount, 0);
  });

  // Time entries: hours for every task, plus pieces recorded inside them
  data.timeEntries.forEach((t: TimeEntry) => {
    addEntry(t.taskId, t.timestamp, t.piecesWorked ?? 0, hoursWorked(t));
  });

  const rows = Array.from(groups.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.clientName !== b.clientName)
      return a.clientName.localeCompare(b.clientName);
    if (a.taskName !== b.taskName) return a.taskName.localeCompare(b.taskName);
    return a.variety.localeCompare(b.variety);
  });

  const totalQuantity = rows.reduce((sum, r) => sum + r.quantity, 0);
  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.total, 0);

  return { rows, totalQuantity, totalHours, totalAmount };
}
