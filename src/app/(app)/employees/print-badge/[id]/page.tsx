"use client";

import React from "react";
import { useDocument } from "@/lib/api/client";
import { Employee } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PrintBadgePageProps {
  params: Promise<{ id: string }>;
}

export default function PrintBadgePage({ params }: PrintBadgePageProps) {
  const router = useRouter();
  const { id } = React.use(params);
  const { data: employee, isLoading: loading, error } = useDocument<Employee>(`/api/employees/${id}`);

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=600,height=600");
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Employee Badge - ${employee?.name}</title>
          <style>
            body {
              margin: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .badge-container {
              text-align: center;
              padding: 20px;
            }
            .employee-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 16px;
            }
            .employee-id {
              font-size: 14px;
              color: #666;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="badge-container">
            <div class="employee-name">${employee?.name}</div>
            ${document.querySelector(".qr-code-container")?.innerHTML || ""}
            <div class="employee-id">${employee?.qrCode || employee?.id}</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleBack = () => {
    router.push("/employees");
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading employee data</div>;
  if (!employee) return <div>Employee not found</div>;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-sm mx-auto bg-white p-6 rounded-lg shadow-md">
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-xl font-bold mb-2 text-center">
            {employee.name}
          </h2>
          <div className="qr-code-container mb-4 flex justify-center">
            <QRCodeSVG
              value={employee.qrCode || employee.id}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
          <p className="text-sm text-gray-600 text-center">
            {employee.qrCode || employee.id}
          </p>
        </div>

        <div className="mt-4 flex justify-between">
          <Button onClick={handleBack} variant="outline">
            Back to Employees
          </Button>
          <Button onClick={handlePrint} variant="default">
            Print Badge
          </Button>
        </div>
      </div>
    </div>
  );
}
