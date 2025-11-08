"use client";

import React, { useEffect } from "react";
import { doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useDocument } from "@/firebase/firestore/use-doc";
import { Employee } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "next/navigation";

export default function PrintBadgesPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const employeeIds = idsParam ? idsParam.split(",") : [];
  const firestore = useFirestore();

  useEffect(() => {
    // Auto-print when the page loads and all badges are rendered
    const timer = setTimeout(() => {
      window.print();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          width: 100%;
          height: 100%;
        }
        
        @media print {
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          .print-container {
            width: 100%;
            background: white !important;
          }
          
          .page-break {
            page-break-after: always;
            page-break-inside: avoid;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        
        @media screen {
          body {
            background: #f0f0f0;
          }
        }
        
        .print-container {
          width: 100%;
          background: white;
          min-height: 100vh;
        }
        
        .badge-grid {
          display: grid;
          grid-template-columns: repeat(2, 5.5cm);
          grid-template-rows: repeat(4, 8.5cm);
          gap: 0.4cm;
          width: fit-content;
          margin: 0 auto;
          padding: 0.5cm;
        }
        
        .badge-card {
          width: 5.5cm;
          height: 8.5cm;
          border: 2px dashed #d1d5db;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-evenly;
          background: white;
          box-sizing: border-box;
          page-break-inside: avoid;
          overflow: hidden;
          padding: 0.4cm 0.3cm;
        }
        
        .company-name {
          font-size: 14pt;
          font-weight: bold;
          color: #ea580c;
          letter-spacing: 0.15em;
          margin: 0;
          text-align: center;
        }
        
        .badge-qr {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
        }
        
        .badge-name {
          font-size: 11pt;
          font-weight: 600;
          color: #374151;
          margin: 0;
          text-align: center;
          line-height: 1.3;
          word-wrap: break-word;
          max-width: 100%;
        }
      `}} />

      <div className="print-container">
        {Array.from({ length: Math.ceil(employeeIds.length / 8) }).map((_, pageIndex) => {
          const startIdx = pageIndex * 8;
          const pageEmployeeIds = employeeIds.slice(startIdx, startIdx + 8);
          
          return (
            <div
              key={pageIndex}
              className={pageIndex < Math.ceil(employeeIds.length / 8) - 1 ? "page-break" : ""}
            >
              <div className="badge-grid">
                {pageEmployeeIds.map((employeeId) => (
                  <BadgeCard key={employeeId} employeeId={employeeId} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

interface BadgeCardProps {
  employeeId: string;
}

function BadgeCard({ employeeId }: BadgeCardProps) {
  const firestore = useFirestore();
  const employeeRef = firestore ? doc(firestore, "employees", employeeId) : null;
  const { data: employee, loading } = useDocument<Employee>(employeeRef);

  if (loading) {
    return (
      <div className="badge-card">
        <h2 className="company-name">JM AGRI</h2>
        <div className="badge-qr">
          <div style={{ width: '120px', height: '120px', background: '#f3f4f6' }} />
        </div>
        <p className="badge-name">Loading...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="badge-card">
        <h2 className="company-name">JM AGRI</h2>
        <div className="badge-qr">
          <div style={{ width: '120px', height: '120px', background: '#f3f4f6' }} />
        </div>
        <p className="badge-name">Employee not found</p>
      </div>
    );
  }

  return (
    <div className="badge-card">
      <h2 className="company-name">JM AGRI</h2>
      <div className="badge-qr">
        <QRCodeSVG
          value={employee.qrCode || employee.id}
          size={120}
          level="H"
          includeMargin={false}
        />
      </div>
      <p className="badge-name">{employee.name}</p>
    </div>
  );
}
