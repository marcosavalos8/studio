'use client'

import * as React from "react"
import { useActionState } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { generateReportAction } from "./actions"
import type { DateRange } from "react-day-picker"
import { useFirestore } from "@/firebase"
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore'
import { Client, Employee, Piecework, Task, TimeEntry, ProcessedPayrollData } from "@/lib/types"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PayrollReportDisplay } from "./report-display"

const initialState = {
  report: undefined,
  error: undefined,
}

export function PayrollForm() {
  const [state, formAction, isPending] = useActionState(generateReportAction, initialState)
  const [date, setDate] = React.useState<DateRange | undefined>()
  const [payDate, setPayDate] = React.useState<Date | undefined>(new Date())
  const [isFetchingData, setIsFetchingData] = React.useState(false);
  const { toast } = useToast()
  const firestore = useFirestore();

  const [allData, setAllData] = React.useState<any>(null);
  const [employeesInRange, setEmployeesInRange] = React.useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<Set<string>>(new Set());
  
  const [reportData, setReportData] = React.useState<ProcessedPayrollData | null>(null);

  React.useEffect(() => {
    if (state.error) {
      toast({
        variant: "destructive",
        title: "Error Generating Report",
        description: state.error,
      })
      setReportData(null);
    }
     if (state.report) {
      setReportData(state.report as ProcessedPayrollData);
    }
  }, [state, toast])
  
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
            const start = new Date(date.from.setHours(0, 0, 0, 0));
            const end = new Date(date.to.setHours(23, 59, 59, 999));

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
            timeEntries.forEach((entry: TimeEntry) => employeeIdsWithActivity.add(entry.employeeId));
            piecework.forEach((entry: Piecework) => {
              const ids = String(entry.employeeId || '').split(',');
              ids.forEach((id: string) => {
                if (id.trim()) {
                    const emp = allEmployees.find(e => e.id === id.trim() || e.qrCode === id.trim());
                    if (emp) {
                      employeeIdsWithActivity.add(emp.id);
                    }
                }
              });
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
    return JSON.stringify({
        employees: filteredEmployees,
        tasks: allData.tasks,
        clients: allData.clients,
        timeEntries: allData.timeEntries,
        piecework: allData.piecework
    });
  }


  const jsonData = getFilteredJsonData();
  const allEmployeesSelected = employeesInRange.length > 0 && selectedEmployeeIds.size === employeesInRange.length;

  if (reportData) {
    return <PayrollReportDisplay report={reportData} onBack={() => setReportData(null)} />;
  }

  return (
    <form action={formAction}>
      <div className="grid gap-4 sm:grid-cols-2 mb-4">
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
          <Button type="submit" disabled={isPending || !date || !jsonData || isFetchingData || !payDate || selectedEmployeeIds.size === 0}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Report
          </Button>
           {isFetchingData && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/>Fetching data for selected range...</p>}
           {!isFetchingData && date?.from && employeesInRange.length > 0 && <p className="text-xs text-muted-foreground mt-2">{selectedEmployeeIds.size} of {employeesInRange.length} employees selected.</p>}
           {!isFetchingData && date?.from && employeesInRange.length === 0 && <p className="text-xs text-amber-600 mt-2">No employee activity found for this date range.</p>}
        </div>
      </div>
      
      {isFetchingData && (
        <div className="mt-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-muted-foreground">Finding employees with activity...</p>
        </div>
      )}

      {!isFetchingData && employeesInRange.length > 0 && (
         <Card>
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
