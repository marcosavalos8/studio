"use client";

import React from "react";
import type { DetailedLabelReportData } from "./page";

type Report = DetailedLabelReportData;
type Employee = NonNullable<Report["employeeDetails"]>[number];

type Row = {
  taskName: string;
  rateType: "hourly" | "piece";
  rate: number;
  hours: number;
  pieces: number;
  cost: number;
  missingBuckets: boolean;
};

const money = (value: number) =>
  `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const num = (value: number) => value.toFixed(2);

// Labor summaries label each task with its rate ("Name · $22.00"); the rate has its own column here.
const plainName = (label: string) => label.replace(/ · \$[\d.,]+$/, "");

function buildRows(emp: Employee): Row[] {
  const taskRows: Row[] = emp.tasksSummary.map((t) => ({
    taskName: plainName(t.taskName),
    rateType: t.rateType,
    rate: t.rate,
    hours: t.hours ?? (t.rateType === "hourly" ? t.quantity : 0),
    pieces: t.pieces ?? (t.rateType === "piece" ? t.quantity : 0),
    cost: t.cost,
    missingBuckets: false,
  }));
  const missingRows: Row[] = (emp.missingBucketsSummary ?? []).map((mb) => ({
    taskName: `${plainName(mb.taskName)} (Missing Buckets ${mb.originalDate})`,
    rateType: mb.rateType,
    rate: mb.rate,
    hours: 0,
    pieces: mb.quantity,
    cost: mb.cost,
    missingBuckets: true,
  }));
  return [...taskRows, ...missingRows].sort((a, b) => a.taskName.localeCompare(b.taskName));
}

const cell = "border border-gray-400 px-2 py-1 align-middle";
const cellRight = `${cell} text-right whitespace-nowrap`;
const headCell = `${cell} bg-green-100 font-semibold text-center`;

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

  return (
    <div className="overflow-x-auto">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0.4in; }
        }
      `}</style>
      <table className="w-full border-collapse text-xs mt-4">
        <thead>
          <tr>
            <th className={headCell}>Worker Name</th>
            <th className={headCell}>Task/Description</th>
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
        <tbody>
          {employees.flatMap((e) => {
            const rows: Array<Row | null> = e.rows.length > 0 ? e.rows : [null];
            const span = rows.length;
            return rows.map((row, idx) => {
              const first = idx === 0;
              return (
                <tr key={`${e.emp.employeeId}-${idx}`}>
                  {first && (
                    <td rowSpan={span} className={`${cell} font-medium`}>
                      {e.emp.employeeName}
                    </td>
                  )}
                  <td className={cell}>{row ? row.taskName : "—"}</td>
                  <td className={cellRight}>{row ? num(row.hours) : "—"}</td>
                  {hasPieces && (
                    <td className={cellRight}>
                      {row && row.rateType === "piece" ? num(row.pieces) : "-"}
                    </td>
                  )}
                  <td className={cellRight}>{row ? money(row.rate) : "—"}</td>
                  <td className={cellRight}>{row ? money(row.cost) : "—"}</td>
                  {hasOvertime && first && (
                    <>
                      <td rowSpan={span} className={cellRight}>
                        {e.otHours > 0 ? `${num(e.otHours)} hrs` : "-"}
                      </td>
                      <td rowSpan={span} className={cellRight}>
                        {e.otRate > 0 ? `${money(e.otRate)}/hr` : "-"}
                      </td>
                      <td rowSpan={span} className={cellRight}>
                        {e.otPremium > 0 ? money(e.otPremium) : "-"}
                      </td>
                    </>
                  )}
                  {hasPieces && first && (
                    <td rowSpan={span} className={cellRight}>
                      {e.breaks > 0 ? money(e.breaks) : "-"}
                    </td>
                  )}
                  {hasPieces && first && (
                    <td rowSpan={span} className={cellRight}>
                      {e.minWage > 0 ? money(e.minWage) : "-"}
                    </td>
                  )}
                  {first && (
                    <td rowSpan={span} className={`${cellRight} font-bold`}>
                      {money(e.payReq)}
                    </td>
                  )}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}
