
'use client'

import React, { useEffect, useState, useRef } from 'react'
import { format } from "date-fns"
import type { ProcessedPayrollData } from "@/ai/flows/generate-payroll-report"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableFooter, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Loader2 } from 'lucide-react'

function ReportToPrint({ report }: { report: ProcessedPayrollData }) {
  const overallTotal = report.employeeSummaries.reduce((acc, emp) => acc + emp.finalPay, 0);

  return (
    <div className="bg-white p-8">
       <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Payroll Report</h2>
              <div className="text-gray-500">For period: {format(new Date(report.startDate), "LLL dd, y")} - {format(new Date(report.endDate), "LLL dd, y")}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-lg">FieldTack WA</div>
              <div className="text-sm text-gray-500">Report Generated: {format(new Date(), "LLL dd, y")}</div>
              <div className="text-xl font-bold mt-2">Total Payroll: ${overallTotal.toFixed(2)}</div>
            </div>
        </div>
        <Accordion type="multiple" className="w-full" defaultValue={report.employeeSummaries.map(e => e.employeeId)}>
            {report.employeeSummaries.map(employee => (
                <AccordionItem value={employee.employeeId} key={employee.employeeId} className="border-b">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline py-4">
                      <div className="flex justify-between w-full pr-4">
                        <span>{employee.employeeName}</span>
                        <span className="text-primary">Final Pay: ${employee.finalPay.toFixed(2)}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pl-4 pr-1 pb-4">
                        {employee.weeklySummaries.map(week => (
                          <div key={week.weekNumber} className="border rounded-md p-4">
                            <h4 className="font-semibold text-lg mb-2">Week {week.weekNumber}, {week.year}</h4>
                             <Table>
                               <TableHeader>
                                  <TableRow>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                  </TableRow>
                               </TableHeader>
                               <TableBody>
                                  <TableRow>
                                    <TableCell>Total Hours Worked</TableCell>
                                    <TableCell className="text-right">{week.totalHours.toFixed(2)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Total Earnings (Hourly + Piecework)</TableCell>
                                    <TableCell className="text-right">${week.totalEarnings.toFixed(2)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Effective Hourly Rate</TableCell>
                                    <TableCell className="text-right">${week.effectiveHourlyRate.toFixed(2)}</TableCell>
                                  </TableRow>
                                   <TableRow>
                                    <TableCell>Paid Rest Breaks (10 min / 4 hrs)</TableCell>
                                    <TableCell className="text-right">+ ${week.paidRestBreaksTotal.toFixed(2)}</TableCell>
                                  </TableRow>
                                  {week.minimumWageTopUp > 0 && (
                                     <TableRow className="bg-amber-100">
                                      <TableCell className="font-semibold">Minimum Wage Top-up</TableCell>
                                      <TableCell className="text-right font-semibold">+ ${week.minimumWageTopUp.toFixed(2)}</TableCell>
                                    </TableRow>
                                  )}
                               </TableBody>
                             </Table>
                          </div>
                        ))}
                         <div className="border rounded-md p-4 bg-gray-50">
                            <h4 className="font-semibold text-lg mb-2">Employee Pay Summary</h4>
                             <Table>
                               <TableBody>
                                  <TableRow>
                                    <TableCell>Subtotal Earnings</TableCell>
                                    <TableCell className="text-right">${employee.overallTotalEarnings.toFixed(2)}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell>Total Paid Rest Breaks</TableCell>
                                    <TableCell className="text-right">+ ${employee.overallTotalPaidRestBreaks.toFixed(2)}</TableCell>
                                  </TableRow>
                                  {employee.overallTotalMinimumWageTopUp > 0 && (
                                     <TableRow>
                                      <TableCell>Total Minimum Wage Top-up</TableCell>
                                      <TableCell className="text-right">+ ${employee.overallTotalMinimumWageTopUp.toFixed(2)}</TableCell>
                                    </TableRow>
                                  )}
                               </TableBody>
                               <TableFooter>
                                <TableRow className="text-lg font-bold">
                                  <TableCell>Final Pay</TableCell>
                                  <TableCell className="text-right">${employee.finalPay.toFixed(2)}</TableCell>
                                </TableRow>
                               </TableFooter>
                             </Table>
                          </div>
                      </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    </div>
  )
}


export default function PrintPayrollPage() {
    const [report, setReport] = useState<ProcessedPayrollData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasPrinted = useRef(false);

    useEffect(() => {
        const data = sessionStorage.getItem('payrollReportData');
        if (data) {
            try {
                setReport(JSON.parse(data));
            } catch (e) {
                setError("Failed to parse report data. Please close this tab and try again.");
            }
        } else {
            setError("No report data found. Please generate a report first.");
        }
    }, []);

    useEffect(() => {
        if (report && !hasPrinted.current) {
            hasPrinted.current = true;
            // A short delay helps ensure everything is rendered before printing
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [report]);

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100 p-8">
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h1 className="text-xl font-bold text-destructive mb-4">Error</h1>
                    <p>{error}</p>
                    <button 
                        onClick={() => window.close()} 
                        className="mt-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                        Close Tab
                    </button>
                </div>
            </div>
        )
    }

    if (!report) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Loading report for printing...</p>
            </div>
        )
    }

    return (
        <>
            <style jsx global>{`
                @media print {
                    body {
                        background-color: #fff;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0.5in;
                    }
                }
            `}</style>
            <ReportToPrint report={report} />
        </>
    );
}

