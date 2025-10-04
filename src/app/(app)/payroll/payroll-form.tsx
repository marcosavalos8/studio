'use client'

import * as React from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2, MoreVertical, Printer, Mail, Users, X } from "lucide-react"

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
import { Checkbox } from "@/components/ui/checkbox"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
                    <div className="text-xs text-muted-foreground">{task.clientName} {task.ranch && ` - ${task.ranch}`}</div>
                  </TableCell>
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
    window.print();
  }
  
  const handleEmail = () => {
    if (!report.startDate || !report.endDate) return;
    const subject = `Payroll Report for ${format(new Date(report.startDate), "LLL dd, y")} - ${format(new Date(report.endDate), "LLL dd, y")}`;
    
    // The body will now instruct to print the current page to PDF
    let body = `Hello Accountant,\n\nPlease find the payroll summary for the period of ${format(new Date(report.startDate), "LLL dd, y")} to ${format(new Date(report.endDate), "LLL dd, y")}.\n\n`;
    body += `To save this report as a PDF, please use your browser's print function (Ctrl+P or Cmd+P) and select 'Save as PDF' as the destination.\n\n`;
    body += `Report Summary:\n`;
    body += `Total Payroll: $${overallTotal.toFixed(2)}\n\n`;
    body += 'Thank you!';

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const { toast } = useToast();

  return (
    <div className="mt-6 bg-card p-4 sm:p-6 rounded-lg border print:border-none print:shadow-none print:p-0">
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
                <AccordionItem value={employee.employeeId} key={employee.employeeId} className="print:border-b print:page-before">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline print:no-underline print:text-xl">
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
                                  <AccordionTrigger className="font-semibold text-md mb-2 ml-4 print:text-lg">
                                      Week {week.weekNumber}, {week.year}
                                  </AccordionTrigger>
                                  <AccordionContent className="space-y-4 pl-4">
                                      <DailyBreakdownDisplay breakdown={week.dailyBreakdown} />
                                      <div className="border rounded-md p-4 mt-4 print:border-gray-200">
                                        <h5 className="font-semibold mb-2">Week {week.weekNumber} Financial Summary</h5>
                                        <Table>
                                            <TableBody>
                                                <TableRow><TableCell>Total Hours Worked</TableCell><TableCell className="text-right">{week.totalHours.toFixed(2)}</TableCell></TableRow>
                                                <TableRow><TableCell>Total Earnings (Hourly + Piecework)</TableCell><TableCell className="text-right">${week.totalEarnings.toFixed(2)}</TableCell></TableRow>
                                                <TableRow><TableCell>Effective Hourly Rate</TableCell><TableCell className="text-right">${week.effectiveHourlyRate.toFixed(2)}</TableCell></TableRow>
                                                <TableRow><TableCell>Paid Rest Breaks (10 min / 4 hrs)</TableCell><TableCell className="text-right">+ ${week.paidRestBreaksTotal.toFixed(2)}</TableCell></TableRow>
                                                {week.minimumWageTopUp > 0 && <TableRow className="bg-amber-50 dark:bg-amber-900/20 print:bg-amber-50"><TableCell className="font-semibold">Minimum Wage Top-up</TableCell><TableCell className="text-right font-semibold">+ ${week.minimumWageTopUp.toFixed(2)}</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                      </div>
                                  </AccordionContent>
                              </AccordionItem>
                          ))}
                        </Accordion>

                         <div className="border rounded-md p-4 bg-muted/40 print:bg-gray-50">
                            <h4 className="font-semibold text-md mb-2 print:text-lg">Employee Pay Summary for Period</h4>
                             <Table>
                               <TableBody>
                                  <TableRow><TableCell>Subtotal Earnings</TableCell><TableCell className="text-right">${employee.overallTotalEarnings.toFixed(2)}</TableCell></TableRow>
                                  <TableRow><TableCell>Total Paid Rest Breaks</TableCell><TableCell className="text-right">+ ${employee.overallTotalPaidRestBreaks.toFixed(2)}</TableCell></TableRow>
                                  {employee.overallTotalMinimumWageTopUp > 0 && <TableRow><TableCell>Total Minimum Wage Top-up</TableCell><TableCell className="text-right">+ ${employee.overallTotalMinimumWageTopUp.toFixed(2)}</TableCell></TableRow>}
                               </TableBody>
                               <TableFooter>
                                <TableRow className="text-base font-bold print:text-lg"><TableCell>Final Pay</TableCell><TableCell className="text-right">${employee.finalPay.toFixed(2)}</TableCell></TableRow>
                               </TableFooter>
                             </Table>
                          </div>
                      </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>

      <div className="flex justify-end items-center mt-6 print:hidden">
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
  const [isFetchingData, setIsFetchingData] = React.useState(false);
  const { toast } = useToast()
  const firestore = useFirestore();

  const [allData, setAllData] = React.useState<any>(null);
  const [employeesInRange, setEmployeesInRange] = React.useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<Set<string>>(new Set());

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
            setAllData(null);
            setEmployeesInRange([]);
            setSelectedEmployeeIds(new Set());
            return;
        }

        setIsFetchingData(true);
        try {
            const start = date.from;
            const end = date.to;

            const employeesSnap = await getDocs(collection(firestore, 'employees'));
            const allEmployees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            const allEmployeesMap = new Map(allEmployees.map(e => [e.id, e]));

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
            
            const employeeIdsWithActivity = new Set<string>();
            timeEntries.forEach(entry => employeeIdsWithActivity.add(entry.employeeId));
            piecework.forEach(entry => {
              // Handle both single and shared piecework employee IDs
              const ids = entry.employeeId.split(',');
              ids.forEach((id: string) => employeeIdsWithActivity.add(id.trim()));
            });

            const activeEmployees = Array.from(employeeIdsWithActivity)
                .map(id => allEmployeesMap.get(id))
                .filter((e): e is Employee => !!e)
                .sort((a,b) => a.name.localeCompare(b.name));
            
            setAllData({ allEmployees, tasks, clients, timeEntries, piecework });
            setEmployeesInRange(activeEmployees);
            setSelectedEmployeeIds(new Set(activeEmployees.map(e => e.id)));

        } catch (error) {
            console.error("Failed to fetch payroll data:", error);
            toast({
                variant: "destructive",
                title: "Data Fetch Error",
                description: "Could not fetch payroll data from Firestore. Please check console for details."
            });
            setAllData(null);
        } finally {
            setIsFetchingData(false);
        }
    };
    
    fetchPayrollData();
  }, [date, firestore, toast]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        setSelectedEmployeeIds(new Set(employeesInRange.map(e => e.id)));
    } else {
        setSelectedEmployeeIds(new Set());
    }
  };

  const handleEmployeeSelect = (employeeId: string, checked: boolean) => {
    const newSet = new Set(selectedEmployeeIds);
    if (checked) {
        newSet.add(employeeId);
    } else {
        newSet.delete(employeeId);
    }
    setSelectedEmployeeIds(newSet);
  };

  const getFilteredJsonData = () => {
    if (!allData) return null;
    
    const filteredEmployees = allData.allEmployees.filter((e: Employee) => selectedEmployeeIds.has(e.id));
    const filteredTimeEntries = allData.timeEntries.filter((te: TimeEntry) => selectedEmployeeIds.has(te.employeeId));
    const filteredPiecework = allData.piecework.filter((pw: Piecework) => {
        const ids = pw.employeeId.split(',');
        return ids.some(id => selectedEmployeeIds.has(id.trim()));
    });

    return JSON.stringify({
        employees: filteredEmployees,
        tasks: allData.tasks,
        clients: allData.clients,
        timeEntries: filteredTimeEntries,
        piecework: filteredPiecework
    });
  }

  const jsonData = getFilteredJsonData();
  const allEmployeesSelected = employeesInRange.length > 0 && selectedEmployeeIds.size === employeesInRange.length;

  if (state.report) {
    return (
        <div className="printable-report-container">
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .printable-report-container, .printable-report-container * {
                        visibility: visible;
                    }
                    .printable-report-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .page-before {
                       break-before: page;
                    }
                }
            `}</style>
            <Button onClick={() => window.location.reload()} className="mb-4 print:hidden">
                <X className="mr-2 h-4 w-4" />
                Close Report
            </Button>
            <ReportDisplay report={state.report} />
        </div>
    )
  }

  return (
    <form action={formAction} className="print:hidden">
      <div className="grid gap-4 sm:grid-cols-2 print:hidden mb-4">
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
          <SubmitButton disabled={!date || !jsonData || isFetchingData || !payDate || selectedEmployeeIds.size === 0} />
           {isFetchingData && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/>Fetching data for selected range...</p>}
           {!isFetchingData && employeesInRange.length > 0 && <p className="text-xs text-muted-foreground mt-2">{selectedEmployeeIds.size} of {employeesInRange.length} employees selected.</p>}
        </div>
      </div>
      
      {isFetchingData && (
        <div className="mt-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-muted-foreground">Finding employees with activity...</p>
        </div>
      )}

      {!isFetchingData && employeesInRange.length > 0 && (
         <Card className="print:hidden">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5"/>
                        <span>Include Employees in Payroll</span>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="select-all" 
                            checked={allEmployeesSelected}
                            onCheckedChange={handleSelectAll}
                        />
                        <label
                          htmlFor="select-all"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Select All
                        </label>
                      </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {employeesInRange.map(employee => (
                    <div key={employee.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`employee-${employee.id}`}
                            checked={selectedEmployeeIds.has(employee.id)}
                            onCheckedChange={(checked) => handleEmployeeSelect(employee.id, !!checked)}
                        />
                        <label htmlFor={`employee-${employee.id}`} className="text-sm font-medium leading-none">
                            {employee.name}
                        </label>
                    </div>
                ))}
            </CardContent>
         </Card>
      )}


      {date?.from && <input type="hidden" name="from" value={format(date.from, 'yyyy-MM-dd')} />}
      {date?.to && <input type="hidden" name="to" value={format(date.to, 'yyyy-MM-dd')} />}
      {payDate && <input type="hidden" name="payDate" value={format(payDate, 'yyyy-MM-dd')} />}
      {jsonData && <input type="hidden" name="jsonData" value={jsonData} />}
    </form>
  )
}
