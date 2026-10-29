"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { startOfDay, endOfDay, format } from "date-fns";
import { useFirestore } from "@/firebase";
import type { Client, Employee, Piecework, Task, TimeEntry } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useCompanyInfo } from "@/hooks/use-company-info";

const MIN_ROWS = 20;

type DailyRow = {
  employee: Employee;
  start: Date | null;
  end: Date | null;
  hours: number | null;
  pieces: number;
};

// Parses whatever shape Firestore gives back for a timestamp field
// (Firestore Timestamp, Date, or an ISO/compatible string) into a Date.
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  const maybeToDate = (value as { toDate?: () => Date }).toDate;
  if (typeof maybeToDate === "function") return maybeToDate.call(value);
  const parsed = new Date(value as string);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function modeOf(values: string[]): string | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  let best: string | undefined;
  let bestCount = -1;
  counts.forEach((count, v) => {
    if (count > bestCount) {
      bestCount = count;
      best = v;
    }
  });
  return best;
}

export default function PrintDailyListPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const dateParam = searchParams.get("date");
  const employeeIds = useMemo(
    () => (idsParam ? idsParam.split(",") : []),
    [idsParam],
  );
  const selectedDate = useMemo(() => {
    if (!dateParam) return new Date();
    const [year, month, day] = dateParam.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }, [dateParam]);

  const firestore = useFirestore();
  const { companyInfo } = useCompanyInfo();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rowsByEmployee, setRowsByEmployee] = useState<Map<string, DailyRow>>(
    new Map(),
  );
  const [headerInfo, setHeaderInfo] = useState<{
    client: string;
    location: string;
    variety: string;
    task: string;
  }>({ client: "", location: "", variety: "", task: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || employeeIds.length === 0) {
      setLoading(false);
      return;
    }
    const wantedIds = new Set(employeeIds);
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    const run = async () => {
      // Same "fetch the whole small collection, filter in code" pattern
      // already used by the (blank) Print Crew List page — employees/
      // tasks/clients are small collections, so this avoids one round
      // trip per selected worker.
      const [employeesSnap, tasksSnap, clientsSnap, timeSnap, pieceSnap] =
        await Promise.all([
          getDocs(collection(firestore, "employees")),
          getDocs(collection(firestore, "tasks")),
          getDocs(collection(firestore, "clients")),
          getDocs(
            query(
              collection(firestore, "time_entries"),
              where("timestamp", ">=", dayStart),
              where("timestamp", "<=", dayEnd),
            ),
          ),
          getDocs(
            query(
              collection(firestore, "piecework"),
              where("timestamp", ">=", dayStart),
              where("timestamp", "<=", dayEnd),
            ),
          ),
        ]);

      const allEmployees = employeesSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Employee,
      );
      const tasksById = new Map(
        tasksSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Task]),
      );
      const clientsById = new Map(
        clientsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Client]),
      );
      const timeEntries = timeSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as TimeEntry,
      );
      const piecework = pieceSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Piecework,
      );

      const found = allEmployees
        .filter((e) => wantedIds.has(e.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(found);

      // Start = earliest clock-in that day, End = latest clock-out that
      // day. Break entries are left out of start/end on purpose — there's
      // no reliable way to tell "left for lunch" from "came back" apart
      // from the two dedicated Lunch columns, so this fills only what can
      // be read unambiguously from the raw records: Start, End, Hours
      // (End − Start, exactly what's printed, not a hidden break
      // deduction), and Pieces. Lunch In / Lunch Out stay blank, same as
      // the original sheet, for a foreman to fill by hand if needed.
      const map = new Map<string, DailyRow>();
      found.forEach((employee) => {
        map.set(employee.id, {
          employee,
          start: null,
          end: null,
          hours: null,
          pieces: 0,
        });
      });

      const taskIdsSeen: string[] = [];

      timeEntries.forEach((entry) => {
        if (!wantedIds.has(entry.employeeId)) return;
        const row = map.get(entry.employeeId);
        if (!row) return;
        if (entry.taskId) taskIdsSeen.push(entry.taskId);
        if (entry.isBreak) return;
        const start = toDate(entry.timestamp);
        const end = toDate(entry.endTime);
        if (start && (!row.start || start < row.start)) row.start = start;
        if (end && (!row.end || end > row.end)) row.end = end;
        if (entry.piecesWorked) row.pieces += entry.piecesWorked;
      });

      piecework.forEach((entry) => {
        if (!wantedIds.has(entry.employeeId)) return;
        const row = map.get(entry.employeeId);
        if (!row) return;
        if (entry.taskId) taskIdsSeen.push(entry.taskId);
        row.pieces += entry.pieceCount || 0;
      });

      map.forEach((row) => {
        if (row.start && row.end) {
          row.hours = Math.max(
            0,
            (row.end.getTime() - row.start.getTime()) / (1000 * 60 * 60),
          );
        }
      });
      setRowsByEmployee(new Map(map));

      const majorityTaskId = modeOf(taskIdsSeen);
      const majorityTask = majorityTaskId
        ? tasksById.get(majorityTaskId)
        : undefined;
      const majorityClient = majorityTask
        ? clientsById.get(majorityTask.clientId)
        : undefined;
      setHeaderInfo({
        client: majorityClient?.name ?? "",
        location: [majorityTask?.ranch, majorityTask?.block]
          .filter(Boolean)
          .join(" · "),
        variety: majorityTask?.variety ?? "",
        task: majorityTask?.name ?? "",
      });

      setLoading(false);
    };

    run().catch(() => setLoading(false));
  }, [firestore, employeeIds, selectedDate]);

  const rowCount = Math.max(MIN_ROWS, employees.length);
  const rows = Array.from({ length: rowCount }, (_, i) => employees[i] ?? null);
  const totalHours = Array.from(rowsByEmployee.values()).reduce(
    (sum, r) => sum + (r.hours ?? 0),
    0,
  );
  const totalPieces = Array.from(rowsByEmployee.values()).reduce(
    (sum, r) => sum + r.pieces,
    0,
  );

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media screen {
          body { margin: 0 !important; padding: 0 !important; background: #f5f5f5 !important; }
          nav, header, footer, aside,
          [data-sidebar], [data-sidebar-provider],
          .sidebar, .app-header, .app-sidebar { display: none !important; }
        }
        @media print {
          @page { size: letter portrait; margin: 0.4in; }
          .print-controls { display: none !important; }
          body * { visibility: hidden !important; }
          .crew-list-root, .crew-list-root * { visibility: visible !important; }
          .crew-list-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 0 !important; box-sizing: border-box !important; filter: grayscale(1) !important; }
          body { margin: 0 !important; padding: 0 !important; background: white !important; }
        }
        .print-controls {
          position: fixed; top: 20px; right: 20px; z-index: 1000;
          background: white; padding: 16px 24px; border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex;
          flex-direction: column; gap: 12px; align-items: center;
        }
        .print-button {
          background: #ea580c; color: white; border: none;
          padding: 12px 24px; border-radius: 6px; font-size: 16px;
          font-weight: 600; cursor: pointer; display: flex;
          align-items: center; gap: 8px;
        }
        .print-button:hover { background: #c2410c; }
        .print-button:disabled { background: #d1d5db; cursor: not-allowed; }
        .crew-list-root {
          width: 100%; background: white; min-height: 100vh;
          padding: 24px; box-sizing: border-box; font-family: Arial, sans-serif; color: #111827;
        }
        .crew-head-cell {
          background: white; color: #111827; text-align: left; border: none; padding: 0 0 8px 0;
          text-transform: none; font-size: 11px; letter-spacing: normal;
        }
        .crew-header {
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          border-bottom: 3px solid #15803d; padding-bottom: 10px; margin-bottom: 12px;
        }
        .crew-company-name { font-size: 18px; font-weight: bold; color: #15803d; }
        .crew-title {
          text-align: center; font-size: 15px; font-weight: bold; letter-spacing: 0.06em;
          text-transform: uppercase; margin: 0 0 10px; color: #14532d;
        }
        .crew-meta {
          width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px;
        }
        .crew-meta td { border: 1px solid #9ca3af; padding: 7px 8px; }
        .crew-meta td.label { font-weight: bold; width: 18%; background: #f3f4f6; }
        .crew-table {
          width: 100%; border-collapse: collapse; font-size: 11px;
        }
        .crew-table thead { display: table-header-group; }
        .crew-table tfoot { display: table-footer-group; }
        .crew-table tr { page-break-inside: avoid; }
        .crew-table th, .crew-table td {
          border: 1px solid #9ca3af; padding: 5px 6px; text-align: left;
        }
        .crew-table thead tr:not(:first-child) th {
          background: #15803d; color: white; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .crew-table td.num { width: 4%; text-align: center; color: #6b7280; }
        .crew-table td.emp { width: 12%; }
        .crew-table td.time, .crew-table th.time { width: 9%; text-align: center; }
        .crew-table td.bins, .crew-table th.bins { width: 7%; text-align: center; }
        .crew-table td.name { width: 27%; }
        .crew-table tbody tr:nth-child(even) td { background: #f9fafb; }
        .crew-table tbody tr.row { height: 26px; }
        .crew-table .foot-cell { font-weight: bold; background: #f3f4f6; padding: 8px; }
        .crew-table .sign-cell { padding-top: 26px; border-top: 1px solid #111827; border-left: none; border-right: none; border-bottom: none; font-size: 11px; }
      `,
        }}
      />

      <div className="print-controls">
        <button
          className="print-button"
          onClick={() => window.print()}
          disabled={loading}
        >
          <Printer size={20} />
          {loading ? "Loading..." : "Print Daily List"}
        </button>
      </div>

      <div className="crew-list-root">
        <table className="crew-table">
          <thead>
            <tr>
              <th colSpan={9} className="crew-head-cell">
                <div className="crew-header">
                  <img
                    src="/logo.jpeg"
                    alt="Logo"
                    style={{ width: "80px", height: "64px", objectFit: "contain" }}
                  />
                  <div className="crew-company-name">{companyInfo.companyName}</div>
                </div>
                <div className="crew-title">Daily Crew Sheet</div>
                <table className="crew-meta">
                  <tbody>
                    <tr>
                      <td className="label">Date:</td>
                      <td>{format(selectedDate, "MM/dd/yyyy")}</td>
                      <td className="label">Grower / Orchard:</td>
                      <td>{headerInfo.client}</td>
                    </tr>
                    <tr>
                      <td className="label">Location / Block:</td>
                      <td>{headerInfo.location}</td>
                      <td className="label">Variety:</td>
                      <td>{headerInfo.variety}</td>
                    </tr>
                    <tr>
                      <td className="label">Crew Leader:</td>
                      <td></td>
                      <td className="label">Number of Workers:</td>
                      <td>{employees.length || ""}</td>
                    </tr>
                    <tr>
                      <td className="label">Task:</td>
                      <td colSpan={3}>{headerInfo.task}</td>
                    </tr>
                  </tbody>
                </table>
              </th>
            </tr>
            <tr>
              <th className="num">#</th>
              <th className="emp">Emp #</th>
              <th className="name">Employee Name</th>
              <th className="time">Start</th>
              <th className="time">Lunch In</th>
              <th className="time">Lunch Out</th>
              <th className="time">End</th>
              <th className="time">Hours</th>
              <th className="bins">Pieces</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((emp, i) => {
              const row = emp ? rowsByEmployee.get(emp.id) : undefined;
              return (
                <tr className="row" key={emp?.id ?? `blank-${i}`}>
                  <td className="num">{i + 1}</td>
                  <td className="emp">{emp?.employeeNumber || ""}</td>
                  <td className="name">{emp?.name || ""}</td>
                  <td className="time">{row?.start ? format(row.start, "h:mm a") : ""}</td>
                  <td className="time"></td>
                  <td className="time"></td>
                  <td className="time">{row?.end ? format(row.end, "h:mm a") : ""}</td>
                  <td className="time">
                    {row?.hours !== null && row?.hours !== undefined
                      ? row.hours.toFixed(2)
                      : ""}
                  </td>
                  <td className="bins">{row && row.pieces > 0 ? row.pieces : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="foot-cell">
                Total Workers: {employees.length || ""}
              </td>
              <td colSpan={4} className="foot-cell">
                Total Hours: {totalHours > 0 ? totalHours.toFixed(2) : ""}
              </td>
            </tr>
            <tr>
              <td colSpan={5} className="foot-cell">
                Total Pieces: {totalPieces > 0 ? totalPieces : ""}
              </td>
              <td colSpan={4} className="foot-cell"></td>
            </tr>
            <tr>
              <td colSpan={5} className="sign-cell">
                Crew Leader Signature
              </td>
              <td colSpan={4} className="sign-cell">
                Date
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
