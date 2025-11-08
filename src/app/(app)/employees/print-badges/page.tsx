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
    }, 1000);
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
          }
          
          .print-container {
            width: 100%;
          }
          
          .page-break {
            page-break-after: always;
          }
          
          .no-print {
            display: none;
          }
        }
        
        .badge-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: repeat(4, 1fr);
          gap: 0.5rem;
          width: 100%;
          height: 100vh;
          padding: 0.5rem;
        }
        
        .badge-card {
          border: 1px dashed #ccc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          text-align: center;
          background: white;
        }
        
        .badge-name {
          font-size: 0.9rem;
          font-weight: bold;
          margin-bottom: 0.25rem;
          word-wrap: break-word;
          max-width: 100%;
        }
        
        .badge-qr {
          margin: 0.25rem 0;
        }
        
        .badge-code {
          font-size: 0.7rem;
          color: #666;
          margin-top: 0.25rem;
          font-family: monospace;
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
        <div className="badge-name">Loading...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="badge-card">
        <div className="badge-name">Employee not found</div>
      </div>
    );
  }

  return (
    <div className="badge-card">
      <div className="badge-name">{employee.name}</div>
      <div className="badge-qr">
        <QRCodeSVG
          value={employee.qrCode || employee.id}
          size={120}
          level="H"
          includeMargin={false}
        />
      </div>
      <div className="badge-code">{employee.qrCode || employee.id}</div>
    </div>
  );
}
