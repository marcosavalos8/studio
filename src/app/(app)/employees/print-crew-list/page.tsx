"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { Employee } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";

export default function PrintCrewListPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const employeeIds = idsParam ? idsParam.split(",") : [];
  const firestore = useFirestore();
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
          @page { size: letter portrait; margin: 0; }
          .print-controls { display: none !important; }
          body * { visibility: hidden !important; }
          .crew-list-root, .crew-list-root * { visibility: visible !important; }
          .crew-list-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 0.5in !important; box-sizing: border-box !important; }
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
          padding: 24px; box-sizing: border-box; font-family: Arial, sans-serif;
        }
        .crew-header {
          display: flex; gap: 48px; margin-bottom: 20px;
          border-bottom: 2px solid #000; padding-bottom: 12px;
          font-size: 13px;
        }
        .crew-header-field { display: flex; gap: 8px; align-items: baseline; }
        .crew-header-label { font-weight: bold; white-space: nowrap; }
        .crew-header-line {
          border-bottom: 1px solid #000; min-width: 140px; display: inline-block;
        }
        .crew-table {
          width: 100%; border-collapse: collapse; font-size: 12px;
        }
        .crew-table th {
          background: #1f2937; color: white; padding: 6px 10px;
          text-align: left; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .crew-table th.text-center { text-align: center; }
        .crew-table td {
          padding: 6px 10px; border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
        }
        .crew-table tr:nth-child(even) td { background: #f9fafb; }
        .crew-table td.text-center { text-align: center; }
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
        {/* Header with blank fields */}
        <div className="crew-header">
          <div className="crew-header-field">
            <span className="crew-header-label">Date:</span>
            <span className="crew-header-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
          <div className="crew-header-field">
            <span className="crew-header-label">Client:</span>
            <span className="crew-header-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
          <div className="crew-header-field">
            <span className="crew-header-label">Task:</span>
            <span className="crew-header-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
        </div>

        {/* Crew table */}
        <table className="crew-table">
          <thead>
            <tr>
              <th>Employee #</th>
              <th>Name</th>
              <th className="text-center">Pieces</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>{emp.employeeNumber || "—"}</td>
                <td>{emp.name}</td>
                <td className="text-center">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
