'use client'

import React from 'react';
import type { ProcessedPayrollData } from "@/lib/types"
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
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';


function DailyBreakdownDisplay({ breakdown }: { breakdown: ProcessedPayrollData['employeeSummaries'][0]['weeklySummaries'][0]['dailyBreakdown']}) {
  return (
    <div className="space-y-2 pl-4">
      {breakdown.map(day => (
        <div key={day.date} className="bg-gray-50 dark:bg-muted/50 p-3 rounded-md">
          <p className="font-semibold">{format(new Date(day.date), "EEEE, LLL dd")}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task / Location</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Pieces</TableHead>
                <TableHead className="text-right">Task Earnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {day.tasks.map((task, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <div>{task.taskName}</div>
                    <div className="text-xs text-muted-foreground">{task.clientName} {task.ranch && ` - ${task.ranch}`}</div>
                    {task.hours > 0 && task.totalEarnings === 0 && (
                      <div className="text-xs text-amber-600 italic mt-1">
                        No pieces recorded - minimum wage adjustment applied at daily level
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{task.hours > 0 ? task.hours.toFixed(2) : '-'}</TableCell>
                  <TableCell className="text-right">{task.pieceworkCount > 0 ? task.pieceworkCount.toFixed(2) : '-'}</TableCell>
                  <TableCell className="text-right">${task.totalEarnings.toFixed(2)}</TableCell>
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

interface ReportDisplayProps {
    report: ProcessedPayrollData;
    onBack: () => void;
}

export function PayrollReportDisplay({ report, onBack }: ReportDisplayProps) {
    const overallTotal = report.employeeSummaries.reduce((acc, emp) => acc + emp.finalPay, 0);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div>
            <div className="mb-4 flex justify-between items-center print:hidden">
                <Button variant="outline" onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Generate New Report
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print / Save as PDF
                </Button>
            </div>
            
            <div className="report-container bg-card text-card-foreground p-8 rounded-lg border shadow-sm">
                <style jsx global>{`
                    @media print {
                        body {
                           -webkit-print-color-adjust: exact;
                           print-color-adjust: exact;
                        }
                        body * {
                            visibility: hidden;
                        }
                        .report-container, .report-container * {
                            visibility: visible;
                        }
                        .report-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            border: none;
                            box-shadow: none;
                            margin: 0;
                            padding: 0;
                            background: white;
                            color: black;
                        }
                        .page-break {
                            break-before: page;
                        }
                        .print\\:hidden {
                            display: none;
                        }
                    }
                     @page {
                        size: auto;
                        margin: 0.5in;
                    }
                `}</style>
                <div className="mb-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-primary">Payroll Report</h1>
                            <div className="text-muted-foreground">For period: {format(new Date(report.startDate), "LLL dd, y")} - {format(new Date(report.endDate), "LLL dd, y")}</div>
                            <div className="text-muted-foreground">Pay Date: {format(new Date(report.payDate), "LLL dd, y")}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-semibold text-lg">FieldTack WA</div>
                            <div className="text-sm text-muted-foreground">Report Generated: {format(new Date(), "LLL dd, y")}</div>
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
                                                    <h5 className="font-semibold mb-2">Week {week.weekNumber} Summary & Adjustments</h5>
                                                    <Table>
                                                        <TableBody>
                                                            <TableRow><TableCell>Total Hours Worked</TableCell><TableCell className="text-right">{week.totalHours.toFixed(2)}</TableCell></TableRow>
                                                            <TableRow><TableCell>Raw Task Earnings</TableCell><TableCell className="text-right">${week.totalEarnings.toFixed(2)}</TableCell></TableRow>
                                                            <TableRow><TableCell>Minimum Wage Top-Up</TableCell><TableCell className="text-right text-amber-600">+ ${week.minimumWageTopUp.toFixed(2)}</TableCell></TableRow>
                                                            <TableRow><TableCell>Paid Rest Breaks (10min / 4hr)</TableCell><TableCell className="text-right text-blue-600">+ ${week.paidRestBreaks.toFixed(2)}</TableCell></TableRow>
                                                        </TableBody>
                                                         <TableFooter>
                                                            <TableRow className="font-semibold"><TableCell>Total Weekly Pay</TableCell><TableCell className="text-right">${week.finalPay.toFixed(2)}</TableCell></TableRow>
                                                        </TableFooter>
                                                    </Table>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>

                                    <div className="border rounded-md p-4 bg-muted/50">
                                        <h4 className="font-semibold text-lg mb-2">Employee Pay Summary for Period</h4>
                                        <Table>
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
        </div>
    );
}
