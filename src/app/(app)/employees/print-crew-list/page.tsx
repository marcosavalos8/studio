"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { Employee } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useCompanyInfo } from "@/hooks/use-company-info";

const MIN_ROWS = 20;

export default function PrintCrewListPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const employeeIds = idsParam ? idsParam.split(",") : [];
  const firestore = useFirestore();
  const { companyInfo } = useCompanyInfo();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || employeeIds.length === 0) {
      setLoading(false);
      return;
    }
    Promise.all(
      employeeIds.map(async (id) => {
        const snap = await getDoc(doc(firestore, "employees", id));
        if (snap.exists()) return { id: snap.id, ...snap.data() } as Employee;
        return null;
      })
    ).then((results) => {
      setEmployees(results.filter(Boolean) as Employee[]);
      setLoading(false);
    });
  }, [firestore, idsParam]);

  const rowCount = Math.max(MIN_ROWS, employees.length);
  const rows = Array.from({ length: rowCount }, (_, i) => employees[i] ?? null);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
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
          .crew-list-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 0 !important; box-sizing: border-box !important; }
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
        .crew-header {
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          border-bottom: 3px solid #15803d; padding-bottom: 10px; margin-bottom: 12px;
        }
        .crew-company-name { font-size: 18px; font-weight: bold; color: #15803d; }
        .crew-company-detail { font-size: 10px; color: #374151; line-height: 1.4; text-align: right; }
        .crew-title {
          text-align: center; font-size: 15px; font-weight: bold; letter-spacing: 0.06em;
          text-transform: uppercase; margin: 0 0 10px; color: #14532d;
        }
        .crew-meta {
          width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px;
        }
        .crew-meta td { border: 1px solid #9ca3af; padding: 7px 8px; }
        .crew-meta td.label { font-weight: bold; width: 18%; background: #f3f4f6; }
        .crew-table {
          width: 100%; border-collapse: collapse; font-size: 11px;
        }
        .crew-table th, .crew-table td {
          border: 1px solid #9ca3af; padding: 5px 6px; text-align: left;
        }
        .crew-table th {
          background: #15803d; color: white; font-size: 10px;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .crew-table td.num { width: 4%; text-align: center; color: #6b7280; }
        .crew-table td.emp { width: 12%; }
        .crew-table td.time, .crew-table th.time { width: 9%; text-align: center; }
        .crew-table td.bins, .crew-table th.bins { width: 7%; text-align: center; }
        .crew-table td.name { width: 27%; }
        .crew-table tbody tr:nth-child(even) td { background: #f9fafb; }
        .crew-table tr.row { height: 26px; }
        .crew-footer {
          width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px;
        }
        .crew-footer td { border: 1px solid #9ca3af; padding: 8px; font-weight: bold; background: #f3f4f6; }
        .crew-signature {
          margin-top: 28px; display: flex; justify-content: space-between; font-size: 11px;
        }
        .crew-signature div { width: 45%; border-top: 1px solid #111827; padding-top: 4px; }
      `}} />

      <div className="print-controls">
        <button
          className="print-button"
          onClick={() => window.print()}
          disabled={loading}
        >
          <Printer size={20} />
          {loading ? "Cargando..." : "Imprimir Crew List"}
        </button>
      </div>

      <div className="crew-list-root">
        <div className="crew-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/logo.jpeg" alt="Logo" style={{ width: "80px", height: "64px", objectFit: "contain" }} />
            <div className="crew-company-name">{companyInfo.companyName}</div>
          </div>
          <div className="crew-company-detail">
            {companyInfo.address}<br />
            PH: {companyInfo.phone} · {companyInfo.email}<br />
            EIN: {companyInfo.ein} · UBI: {companyInfo.ubi}
          </div>
        </div>

        <div className="crew-title">Daily Crew Sheet</div>

        <table className="crew-meta">
          <tbody>
            <tr>
              <td className="label">Date:</td>
              <td></td>
              <td className="label">Grower / Orchard:</td>
              <td></td>
            </tr>
            <tr>
              <td className="label">Location / Block:</td>
              <td></td>
              <td className="label">Variety:</td>
              <td></td>
            </tr>
            <tr>
              <td className="label">Crew Leader:</td>
              <td></td>
              <td className="label">Number of Workers:</td>
              <td></td>
            </tr>
            <tr>
              <td className="label">Task:</td>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </table>

        <table className="crew-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th className="emp">Emp #</th>
              <th className="name">Employee Name</th>
              <th className="time">Start</th>
              <th className="time">Lunch Out</th>
              <th className="time">Lunch In</th>
              <th className="time">End</th>
              <th className="time">Hours</th>
              <th className="bins">Bins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((emp, i) => (
              <tr className="row" key={emp?.id ?? `blank-${i}`}>
                <td className="num">{i + 1}</td>
                <td className="emp">{emp?.employeeNumber || ""}</td>
                <td className="name">{emp?.name || ""}</td>
                <td className="time"></td>
                <td className="time"></td>
                <td className="time"></td>
                <td className="time"></td>
                <td className="time"></td>
                <td className="bins"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="crew-footer">
          <tbody>
            <tr>
              <td style={{ width: "50%" }}>Total Workers: {employees.length || ""}</td>
              <td>Total Hours:</td>
            </tr>
          </tbody>
        </table>

        <div className="crew-signature">
          <div>Crew Leader Signature</div>
          <div>Date</div>
        </div>
      </div>
    </>
  );
}
