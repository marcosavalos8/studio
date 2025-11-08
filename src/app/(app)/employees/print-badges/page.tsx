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
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .print-container {
            width: 100%;
          }
          
          .page-break {
            page-break-after: always;
            page-break-inside: avoid;
          }
          
          .no-print {
            display: none;
          }
        }
        
        @media screen {
          body {
            background: #f5f5f5;
          }
        }
        
        .badge-grid {
          display: grid;
          grid-template-columns: repeat(2, 8.5cm);
          grid-template-rows: repeat(4, 5.5cm);
          gap: 0.3cm;
          width: fit-content;
          margin: 0 auto;
          padding: 0.3cm;
        }
        
        .badge-card {
          width: 8.5cm;
          height: 5.5cm;
          border: 2px solid #ea580c;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          box-sizing: border-box;
          page-break-inside: avoid;
          overflow: hidden;
          padding: 0.4cm;
          gap: 0.3cm;
        }
        
        .company-name {
          font-size: 16pt;
          font-weight: bold;
          color: #ea580c;
          letter-spacing: 0.1em;
          margin: 0;
          text-align: center;
        }
        
        .badge-qr {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .badge-name {
          font-size: 12pt;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
          text-align: center;
          line-height: 1.3;
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
          <div style={{ width: '140px', height: '140px', background: '#f3f4f6' }} />
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
          <div style={{ width: '140px', height: '140px', background: '#f3f4f6' }} />
        </div>
        <p className="badge-name">Employee not found</p>
      </div>
    );
  }

  return (
    <div className="badge-card">
      {/* Company name */}
      <h2 className="company-name">JM AGRI</h2>
      
      {/* QR Code */}
      <div className="badge-qr">
        <QRCodeSVG
          value={employee.qrCode || employee.id}
          size={140}
          level="H"
          includeMargin={false}
        />
      </div>
      
      {/* Employee name */}
      <p className="badge-name">{employee.name}</p>
    </div>
  );
}
