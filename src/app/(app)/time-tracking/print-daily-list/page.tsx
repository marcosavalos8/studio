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

// Also doubles as "pad a short list up to one full page" — unchanged from
// the original behavior, just now also the chunk size each physical page
// is split into (see the pages/pageRows logic below).
const ROWS_PER_PAGE = 20;

type DailyRow = {
  employee: Employee;
  start: Date | null;
  end: Date | null;
  hours: number | null;
  pieces: number;
  // Only true when this worker's own raw span (End − Start, before any
  // lunch deduction) is over 5 hours — same threshold as the "after 5
  // hours, a break applies" rule elsewhere. A short day (e.g. 2.5 hours)
  // couldn't plausibly have included the crew's shared lunch, so the
  // Lunch In/Out columns stay blank for that row instead of showing a
  // lunch time that didn't apply to them.
  lunchApplies: boolean;
};

type PrintGroup = {
  clientId: string;
  employeeIds: string[];
  lunchIn: string;
  lunchOut: string;
};

type GroupResult = {
  clientId: string;
  employees: Employee[];
  rowsByEmployee: Map<string, DailyRow>;
  lunchInDisplay: string;
  lunchOutDisplay: string;
  headerInfo: { client: string; location: string; variety: string; task: string };
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

// "HH:mm" (from a <input type="time">) -> "h:mm a" for display.
function formatLunchTime(value: string): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const d = new Date(2000, 0, 1, h, m);
  return format(d, "h:mm a");
}

// "HH:mm" -> a Date on `base`'s calendar day, for comparing against clock
// timestamps.
function parseClockTime(value: string, base: Date): Date | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
}

