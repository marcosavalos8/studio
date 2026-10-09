"use client";

import React from "react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import type { EmployeePayrollSummary, DailyTaskDetail } from "@/lib/types";

type Props = {
  summary: EmployeePayrollSummary;
  employeeNumber?: string;
  companyName: string;
  startDate: string;
  endDate: string;
};

const money = (value: number) =>
  `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const num = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Piece quantities (not hours) get 4 decimals — a shared-piece split like
// 2.75/4 = 0.4167 would otherwise display as 0.42, which doesn't visibly
// multiply back to the row's own total and invites questions from workers.
const numPieces = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

type DayRow = {
  date: string;
  task: DailyTaskDetail;
};

export function PayStub({ summary, employeeNumber, companyName, startDate, endDate }: Props) {
  const days: DayRow[] = summary.weeklySummaries
    .flatMap((week) => week.dailyBreakdown)
    .flatMap((day) => day.tasks.map((task) => ({ date: day.date, task })))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hasPieces = days.some((d) => d.task.taskType === "piece");
  const totalHours = summary.weeklySummaries.reduce(
    (acc, week) => acc + week.dailyBreakdown.reduce((s, day) => s + day.totalDailyHours, 0),
    0,
  );

  // Weekly summary by task and rate
  const byTask = new Map<string, { label: string; type: string; qty: number; price: number; total: number }>();
  days.forEach(({ task }) => {
    const isPiece = task.taskType === "piece";
    const key = `${task.taskName}|${task.taskType}|${task.rate ?? 0}`;
    const row = byTask.get(key) ?? {
      label: task.taskName,
      type: task.taskType ?? "hourly",
      qty: 0,
      price: task.rate ?? 0,
      total: 0,
    };
    row.qty += isPiece ? task.pieceworkCount : task.hours;
    row.total += task.totalEarnings;
    byTask.set(key, row);
  });
  const taskRows = Array.from(byTask.values());
  const grossEarnings = taskRows.reduce((acc, r) => acc + r.total, 0);

  const breaks = summary.weeklySummaries.reduce((acc, w) => acc + (w.paidRestBreaks ?? 0), 0);
  const minWage = summary.weeklySummaries.reduce((acc, w) => acc + (w.minimumWageTopUp ?? 0), 0);
  const otHours = summary.weeklySummaries.reduce((acc, w) => acc + (w.overtimeHours ?? 0), 0);
  const otPremium = summary.weeklySummaries.reduce((acc, w) => acc + (w.overtimePremium ?? 0), 0);
  const otRegularRate = otHours > 0 ? otPremium / (0.5 * otHours) : 0;

  const fmt = (d: string) => format(parseLocalDate(d), "MM/dd/yyyy");

  return (
    <div className="pay-stub">
      <style>{`
        .pay-stub { font-family: Arial, sans-serif; color: #000; font-size: 11px; }
        .pay-stub table { width: 100%; border-collapse: collapse; }
        .pay-stub th, .pay-stub td { padding: 3px 4px; }
        .pay-stub th { text-align: left; font-weight: 700; border-bottom: 1px solid #000; }
        .pay-stub .r { text-align: right; font-variant-numeric: tabular-nums; }
        .pay-stub .c { text-align: center; }
        .pay-stub .sec { margin-top: 14px; }
        .pay-stub .sec-title { font-weight: 700; border-top: 1px solid #000; padding-top: 4px; }
        .pay-stub .total td { border-top: 1px solid #000; font-weight: 700; padding-top: 6px; }
        .pay-stub .note { margin-top: 18px; text-align: center; font-style: italic; font-size: 10px; }
        @media print {
          .pay-stub { page-break-after: always; break-after: page; padding: 0.4in; }
          .pay-stub:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13 }}>{companyName}</div>
      <div style={{ textAlign: "center", marginTop: 4 }}>Recibo de nómina</div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Empleado: {summary.employeeName}</div>
          <div style={{ fontWeight: 700 }}># Emp: {employeeNumber || "—"}</div>
        </div>
        <div style={{ fontWeight: 700 }}>
          Periodo de pago: {fmt(startDate)} - {fmt(endDate)}
        </div>
      </div>

      <table style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Descripción de la tarea</th>
            <th className="r">Horas</th>
            {hasPieces && <th className="r">Piezas</th>}
            <th className="r">Tarifa</th>
            <th className="r">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {days.map(({ date, task }, idx) => (
            <tr key={`${date}-${idx}`}>
              <td>{fmt(date)}</td>
              <td>{task.taskName}</td>
              <td className="r">{task.hours > 0 ? num(task.hours) : "-"}</td>
              {hasPieces && (
                <td className="r">{task.taskType === "piece" ? numPieces(task.pieceworkCount) : "-"}</td>
              )}
              <td className="r">{money(task.rate ?? 0)}</td>
              <td className="r">{money(task.totalEarnings)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sec" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
        <span>Total de Horas Trabajadas</span>
        <span>{num(totalHours)} hrs</span>
      </div>

      <div className="sec">
        <table>
          <thead>
            <tr>
              <th>Resumen semanal por tarea</th>
              <th className="r">Cantidad</th>
              <th className="r">Precio</th>
              <th className="r">Total</th>
            </tr>
          </thead>
          <tbody>
            {taskRows.map((r, idx) => (
              <tr key={idx}>
                <td>{r.label}</td>
                <td className="r">{r.type === "piece" ? numPieces(r.qty) : `${num(r.qty)} hrs`}</td>
                <td className="r">{money(r.price)}</td>
                <td className="r">{money(r.total)}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={3}>Ganancias Brutas por Tarea</td>
              <td className="r">{money(grossEarnings)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {breaks > 0 && (
        <div className="sec" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Descansos Pagados (10 min/4 hrs)</span>
          <span>{money(breaks)}</span>
        </div>
      )}
      {otHours > 0 && (
        <>
          <div className="sec" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Horas de Overtime</span>
            <span>{num(otHours)} hrs</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Tarifa ordinaria para el cálculo de Overtime</span>
            <span>{money(otRegularRate)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Prima de Overtime (0.5x Tarifa ordinaria)</span>
            <span>{money(otPremium)}</span>
          </div>
        </>
      )}
      {minWage > 0 && (
        <div className="sec" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Ajuste al Salario Mínimo (Minimum Wage Adjustment)</span>
          <span>{money(minWage)}</span>
        </div>
      )}

      <div className="sec-title" style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span>Pago Total Bruto</span>
        <span>{money(summary.finalPay)}</span>
      </div>

      <div className="note">El Pago Total Bruto está exento de deducciones aplicables.</div>
    </div>
  );
}
