"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";

import { cn, toLocalMidnight, parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client, Task, Piecework, TimeEntry, Employee } from "@/lib/types";
import type { DateRange } from "react-day-picker";
import { useFirestore } from "@/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { type DetailedInvoiceData } from "./page";
import { InvoiceReportDisplay } from "./report-display";
import { generatePayrollReport } from "@/ai/flows/generate-payroll-report";

type InvoicingFormProps = {
  clients: Client[];
};

export function InvoicingForm({ clients }: InvoicingFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [date, setDate] = React.useState<DateRange | undefined>();
  const [selectedClient, setSelectedClient] = React.useState<
    Client | undefined
  >();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [invoiceData, setInvoiceData] =
    React.useState<DetailedInvoiceData | null>(null);

  const handleGenerate = async () => {
    if (!firestore || !selectedClient || !date?.from || !date?.to) {
      toast({
        title: "Please select a client and a date range.",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    setInvoiceData(null);

    const clientData = clients.find((c) => c.id === selectedClient.id);
    if (!clientData) {
      setIsGenerating(false);
      return;
    }

    const startDate = new Date(date.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date.to);
    endDate.setHours(23, 59, 59, 999);

    try {
      // Fetch all data required for the payroll flow
      const employeesSnap = await getDocs(collection(firestore, "employees"));
      const allEmployees = employeesSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Employee)
      );

      const tasksSnap = await getDocs(
        query(
          collection(firestore, "tasks"),
          where("clientId", "==", clientData.id)
        )
      );
      const tasks = tasksSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Task)
      );

      const taskIds = tasks.map((t) => t.id);

      if (taskIds.length === 0) {
        toast({
          title: "No tasks found for this client.",
          description: "Cannot generate an invoice without tasks.",
        });
        setIsGenerating(false);
        return;
      }

      // Fetch all entries within the date range, then filter by task IDs in code
      const timeEntriesQuery = query(
        collection(firestore, "time_entries"),
        where("timestamp", ">=", startDate),
        where("timestamp", "<=", endDate)
      );
      const timeEntriesSnap = await getDocs(timeEntriesQuery);
      const timeEntries = timeEntriesSnap.docs
        .map((doc) => ({ ...doc.data(), id: doc.id } as TimeEntry))
        .filter((te) => taskIds.includes(te.taskId))
        .map((te) => {
          const timestampDate = (te.timestamp as unknown as Timestamp)?.toDate();
          const endTimeDate = (te.endTime as unknown as Timestamp)?.toDate();
          return {
            ...te,
            // Format as local date-time string without timezone (YYYY-MM-DDTHH:mm:ss)
            timestamp: timestampDate ? format(timestampDate, "yyyy-MM-dd'T'HH:mm:ss") : null,
            endTime: endTimeDate ? format(endTimeDate, "yyyy-MM-dd'T'HH:mm:ss") : null,
          };
        });

      const pieceworkQuery = query(
        collection(firestore, "piecework"),
        where("timestamp", ">=", startDate),
        where("timestamp", "<=", endDate)
      );
      const pieceworkSnap = await getDocs(pieceworkQuery);
      const piecework = pieceworkSnap.docs
        .map((doc) => ({ ...doc.data(), id: doc.id } as Piecework))
        .filter((pw) => taskIds.includes(pw.taskId))
        .map((pw) => {
          const timestampDate = (pw.timestamp as unknown as Timestamp)?.toDate();
          return {
            ...pw,
            // Format as local date-time string without timezone (YYYY-MM-DDTHH:mm:ss)
            timestamp: timestampDate ? format(timestampDate, "yyyy-MM-dd'T'HH:mm:ss") : null,
          };
        });

      const jsonData = JSON.stringify({
        employees: allEmployees,
        tasks,
        clients: [clientData],
        timeEntries,
        piecework,
      });
      console.log("Sending to payroll generation:", {
        employeesCount: allEmployees.length,
        tasksCount: tasks.length,
        timeEntriesCount: timeEntries.length,
        pieceworkCount: piecework.length,
        jsonDataLength: jsonData.length,
      });
      // Call the AI payroll flow
      const payrollResult = await generatePayrollReport({
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        payDate: format(new Date(), "yyyy-MM-dd"), // Pay date is not critical for invoice
        jsonData: jsonData,
      });

      // --- Transform payroll data into detailed invoice data ---
      const dailyBreakdown: DetailedInvoiceData["dailyBreakdown"] = {};

      payrollResult.employeeSummaries.forEach((emp) => {
        emp.weeklySummaries.forEach((week) => {
          week.dailyBreakdown.forEach((day) => {
            if (!dailyBreakdown[day.date]) {
              dailyBreakdown[day.date] = { tasks: {}, total: 0 };
            }
            day.tasks.forEach((task) => {
              // Ensure task is for the currently selected client
              const originalTask = tasks.find(
                (t) =>
                  t.name === task.taskName.split(" (")[0] &&
                  t.clientId === clientData.id
              );
              if (!originalTask) return;

              if (!dailyBreakdown[day.date].tasks[task.taskName]) {
                dailyBreakdown[day.date].tasks[task.taskName] = {
                  taskName: task.taskName,
                  hours: 0,
                  pieces: 0,
                  cost: 0,
                  clientRate: originalTask.clientRate,
                  clientRateType: originalTask.clientRateType,
                };
              }
              const taskDetail = dailyBreakdown[day.date].tasks[task.taskName];
              taskDetail.hours += task.hours;
              taskDetail.pieces += task.pieceworkCount;
            });
          });
        });
      });

      // Recalculate costs and daily totals based on client rates
      Object.values(dailyBreakdown).forEach((day) => {
        let dailyTotal = 0;
        Object.values(day.tasks).forEach((task) => {
          if (task.clientRateType === "hourly") {
            task.cost = task.hours * task.clientRate;
          } else {
            task.cost = task.pieces * task.clientRate;
          }
          dailyTotal += task.cost;
        });
        day.total = dailyTotal;
      });

      const laborCost = Object.values(dailyBreakdown).reduce(
        (acc, day) => acc + day.total,
        0
      );
      // Sum up adjustments ONLY for employees who worked on this client's tasks
      // Sum up adjustments ONLY for employees who worked on this client's tasks
      const relevantEmployeeIds = new Set(
        [...timeEntries, ...piecework].map((entry) => entry.employeeId)
      );
      const filteredSummaries = payrollResult.employeeSummaries.filter((emp) =>
        relevantEmployeeIds.has(emp.employeeId)
      );

      // CORRECCIÓN: Sumar los ajustes recorriendo los weeklySummaries
      const totalTopUp = filteredSummaries.reduce((acc, emp) => {
        return (
          acc +
          emp.weeklySummaries.reduce(
            (weekAcc, week) => weekAcc + week.minimumWageTopUp,
            0
          )
        );
      }, 0);

      const totalRestBreaks = filteredSummaries.reduce((acc, emp) => {
        return (
          acc +
          emp.weeklySummaries.reduce(
            (weekAcc, week) => weekAcc + week.paidRestBreaks,
            0
          )
        );
      }, 0);

      const subtotal = laborCost + totalTopUp + totalRestBreaks;
      const commission = clientData.commissionRate
        ? subtotal * (clientData.commissionRate / 100)
        : 0;
      const total = subtotal + commission;

      // Build employee details for the optional second page
      const employeeDetails = filteredSummaries.map((emp) => {
        const employee = allEmployees.find((e) => e.id === emp.employeeId);
        const dailyWork: Array<{
          date: string;
          tasks: Array<{
            taskName: string;
            hours: number;
            pieces: number;
          }>;
        }> = [];
        
        let totalHours = 0;
        let totalPieces = 0;

        emp.weeklySummaries.forEach((week) => {
          week.dailyBreakdown.forEach((day) => {
            const dayTasks = day.tasks.map((task) => ({
              taskName: task.taskName,
              hours: task.hours,
              pieces: task.pieceworkCount,
            }));
            
            dailyWork.push({
              date: day.date,
              tasks: dayTasks,
            });
            
            totalHours += day.totalDailyHours;
            totalPieces += day.tasks.reduce((sum, task) => sum + task.pieceworkCount, 0);
          });
        });

        return {
          employeeName: employee?.name || emp.employeeName,
          employeeId: emp.employeeId,
          totalHours,
          totalPieces,
          dailyWork: dailyWork.sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()),
        };
      });

      const finalInvoiceData: DetailedInvoiceData = {
        client: clientData,
        date: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
        dailyBreakdown,
        laborCost,
        minimumWageTopUp: totalTopUp,
        paidRestBreaks: totalRestBreaks,
        subtotal,
        commission,
        total,
        employeeDetails,
      };
      setInvoiceData(finalInvoiceData);
    } catch (err) {
      console.error("Error generating invoice:", err);
      toast({
        variant: "destructive",
        title: "Invoice Generation Failed",
        description:
          "Could not fetch or process data for the invoice. Please check the console for errors.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (invoiceData) {
    return (
      <InvoiceReportDisplay
        report={invoiceData}
        onBack={() => setInvoiceData(null)}
      />
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          onValueChange={(value: string) =>
            setSelectedClient(clients.find((c) => c.id === value))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
              onSelect={(newDate) => {
                // Convert UTC dates to local timezone to prevent date offset issues
                if (newDate) {
                  setDate({
                    from: toLocalMidnight(newDate.from),
                    to: toLocalMidnight(newDate.to),
                  });
                } else {
                  setDate(undefined);
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedClient || !date}
        >
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Invoice
        </Button>
      </div>

      {isGenerating && (
        <div className="mt-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Generating invoice... This may take a moment.
          </p>
        </div>
      )}
    </div>
  );
}
