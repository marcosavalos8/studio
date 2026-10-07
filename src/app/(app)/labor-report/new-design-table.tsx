"use client";

import React from "react";
import type { DetailedLabelReportData } from "./page";

type Report = DetailedLabelReportData;
type Employee = NonNullable<Report["employeeDetails"]>[number];

type Row = {
  label: string;
  taskName: string;
  rateType: "hourly" | "piece";
  rate: number;
  hours: number;
  pieces: number;
  cost: number;
  quantity: number;
  missingBuckets: boolean;
};

const money = (value: number) =>
  `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const num = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Labor summaries label each task with its rate ("Name · $22.00"); the rate has its own column here.
const plainName = (label: string) => label.replace(/ · \$[\d.,]+$/, "");

function buildRows(emp: Employee): Row[] {
  const taskRows: Row[] = emp.tasksSummary.map((t) => ({
    label: t.taskName,
    taskName: plainName(t.taskName),
    rateType: t.rateType,
    rate: t.rate,
    hours: t.hours ?? (t.rateType === "hourly" ? t.quantity : 0),
    pieces: t.pieces ?? (t.rateType === "piece" ? t.quantity : 0),
    cost: t.cost,
    quantity: t.quantity,
    missingBuckets: false,
  }));
  const missingRows: Row[] = (emp.missingBucketsSummary ?? []).map((mb) => ({
    label: mb.taskName,
    taskName: `${plainName(mb.taskName)} (Missing Buckets ${mb.originalDate})`,
    rateType: mb.rateType,
    rate: mb.rate,
    hours: 0,
    pieces: mb.quantity,
    cost: mb.cost,
    quantity: mb.quantity,
    missingBuckets: true,
  }));
  return [...taskRows, ...missingRows].sort((a, b) => a.taskName.localeCompare(b.taskName));
}

// Only vertical column lines, plus horizontal lines around each worker's group.
const base = "px-2 py-1 border-l border-r border-gray-300";
const numeric = `${base} text-right tabular-nums`;
const headCell = "px-2 py-1 border-l border-r border-gray-300 border-y-2 border-y-gray-700 bg-green-100 font-semibold text-center";

function groupCell(cls: string, isFirst: boolean, isLast: boolean) {
  return [
    cls,
    isFirst ? "border-t border-t-gray-500" : "",
    isLast ? "border-b border-b-gray-500" : "",
  ].join(" ");
}

export function LaborNewDesignTable({ report }: { report: Report }) {
  const employees = (report.employeeDetails ?? []).map((emp) => {
    const rows = buildRows(emp);
    const totalPay = emp.tasksSummary.reduce((acc, t) => acc + t.cost, 0);
    const otHours = emp.overtimeHours ?? 0;
    const otPremium = emp.overtimePremium ?? 0;
    const otRate = emp.regularRate ?? (otHours > 0 ? otPremium / (0.5 * otHours) : 0);
    const breaks = emp.paidRestBreaks ?? 0;
    const minWage = emp.minimumWageTopUp ?? 0;
    return {
      emp,
      rows,
      otHours,
      otPremium,
      otRate,
      breaks,
      minWage,
      // Same PAY REQ formula the labor report already uses
      payReq: totalPay + breaks + minWage + otPremium,
    };
  });

  const hasPieces = employees.some((e) => e.rows.some((r) => r.rateType === "piece"));
  const hasOvertime = employees.some((e) => e.otHours > 0);

  // Per task, totals across all workers (same grouping as the labor report's Piece A, B, C…)
  const taskOrder: string[] = [];
  const taskTotals = new Map<string, { quantity: number; rate: number; cost: number }>();
  (report.employeeDetails ?? []).forEach((emp) => {
    [...emp.tasksSummary, ...(emp.missingBucketsSummary ?? [])].forEach((t) => {
      if (!taskTotals.has(t.taskName)) {
        taskOrder.push(t.taskName);
        taskTotals.set(t.taskName, { quantity: 0, rate: t.rate, cost: 0 });
      }
      const total = taskTotals.get(t.taskName)!;
      total.quantity += t.quantity;
      total.cost += t.cost;
    });
  });

  return (
    <div className="overflow-x-auto">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.4in; }
        }
      `}</style>
      <table className="w-full table-fixed border-collapse text-xs mt-4">
        <thead>
          <tr>
            <th className={headCell} style={{ width: "12%" }}>Worker Name</th>
            <th className={headCell} style={{ width: "22%" }}>Task/Description</th>
            <th className={headCell}>Hours</th>
            {hasPieces && <th className={headCell}>Pieces</th>}
            <th className={headCell}>Rate</th>
            <th className={headCell}>Total Pay</th>
            {hasOvertime && (
              <>
                <th className={headCell}>Overtime Hours</th>
                <th className={headCell}>Regular Rate for OT</th>
                <th className={headCell}>Overtime Premium (0.5x rate)</th>
              </>
            )}
            {hasPieces && <th className={headCell}>Break</th>}
            {hasPieces && <th className={headCell}>Min. Wage</th>}
            <th className={headCell}>PAY REQ</th>
          </tr>
        </thead>
        {employees.map((e, groupIdx) => {
          const rows: Array<Row | null> = e.rows.length > 0 ? e.rows : [null];
          const span = rows.length;
          const shade = groupIdx % 2 === 1 ? "bg-green-50/60" : "";
          return (
            <tbody
              key={e.emp.employeeId}
              className={shade}
              style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
            >
              {rows.map((row, idx) => {
                const first = idx === 0;
                const last = idx === span - 1;
                return (
                  <tr key={`${e.emp.employeeId}-${idx}`}>
                    {first && (
                      <td rowSpan={span} className={groupCell(`${base} font-medium align-top`, first, last)}>
                        {e.emp.employeeName}
                      </td>
                    )}
                    <td className={groupCell(base, first, last)}>{row ? row.taskName : "—"}</td>
                    <td className={groupCell(numeric, first, last)}>{row ? num(row.hours) : "—"}</td>
                    {hasPieces && (
                      <td className={groupCell(numeric, first, last)}>
                        {row && row.rateType === "piece" ? num(row.pieces) : "-"}
                      </td>
                    )}
                    <td className={groupCell(numeric, first, last)}>{row ? money(row.rate) : "—"}</td>
                    <td className={groupCell(numeric, first, last)}>{row ? money(row.cost) : "—"}</td>
                    {hasOvertime && first && (
                      <>
                        <td rowSpan={span} className={groupCell(numeric, first, last)}>
                          {e.otHours > 0 ? `${num(e.otHours)} hrs` : "-"}
                        </td>
                        <td rowSpan={span} className={groupCell(numeric, first, last)}>
                          {e.otRate > 0 ? `${money(e.otRate)}/hr` : "-"}
                        </td>
                        <td rowSpan={span} className={groupCell(numeric, first, last)}>
                          {e.otPremium > 0 ? money(e.otPremium) : "-"}
                        </td>
                      </>
                    )}
                    {hasPieces && first && (
                      <td rowSpan={span} className={groupCell(numeric, first, last)}>
                        {e.breaks > 0 ? money(e.breaks) : "-"}
                      </td>
                    )}
                    {hasPieces && first && (
                      <td rowSpan={span} className={groupCell(numeric, first, last)}>
                        {e.minWage > 0 ? money(e.minWage) : "-"}
                      </td>
                    )}
                    {first && (
                      <td rowSpan={span} className={groupCell(`${numeric} font-bold`, first, last)}>
                        {money(e.payReq)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>

      <div className="mt-6 max-w-xl">
        <h3 className="font-bold mb-2 text-[12px]">Total Base Labor Cost</h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${headCell} text-left`}>Pieces</th>
              <th className={headCell}>Total Pieces</th>
              <th className={headCell}>Rate</th>
              <th className={headCell}>Total Pay</th>
            </tr>
          </thead>
          <tbody>
            {taskOrder.map((label, idx) => {
              const total = taskTotals.get(label)!;
              return (
                <tr key={label}>
                  <td className={base}>Piece {String.fromCharCode(65 + idx)}</td>
                  <td className={numeric}>{num(total.quantity)}</td>
                  <td className={numeric}>{money(total.rate)}</td>
                  <td className={numeric}>{money(total.cost)}</td>
                </tr>
              );
            })}
            {(report.paidRestBreaks ?? 0) > 0 && (
              <tr>
                <td className={base} colSpan={3}>Paid Rest Breaks</td>
                <td className={numeric}>{money(report.paidRestBreaks)}</td>
              </tr>
            )}
            {(report.overtimePremium ?? 0) > 0 && (
              <tr>
                <td className={base} colSpan={3}>Overtime Premium (0.5x rate)</td>
                <td className={numeric}>{money(report.overtimePremium ?? 0)}</td>
              </tr>
            )}
            {(report.minimumWageTopUp ?? 0) > 0 && (
              <tr>
                <td className={base} colSpan={3}>Minimum Wage Adjustments</td>
                <td className={numeric}>{money(report.minimumWageTopUp)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td className={`${base} border-t-2 border-t-gray-700`} colSpan={3}>Total Amount:</td>
              <td className={`${numeric} border-t-2 border-t-gray-700`}>{money(report.subtotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
