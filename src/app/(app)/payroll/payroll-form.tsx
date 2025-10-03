
'use client'

import * as React from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2, Download, Printer, Mail, MoreVertical, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { generateReportAction } from "./actions"
import type { DateRange } from "react-day-picker"
import { useFirestore } from "@/firebase"
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore'
import { Client, Employee, Piecework, Task, TimeEntry } from "@/lib/types"
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
import { Label } from "@/components/ui/label"

function SubmitButton({disabled}: {disabled: boolean}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      Generate Report
    </Button>
  )
}

function DailyBreakdownDisplay({ breakdown }: { breakdown: ProcessedPayrollData['employeeSummaries'][0]['weeklySummaries'][0]['dailyBreakdown']}) {
  return (
    <div className="space-y-2 pl-4">
      {breakdown.map(day => (
        <div key={day.date} className="bg-muted/40 p-3 rounded-md">
          <p className="font-semibold">{format(new Date(day.date), "EEEE, LLL dd")}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Pieces</TableHead>
                <TableHead className="text-right">Earnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {day.tasks.map((task, idx) => (
                <TableRow key={idx}>
                  <TableCell>{task.taskName}</TableCell>
                  <TableCell className="text-right">{task.hours > 0 ? task.hours.toFixed(2) : '-'}</TableCell>
                  <TableCell className="text-right">{task.pieceworkCount > 0 ? task.pieceworkCount : '-'}</TableCell>
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


export function ReportDisplay({ report }: { report: ProcessedPayrollData }) {
  const overallTotal = report.employeeSummaries.reduce((acc, emp) => acc + emp.finalPay, 0);

  const handlePrint = () => {
    try {
        const reportString = JSON.stringify(report);
        sessionStorage.setItem('payrollReportData', reportString);
        window.open('/payroll/print', '_blank');
    } catch (error) {
        console.error("Failed to stringify report data for printing:", error);
        alert("Could not prepare the report for printing. Please check the console for errors.");
    }
  }
  
  const handleEmail = () => {
    if (!report.startDate || !report.endDate) return;
    const subject = `Payroll Report for ${format(new Date(report.startDate), "LLL dd, y")} - ${format(new Date(report.endDate), "LLL dd, y")}`;
    
    const reportString = JSON.stringify(report);
    sessionStorage.setItem('payrollReportData', reportString);
    const printUrl = `${window.location.origin}/payroll/print`;

    let body = `Hello Accountant,\n\nPlease find the payroll summary for the period of ${format(new Date(report.startDate), "LLL dd, y")} to ${format(new Date(report.endDate), "LLL dd, y")}.\n\n`;
    body += `You can view and print the full report here:\n${printUrl}\n\n`;
    body += `To save as a PDF:\n`;
    body += `1. Open the link above.\n`;
    body += `2. Press Ctrl+P or Cmd+P to open the print dialog.\n`;
    body += `3. Change the 'Destination' to 'Save as PDF' and click 'Save'.\n\n`;
    body += `Report Summary:\n`;
    body += `Total Payroll: $${overallTotal.toFixed(2)}\n\n`;
    body += 'Thank you!';

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  return (
    <div className="mt-6 bg-card p-4 sm:p-6 rounded-lg border">
       <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Payroll Report</h2>
              <div className="text-muted-foreground">For period: {format(new Date(report.startDate), "LLL dd, y")} - {format(new Date(report.endDate), "LLL dd, y")}</div>
              <div className="text-muted-foreground">Pay Date: {format(new Date(report.payDate), "LLL dd, y")}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">FieldTack WA</div>
              <div className="text-sm text-muted-foreground">Report Generated: {format(new Date(), "LLL dd, y")}</div>
              <div className="text-lg font-bold">Total Payroll: ${overallTotal.toFixed(2)}</div>
            </div>
        </div>
        <Accordion type="multiple" className="w-full" defaultValue={report.employeeSummaries.map(e => e.employeeId)}>
            {report.employeeSummaries.map(employee => (
                <AccordionItem value={employee.employeeId} key={employee.employeeId}>
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline">
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
                                  <AccordionTrigger className="font-semibold text-md mb-2 ml-4">
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
                                                {week.minimumWageTopUp > 0 && <TableRow className="bg-amber-50 dark:bg-amber-900/20"><TableCell className="font-semibold">Minimum Wage Top-up</TableCell><TableCell className="text-right font-semibold">+ ${week.minimumWageTopUp.toFixed(2)}</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                      </div>
                                  </AccordionContent>
                              </AccordionItem>
                          ))}
                        </Accordion>

                         <div className="border rounded-md p-4 bg-muted/40">
                            <h4 className="font-semibold text-md mb-2">Employee Pay Summary for Period</h4>
                             <Table>
                               <TableBody>
                                  <TableRow><TableCell>Subtotal Earnings</TableCell><TableCell className="text-right">${employee.overallTotalEarnings.toFixed(2)}</TableCell></TableRow>
                                  <TableRow><TableCell>Total Paid Rest Breaks</TableCell><TableCell className="text-right">+ ${employee.overallTotalPaidRestBreaks.toFixed(2)}</TableCell></TableRow>
                                  {employee.overallTotalMinimumWageTopUp > 0 && <TableRow><TableCell>Total Minimum Wage Top-up</TableCell><TableCell className="text-right">+ ${employee.overallTotalMinimumWageTopUp.toFixed(2)}</TableCell></TableRow>}
                               </TableBody>
                               <TableFooter>
                                <TableRow className="text-base font-bold"><TableCell>Final Pay</TableCell><TableCell className="text-right">${employee.finalPay.toFixed(2)}</TableCell></TableRow>
                               </TableFooter>
                             </Table>
                          </div>
                      </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>

      <div className="flex justify-end items-center mt-6">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                   <span className="sr-only">Actions</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Print / Save as PDF</DropdownMenuItem>
                 <DropdownMenuItem onClick={handleEmail}><Mail className="mr-2 h-4 w-4" />Email Report</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

const initialState = {
  report: undefined,
  error: undefined,
}

export function PayrollForm() {
  const [state, formAction] = useActionState(generateReportAction, initialState)
  const [date, setDate] = React.useState<DateRange | undefined>()
  const [payDate, setPayDate] = React.useState<Date | undefined>(new Date())
  const [jsonData, setJsonData] = React.useState<string | null>(null);
  const [isFetchingData, setIsFetchingData] = React.useState(false);
  const { toast } = useToast()
  const firestore = useFirestore();

  React.useEffect(() => {
    if (state.error) {
      toast({
        variant: "destructive",
        title: "Error Generating Report",
        description: state.error,
      })
    }
  }, [state.error, toast])
  
  React.useEffect(() => {
    const fetchPayrollData = async () => {
        if (!date?.from || !date.to || !firestore) {
            setJsonData(null);
            return;
        }

        setIsFetchingData(true);
        try {
            const start = date.from;
            const end = date.to;

            const employeesSnap = await getDocs(collection(firestore, 'employees'));
            const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));

            const tasksSnap = await getDocs(collection(firestore, 'tasks'));
            const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
            
            const clientsSnap = await getDocs(collection(firestore, 'clients'));
            const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));

            const timeEntriesQuery = query(collection(firestore, 'time_entries'),
                where('timestamp', '>=', start),
                where('timestamp', '<=', end)
            );
            const timeEntriesSnap = await getDocs(timeEntriesQuery);
            const timeEntries = timeEntriesSnap.docs.map(doc => {
                const data = doc.data();
                return { 
                    ...data,
                    id: doc.id,
                    timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() || null,
                    endTime: (data.endTime as Timestamp)?.toDate()?.toISOString() || null,
                } as any;
            });

            const pieceworkQuery = query(collection(firestore, 'piecework'),
                where('timestamp', '>=', start),
                where('timestamp', '<=', end)
            );
            const pieceworkSnap = await getDocs(pieceworkQuery);
            const piecework = pieceworkSnap.docs.map(doc => {
                const data = doc.data();
                return { 
                    ...data,
                    id: doc.id,
                    timestamp: (data.timestamp as Timestamp)?.toDate().toISOString() || null,
                } as any;
            });

            setJsonData(JSON.stringify({
                employees,
                tasks,
                clients,
                timeEntries,
                piecework
            }));
        } catch (error) {
            console.error("Failed to fetch payroll data:", error);
            toast({
                variant: "destructive",
                title: "Data Fetch Error",
                description: "Could not fetch payroll data from Firestore. Please check console for details."
            });
            setJsonData(null);
        } finally {
            setIsFetchingData(false);
        }
    };
    
    fetchPayrollData();
  }, [date, firestore, toast]);

  return (
    <form action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 print:hidden">
        <div className="grid gap-4">
            <div>
              <Label>Period</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} -{" "}
                          {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
                <Label>Pay Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !payDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {payDate ? format(payDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={payDate}
                            onSelect={setPayDate}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
        <div>
          <SubmitButton disabled={!date || !jsonData || isFetchingData || !payDate} />
           {isFetchingData && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/>Fetching data for selected range...</p>}
        </div>
          {date?.from && <input type="hidden" name="from" value={format(date.from, 'yyyy-MM-dd')} />}
          {date?.to && <input type="hidden" name="to" value={format(date.to, 'yyyy-MM-dd')} />}
          {payDate && <input type="hidden" name="payDate" value={format(payDate, 'yyyy-MM-dd')} />}
          {jsonData && <input type="hidden" name="jsonData" value={jsonData} />}
      </div>
      
      {state.report && <ReportDisplay report={state.report} />}
    </form>
  )
}
