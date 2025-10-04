'use client'

import React, { useEffect, useState, useRef } from 'react';
import { ProcessedPayrollData } from "@/ai/flows/generate-payroll-report"
import { format } from "date-fns"
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
import { Loader2 } from 'lucide-react';

function DailyBreakdownDisplay({ breakdown }: { breakdown: ProcessedPayrollData['employeeSummaries'][0]['weeklySummaries'][0]['dailyBreakdown']}) {
  return (
    <div className="space-y-2 pl-4">
      {breakdown.map(day => (
        <div key={day.date} className="bg-gray-50 p-3 rounded-md">
          <p className="font-semibold">{format(new Date(day.date), "EEEE, LLL dd")}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task / Location</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Pieces</TableHead>
                <TableHead className="text-right">Earnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {day.tasks.map((task, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div>{task.taskName}</div>
                    <div className="text-xs text-gray-500">{task.clientName} {task.ranch && ` - ${task.ranch}`}</div>
                  </TableCell>
                  <TableCell className="text-right">{task.hours > 0 ? task.hours.toFixed(2) : '-'}</TableCell>
                  <TableCell className="text-right">{task.pieceworkCount > 0 ? task.pieceworkCount.toFixed(2) : '-'}</TableCell>
                  <TableCell className="text-right">${(task.hourlyEarnings + task.pieceworkEarnings).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
               <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">Total Daily Earnings</TableCell>
                  <TableCell className="text-right font-medium">${day.totalDailyEarnings.toFixed(2)}</TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </div>
      ))}
    </div>
  )
}

function PrintPayrollPage() {
    const [report, setReport] = useState<ProcessedPayrollData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const hasPrinted = useRef(false);

    useEffect(() => {
        const data = sessionStorage.getItem('print-payroll-data');
        if (data) {
            setReport(JSON.parse(data));
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (report && !isLoading && !hasPrinted.current) {
            hasPrinted.current = true;
            setTimeout(() => window.print(), 500);
        }
    }, [report, isLoading]);

    if (isLoading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!report) {
        return <div className="p-8 text-center text-red-500">Could not find report data to print. Please go back and generate the report again.</div>;
    }

    const overallTotal = report.employeeSummaries.reduce((acc, emp) => acc + emp.finalPay, 0);

    return (
        <div className="bg-white text-black p-8">
            <style jsx global>{`
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    @page {
                        size: auto;
                        margin: 20mm;
                    }
                    .page-break {
                        break-before: page;
                    }
                }
            `}</style>
            <div className="mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-primary">Payroll Report</h1>
                        <div className="text-gray-500">For period: {format(new Date(report.startDate), "LLL dd, y")} - {format(new Date(report.endDate), "LLL dd, y")}</div>
                        <div className="text-gray-500">Pay Date: {format(new Date(report.payDate), "LLL dd, y")}</div>
                    </div>
                    <div className="text-right">
                        <div className="font-semibold text-lg">FieldTack WA</div>
                        <div className="text-sm">Report Generated: {format(new Date(), "LLL dd, y")}</div>
                        <div className="text-xl font-bold mt-2">Total Payroll: ${overallTotal.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            <Accordion type="multiple" className="w-full" defaultValue={report.employeeSummaries.map(e => e.employeeId)}>
                {report.employeeSummaries.map((employee, index) => (
                    <div key={employee.employeeId} className={index > 0 ? 'page-break' : ''}>
                        <AccordionItem value={employee.employeeId} className="border-b">
                            <AccordionTrigger className="text-xl font-semibold hover:no-underline w-full">
                                <div className="flex justify-between w-full pr-4">
                                <span>{employee.employeeName}</span>
                                <span className="text-primary">Final Pay: ${employee.finalPay.toFixed(2)}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-4">
                                <Accordion type="multiple" className="w-full" defaultValue={employee.weeklySummaries.map(w => `w-${w.weekNumber}`)}>
                                    {employee.weeklySummaries.map(week => (
                                        <AccordionItem value={`w-${week.weekNumber}`} key={week.weekNumber}>
                                            <AccordionTrigger className="font-semibold text-lg mb-2 ml-4">
                                                Week {week.weekNumber}, {week.year}
                                            </AccordionTrigger>
                                            <AccordionContent className="space-y-4 pl-4">
                                                <DailyBreakdownDisplay breakdown={week.dailyBreakdown} />
                                                <div className="border rounded-md p-4 mt-4">
                                                <h5 className="font-semibold mb-2">Week {week.weekNumber} Financial Summary</h5>
                                                <Table>
                                                    <TableBody>
                                                        <TableRow><TableCell>Total Hours Worked</TableCell><TableCell className="text-right">{week.totalHours.toFixed(2)}</TableCell></TableRow>
                                                        <TableRow><TableCell>Total Earnings (Hourly + Piecework)</TableCell><TableCell className="text-right">${week.totalEarnings.toFixed(2)}</TableCell></TableRow>
                                                        <TableRow><TableCell>Effective Hourly Rate</TableCell><TableCell className="text-right">${week.effectiveHourlyRate.toFixed(2)}</TableCell></TableRow>
                                                        <TableRow><TableCell>Paid Rest Breaks (10 min / 4 hrs)</TableCell><TableCell className="text-right">+ ${week.paidRestBreaksTotal.toFixed(2)}</TableCell></TableRow>
                                                        {week.minimumWageTopUp > 0 && <TableRow className="bg-amber-100"><TableCell className="font-semibold">Minimum Wage Top-up</TableCell><TableCell className="text-right font-semibold">+ ${week.minimumWageTopUp.toFixed(2)}</TableCell></TableRow>}
                                                    </TableBody>
                                                </Table>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>

                                <div className="border rounded-md p-4 bg-gray-50">
                                    <h4 className="font-semibold text-lg mb-2">Employee Pay Summary for Period</h4>
                                    <Table>
                                        <TableBody>
                                            <TableRow><TableCell>Subtotal Earnings</TableCell><TableCell className="text-right">${employee.overallTotalEarnings.toFixed(2)}</TableCell></TableRow>
                                            <TableRow><TableCell>Total Paid Rest Breaks</TableCell><TableCell className="text-right">+ ${employee.overallTotalPaidRestBreaks.toFixed(2)}</TableCell></TableRow>
                                            {employee.overallTotalMinimumWageTopUp > 0 && <TableRow><TableCell>Total Minimum Wage Top-up</TableCell><TableCell className="text-right">+ ${employee.overallTotalMinimumWageTopUp.toFixed(2)}</TableCell></TableRow>}
                                        </TableBody>
                                        <TableFooter>
                                        <TableRow className="text-lg font-bold"><TableCell>Final Pay</TableCell><TableCell className="text-right">${employee.finalPay.toFixed(2)}</TableCell></TableRow>
                                        </TableFooter>
                                    </Table>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </div>
                ))}
            </Accordion>
        </div>
    );
}

export default PrintPayrollPage;
