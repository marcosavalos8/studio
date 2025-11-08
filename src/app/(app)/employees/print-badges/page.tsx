"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  const handleBadgeLoaded = useCallback((employeeId: string) => {
    setLoadedIds(prev => new Set(prev).add(employeeId));
  }, []);

  // Don't auto-trigger print - let user do it from browser's print preview
  // This prevents issues with data not loading in time

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media screen {
          /* Hide ALL parent elements except our print container */
          body > div:not(:has(.print-badges-root)) {
            display: none !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          /* Target specific parent layout elements */
          nav, header, footer, aside, 
          [data-sidebar], [data-sidebar-provider],
          .sidebar, .app-header, .app-sidebar {
            display: none !important;
          }
        }
        
        @media print {
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          
          /* Hide EVERYTHING except our print container */
          body * {
            visibility: hidden !important;
          }
          
          .print-badges-root,
          .print-badges-root * {
            visibility: visible !important;
          }
          
          .print-badges-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
        }
        
        .print-badges-root {
          width: 100%;
          background: white;
          min-height: 100vh;
          padding: 0;
          margin: 0;
        }
        
        .badge-grid {
          display: grid;
          grid-template-columns: repeat(2, 5.5cm);
          grid-template-rows: repeat(4, 8.5cm);
          gap: 0.4cm;
          width: fit-content;
          margin: 0 auto;
          padding: 0.5cm 0;
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
        
        .company-logo-container {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
        }
        
        .company-logo {
          max-width: 4cm;
          max-height: 1.5cm;
          width: auto;
          height: auto;
          object-fit: contain;
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
        
        .page-break {
          page-break-after: always;
          page-break-inside: avoid;
        }
      `}} />

      <div className="print-badges-root">
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
                  <BadgeCard key={employeeId} employeeId={employeeId} onLoaded={handleBadgeLoaded} />
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
  onLoaded: (employeeId: string) => void;
}

function BadgeCard({ employeeId, onLoaded }: BadgeCardProps) {
  const firestore = useFirestore();
  const employeeRef = firestore ? doc(firestore, "employees", employeeId) : null;
  const { data: employee, loading } = useDocument<Employee>(employeeRef);
  const [hasNotified, setHasNotified] = useState(false);

  useEffect(() => {
    if (!loading && !hasNotified) {
      onLoaded(employeeId);
      setHasNotified(true);
    }
  }, [loading, employeeId, onLoaded, hasNotified]);

  if (loading) {
    return (
      <div className="badge-card">
        <div className="company-logo-container">
          <img src="/logo.jpeg" alt="JM AGRI" className="company-logo" />
        </div>
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
        <div className="company-logo-container">
          <img src="/logo.jpeg" alt="JM AGRI" className="company-logo" />
        </div>
        <div className="badge-qr">
          <div style={{ width: '120px', height: '120px', background: '#f3f4f6' }} />
        </div>
        <p className="badge-name">Employee not found</p>
      </div>
    );
  }

  return (
    <div className="badge-card">
      <div className="company-logo-container">
        <img src="/logo.jpeg" alt="JM AGRI" className="company-logo" />
      </div>
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
