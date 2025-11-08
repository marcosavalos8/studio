"use client";

import React, { useEffect } from "react";
import { doc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useDocument } from "@/firebase/firestore/use-doc";
import { Employee } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "next/navigation";
import { User } from "lucide-react";

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
          border: 1px dashed #ddd;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          background: white;
          box-sizing: border-box;
          page-break-inside: avoid;
          overflow: hidden;
          padding: 0;
        }
        
        .badge-header {
          width: 100%;
          padding: 0.3cm 0;
          text-align: center;
          background: #f8f9fa;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .company-name {
          font-size: 14pt;
          font-weight: bold;
          color: #5B9BD5;
          letter-spacing: 0.05em;
          margin: 0;
        }
        
        .badge-photo {
          width: 100%;
          height: 3.2cm;
          background: linear-gradient(135deg, #5BC0DE 0%, #4A9FBF 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-top: 1px solid #e0e0e0;
          border-bottom: 1px solid #e0e0e0;
        }
        
        .photo-placeholder {
          width: 2.5cm;
          height: 2.5cm;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .photo-icon {
          width: 1.5cm;
          height: 1.5cm;
          color: #5BC0DE;
        }
        
        .badge-info {
          width: 100%;
          padding: 0.2cm 0.3cm;
          text-align: center;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        
        .badge-name {
          font-size: 11pt;
          font-weight: bold;
          color: #4A5568;
          margin: 0 0 0.1cm 0;
          line-height: 1.2;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        
        .badge-code {
          font-size: 10pt;
          color: #5B9BD5;
          font-weight: 600;
          margin: 0;
          letter-spacing: 0.05em;
        }
        
        .badge-role-bar {
          width: 100%;
          background: #5B9BD5;
          padding: 0.15cm 0;
          text-align: center;
        }
        
        .badge-role {
          font-size: 9pt;
          color: white;
          font-weight: 600;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .badge-qr {
          width: 100%;
          padding: 0.2cm 0;
          display: flex;
          justify-content: center;
          align-items: center;
          background: white;
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
        <div className="badge-header">
          <h2 className="company-name">JM AGRI</h2>
        </div>
        <div className="badge-photo">
          <div className="photo-placeholder">
            <User className="photo-icon" />
          </div>
        </div>
        <div className="badge-info">
          <p className="badge-name">Loading...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="badge-card">
        <div className="badge-header">
          <h2 className="company-name">JM AGRI</h2>
        </div>
        <div className="badge-photo">
          <div className="photo-placeholder">
            <User className="photo-icon" />
          </div>
        </div>
        <div className="badge-info">
          <p className="badge-name">Employee not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="badge-card">
      {/* Header with company name */}
      <div className="badge-header">
        <h2 className="company-name">JM AGRI</h2>
      </div>
      
      {/* Photo placeholder */}
      <div className="badge-photo">
        <div className="photo-placeholder">
          <User className="photo-icon" />
        </div>
      </div>
      
      {/* Employee info */}
      <div className="badge-info">
        <p className="badge-name">{employee.name}</p>
        <p className="badge-code">{employee.qrCode || employee.id}</p>
      </div>
      
      {/* Role bar */}
      <div className="badge-role-bar">
        <p className="badge-role">{employee.role}</p>
      </div>
      
      {/* QR Code */}
      <div className="badge-qr">
        <QRCodeSVG
          value={employee.qrCode || employee.id}
          size={80}
          level="H"
          includeMargin={false}
        />
      </div>
    </div>
  );
}
