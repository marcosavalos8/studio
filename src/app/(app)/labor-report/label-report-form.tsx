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
import { type DetailedLabelReportData } from "./page";
import { LabelReportDisplay } from "./report-display";
import { generatePayrollReport } from "@/ai/flows/generate-payroll-report";

type LabelReportFormProps = {
  clients: Client[];
};

export function LabelReportForm({ clients }: LabelReportFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [date, setDate] = React.useState<DateRange | undefined>();
  const [selectedClient, setSelectedClient] = React.useState<
    Client | undefined
  >();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [reportData, setReportData] =
    React.useState<DetailedLabelReportData | null>(null);

  const handleGenerate = async () => {
    if (!firestore || !selectedClient || !date?.from || !date?.to) {
      toast({
        title: "Please select a client and a date range.",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    setReportData(null);

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
          description: "Cannot generate a report without tasks.",
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
          const timestampDate = (
            te.timestamp as unknown as Timestamp
          )?.toDate();
          const endTimeDate = (te.endTime as unknown as Timestamp)?.toDate();
          return {
            ...te,
            timestamp: timestampDate
              ? format(timestampDate, "yyyy-MM-dd'T'HH:mm:ss")
              : null,
            endTime: endTimeDate
              ? format(endTimeDate, "yyyy-MM-dd'T'HH:mm:ss")
              : null,
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
          const timestampDate = (
            pw.timestamp as unknown as Timestamp
          )?.toDate();
          return {
            ...pw,
            timestamp: timestampDate
              ? format(timestampDate, "yyyy-MM-dd'T'HH:mm:ss")
              : null,
          };
        });

      const jsonData = JSON.stringify({
        employees: allEmployees,
        tasks,
        clients: [clientData],
        timeEntries,
        piecework,
      });

      // Call the AI payroll flow
      const payrollResult = await generatePayrollReport({
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        payDate: format(new Date(), "yyyy-MM-dd"),
        jsonData: jsonData,
      });

      // --- Transform payroll data into detailed report data ---
      const dailyBreakdown: DetailedLabelReportData["dailyBreakdown"] = {};

      payrollResult.employeeSummaries.forEach((emp) => {
        emp.weeklySummaries.forEach((week) => {
          week.dailyBreakdown.forEach((day) => {
            if (!dailyBreakdown[day.date]) {
              dailyBreakdown[day.date] = { tasks: {}, total: 0 };
            }
            day.tasks.forEach((task) => {
              const originalTask = tasks.find((t) => t.id === task.taskId);

              if (!originalTask) {
                console.warn("⚠️ Task not found for label report:", {
                  taskId: task.taskId,
                  taskName: task.taskName,
                  clientId: clientData.id,
                });
                return;
              }

              if (originalTask.clientId !== clientData.id) {
                console.warn("⚠️ Task belongs to different client:", {
                  taskId: task.taskId,
                  taskName: task.taskName,
                  taskClientId: originalTask.clientId,
                  expectedClientId: clientData.id,
                });
                return;
              }

              let effectiveClientRate = originalTask.clientRate;
              if (
                originalTask.clientRateType === "piece" &&
                (!effectiveClientRate || effectiveClientRate === 0)
              ) {
                effectiveClientRate = originalTask.piecePrice || 0;
              }

              if (!dailyBreakdown[day.date].tasks[task.taskName]) {
                dailyBreakdown[day.date].tasks[task.taskName] = {
                  taskName: task.taskName,
                  hours: 0,
                  pieces: 0,
                  cost: 0,
                  clientRate: effectiveClientRate,
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

      const relevantEmployeeIds = new Set(
        [...timeEntries, ...piecework].map((entry) => entry.employeeId)
      );
      const filteredSummaries = payrollResult.employeeSummaries.filter((emp) =>
        relevantEmployeeIds.has(emp.employeeId)
      );

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

      const totalOvertimePremium = filteredSummaries.reduce((acc, emp) => {
        return (
          acc +
          emp.weeklySummaries.reduce(
            (weekAcc, week) => weekAcc + (week.overtimePremium || 0),
            0
          )
        );
      }, 0);

      const subtotal = laborCost + totalTopUp + totalRestBreaks + totalOvertimePremium;
      const commission = clientData.commissionRate
        ? subtotal * (clientData.commissionRate / 100)
        : 0;
      const total = subtotal + commission;

      // Build employee details for the report
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

        const employeePaidRestBreaks = emp.weeklySummaries.reduce(
          (acc, week) => acc + week.paidRestBreaks,
          0
        );
        const employeeMinimumWageTopUp = emp.weeklySummaries.reduce(
          (acc, week) => acc + week.minimumWageTopUp,
          0
        );
        // Calculate all overtime values in a single pass
        const overtimeData = emp.weeklySummaries.reduce(
          (acc, week) => {
            const weekOvertimeHours = week.overtimeHours || 0;
            return {
              overtimePremium: acc.overtimePremium + (week.overtimePremium || 0),
              overtimeHours: acc.overtimeHours + weekOvertimeHours,
              weightedRateSum: acc.weightedRateSum + (week.regularRate || 0) * weekOvertimeHours,
            };
          },
          { overtimePremium: 0, overtimeHours: 0, weightedRateSum: 0 }
        );
        
        const employeeOvertimePremium = overtimeData.overtimePremium;
        const employeeOvertimeHours = overtimeData.overtimeHours;
        const employeeRegularRate = overtimeData.overtimeHours > 0 
          ? overtimeData.weightedRateSum / overtimeData.overtimeHours 
          : 0;

        const tasksSummaryMap = new Map<string, {
          taskName: string;
          hours: number;
          pieces: number;
          taskId?: string;
          isMissingBuckets?: boolean;
        }>();

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
            totalPieces += day.tasks.reduce(
              (sum, task) => sum + task.pieceworkCount,
              0
            );

            day.tasks.forEach((task) => {
              const existing = tasksSummaryMap.get(task.taskName);
              if (existing) {
                existing.hours += task.hours;
                existing.pieces += task.pieceworkCount;
                if (task.isMissingBuckets) existing.isMissingBuckets = true;
              } else {
                tasksSummaryMap.set(task.taskName, {
                  taskName: task.taskName,
                  hours: task.hours,
                  pieces: task.pieceworkCount,
                  taskId: task.taskId,
                  isMissingBuckets: task.isMissingBuckets,
                });
              }
            });
          });
        });

        const tasksSummary = Array.from(tasksSummaryMap.values()).map((taskSummary) => {
          const originalTask = tasks.find((t) => t.id === taskSummary.taskId);
          
          if (!originalTask) {
            const quantity = taskSummary.hours >= taskSummary.pieces 
              ? taskSummary.hours 
              : taskSummary.pieces;
            const rateType = taskSummary.hours >= taskSummary.pieces 
              ? "hourly" as const
              : "piece" as const;
            return {
              taskName: taskSummary.taskName,
              quantity,
              rate: 0,
              rateType,
              cost: 0,
              isMissingBuckets: taskSummary.isMissingBuckets,
            };
          }

          const isHourly = originalTask.clientRateType === "hourly";
          const quantity = isHourly ? taskSummary.hours : taskSummary.pieces;
          let effectiveClientRate = originalTask.clientRate;

          if (!isHourly && (!effectiveClientRate || effectiveClientRate === 0)) {
            effectiveClientRate = originalTask.piecePrice || 0;
          }

          return {
            taskName: taskSummary.taskName,
            quantity,
            rate: effectiveClientRate,
            rateType: originalTask.clientRateType,
            cost: quantity * effectiveClientRate,
            isMissingBuckets: taskSummary.isMissingBuckets,
          };
        });

        return {
          employeeName: employee?.name || emp.employeeName,
          employeeId: emp.employeeId,
          totalHours,
          totalPieces,
          paidRestBreaks: employeePaidRestBreaks,
          minimumWageTopUp: employeeMinimumWageTopUp,
          overtimeHours: employeeOvertimeHours,
          overtimePremium: employeeOvertimePremium,
          regularRate: employeeRegularRate,
          dailyWork: dailyWork.sort(
            (a, b) =>
              parseLocalDate(a.date).getTime() -
              parseLocalDate(b.date).getTime()
          ),
          tasksSummary,
        };
      });

      const finalReportData: DetailedLabelReportData = {
        client: clientData,
        date: {
          from: format(startDate, "yyyy-MM-dd"),
          to: format(endDate, "yyyy-MM-dd"),
        },
        dailyBreakdown,
        laborCost,
        minimumWageTopUp: totalTopUp,
        paidRestBreaks: totalRestBreaks,
        overtimePremium: totalOvertimePremium,
        subtotal,
        commission,
        total,
        employeeDetails,
      };
      setReportData(finalReportData);
    } catch (err) {
      console.error("Error generating label report:", err);
      toast({
        variant: "destructive",
        title: "Report Generation Failed",
        description:
          "Could not fetch or process data for the report. Please check the console for errors.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (reportData) {
    return (
      <LabelReportDisplay
        report={reportData}
        onBack={() => setReportData(null)}
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
                if (newDate?.from) {
                  setDate({
                    from: toLocalMidnight(newDate.from),
                    to: toLocalMidnight(newDate.to),
                  });
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
          Generate Report
        </Button>
      </div>

      {isGenerating && (
        <div className="mt-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Generating report... This may take a moment.
          </p>
        </div>
      )}
    </div>
  );
}