export default function PrintDailyListPage() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const groupsParam = searchParams.get("groups");

  const selectedDate = useMemo(() => {
    if (!dateParam) return new Date();
    const [year, month, day] = dateParam.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }, [dateParam]);

  // One sheet per client group — each its own Lunch In/Out, Grower/Orchard,
  // etc. — all printed together as one job (see the "page" CSS class
  // below), instead of one browser tab per client. Opening several tabs
  // from one click gets the later ones blocked as pop-ups by most
  // browsers past the first, which is exactly the "has to print twice"
  // problem this replaces.
  const groups = useMemo<PrintGroup[]>(() => {
    if (!groupsParam) return [];
    try {
      const parsed = JSON.parse(groupsParam);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (g): g is PrintGroup =>
          g && typeof g.clientId === "string" && Array.isArray(g.employeeIds),
      );
    } catch {
      return [];
    }
  }, [groupsParam]);

  const firestore = useFirestore();
  const { companyInfo } = useCompanyInfo();
  const [groupResults, setGroupResults] = useState<GroupResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || groups.length === 0) {
      setLoading(false);
      return;
    }
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    const run = async () => {
      // Same "fetch the whole small collection, filter in code" pattern
      // already used by the (blank) Print Crew List page — employees/
      // tasks/clients are small collections, so this avoids one round
      // trip per selected worker, done once for every group instead of
      // once per group.
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

      const results: GroupResult[] = groups.map((group) => {
        const wantedIds = new Set(group.employeeIds);
        const employees = allEmployees
          .filter((e) => wantedIds.has(e.id))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Start = earliest clock-in that day, End = latest clock-out that
        // day. Break entries are left out of start/end on purpose —
        // there's no reliable way to tell "left for lunch" from "came
        // back" apart from the two dedicated Lunch columns, so this fills
        // only what can be read unambiguously from the raw records:
        // Start, End, Hours (End − Start minus the entered lunch, not a
        // hidden/assumed deduction), and Pieces.
        const map = new Map<string, DailyRow>();
        employees.forEach((employee) => {
          map.set(employee.id, {
            employee,
            start: null,
            end: null,
            hours: null,
            pieces: 0,
            lunchApplies: false,
          });
        });

        const taskIdsSeen: string[] = [];
        const matchesClient = (taskId: string) =>
          tasksById.get(taskId)?.clientId === group.clientId;

        timeEntries.forEach((entry) => {
          if (!wantedIds.has(entry.employeeId)) return;
          if (!matchesClient(entry.taskId)) return;
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
          if (!matchesClient(entry.taskId)) return;
          const row = map.get(entry.employeeId);
          if (!row) return;
          if (entry.taskId) taskIdsSeen.push(entry.taskId);
          row.pieces += entry.pieceCount || 0;
        });

        // When this group's Lunch In/Out was entered, subtract it from the
        // raw End − Start span so Hours reads as net worked time — but
        // only for a worker whose own raw span is over 5 hours (same
        // threshold as the "after 5 hours, a break applies" rule). A
        // worker who only clocked 2.5 hours couldn't plausibly have taken
        // the crew's lunch, so their Lunch In/Out columns stay blank and
        // their Hours stays the full raw span, not force-subtracted.
        map.forEach((row) => {
          if (row.start && row.end) {
            const rawMs = row.end.getTime() - row.start.getTime();
            const rawHours = rawMs / (1000 * 60 * 60);
            let ms = rawMs;
            if (rawHours > 5) {
              const lunchStart = parseClockTime(group.lunchIn, selectedDate);
              const lunchEnd = parseClockTime(group.lunchOut, selectedDate);
              if (
                lunchStart &&
                lunchEnd &&
                lunchEnd > lunchStart &&
                lunchStart >= row.start &&
                lunchEnd <= row.end
              ) {
                ms -= lunchEnd.getTime() - lunchStart.getTime();
                row.lunchApplies = true;
              }
            }
            row.hours = Math.max(0, ms / (1000 * 60 * 60));
          }
        });

        const majorityTaskId = modeOf(taskIdsSeen);
        const majorityTask = majorityTaskId ? tasksById.get(majorityTaskId) : undefined;
        const majorityClient = majorityTask ? clientsById.get(majorityTask.clientId) : undefined;
        const filteredClient = clientsById.get(group.clientId);

        return {
          clientId: group.clientId,
          employees,
          rowsByEmployee: map,
          lunchInDisplay: formatLunchTime(group.lunchIn),
          lunchOutDisplay: formatLunchTime(group.lunchOut),
          headerInfo: {
            client: filteredClient?.name ?? majorityClient?.name ?? "",
            location: [majorityTask?.ranch, majorityTask?.block].filter(Boolean).join(" · "),
            variety: majorityTask?.variety ?? "",
            task: majorityTask?.name ?? "",
          },
        };
      });

      setGroupResults(results);
      setLoading(false);
    };

    run().catch(() => setLoading(false));
  }, [firestore, groups, selectedDate]);

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
        .crew-sheet-page + .crew-sheet-page { page-break-before: always; margin-top: 24px; }
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
        <button className="print-button" onClick={() => window.print()} disabled={loading}>
          <Printer size={20} />
          {loading ? "Loading..." : `Print ${groupResults.length > 1 ? "All Lists" : "Daily List"}`}
        </button>
      </div>

      <div className="crew-list-root">
        {groupResults.map((group) => {
          const totalHours = Array.from(group.rowsByEmployee.values()).reduce(
            (sum, r) => sum + (r.hours ?? 0),
            0,
          );
          const totalPieces = Array.from(group.rowsByEmployee.values()).reduce(
            (sum, r) => sum + r.pieces,
            0,
          );

          // Relying on the browser to repeat <thead>/<tfoot> on each
          // printed page (via display: table-header-group) turned out
          // unreliable once the header row holds a logo + nested meta
          // table — some print engines (notably mobile "Save as PDF")
          // just drop it on continuation pages. Instead, every physical
          // page is its own complete, self-contained <table> with the
          // full header repeated explicitly — that always works,
          // regardless of print engine.
          const rowCount = Math.max(ROWS_PER_PAGE, group.employees.length);
          const allRows = Array.from({ length: rowCount }, (_, i) => group.employees[i] ?? null);
          const pages: Array<typeof allRows> = [];
          for (let i = 0; i < allRows.length; i += ROWS_PER_PAGE) {
            pages.push(allRows.slice(i, i + ROWS_PER_PAGE));
          }

          return pages.map((pageRows, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;
            return (
              <div className="crew-sheet-page" key={`${group.clientId}-${pageIndex}`}>
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
                        <div className="crew-title">
                          Daily Crew Sheet
                          {pages.length > 1 ? ` (Page ${pageIndex + 1} of ${pages.length})` : ""}
                        </div>
                        <table className="crew-meta">
                          <tbody>
                            <tr>
                              <td className="label">Date:</td>
                              <td>{format(selectedDate, "MM/dd/yyyy")}</td>
                              <td className="label">Grower / Orchard:</td>
                              <td>{group.headerInfo.client}</td>
                            </tr>
                            <tr>
                              <td className="label">Location / Block:</td>
                              <td>{group.headerInfo.location}</td>
                              <td className="label">Variety:</td>
                              <td>{group.headerInfo.variety}</td>
                            </tr>
                            <tr>
                              <td className="label">Crew Leader:</td>
                              <td></td>
                              <td className="label">Number of Workers:</td>
                              <td>{group.employees.length || ""}</td>
                            </tr>
                            <tr>
                              <td className="label">Task:</td>
                              <td colSpan={3}>{group.headerInfo.task}</td>
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
                    {pageRows.map((emp, i) => {
                      const row = emp ? group.rowsByEmployee.get(emp.id) : undefined;
                      return (
                        <tr className="row" key={emp?.id ?? `blank-${pageIndex}-${i}`}>
                          <td className="num">{pageIndex * ROWS_PER_PAGE + i + 1}</td>
                          <td className="emp">{emp?.employeeNumber || ""}</td>
                          <td className="name">{emp?.name || ""}</td>
                          <td className="time">{row?.start ? format(row.start, "h:mm a") : ""}</td>
                          <td className="time">
                            {!emp ? "" : row?.lunchApplies ? group.lunchInDisplay : "-"}
                          </td>
                          <td className="time">
                            {!emp ? "" : row?.lunchApplies ? group.lunchOutDisplay : "-"}
                          </td>
                          <td className="time">{row?.end ? format(row.end, "h:mm a") : ""}</td>
                          <td className="time">
                            {row?.hours !== null && row?.hours !== undefined
                              ? row.hours.toFixed(2)
                              : ""}
                          </td>
                          <td className="bins">
                            {!emp ? "" : row && row.pieces > 0 ? row.pieces.toFixed(2) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {isLastPage && (
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="foot-cell">
                          Total Workers: {group.employees.length || ""}
                        </td>
                        <td colSpan={4} className="foot-cell">
                          Total Hours: {totalHours > 0 ? totalHours.toFixed(2) : ""}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="foot-cell">
                          Total Pieces: {totalPieces > 0 ? totalPieces.toFixed(2) : ""}
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
                  )}
                </table>
              </div>
            );
          });
        })}
      </div>
    </>
  );
}
