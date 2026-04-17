"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";

import { cn, toLocalMidnight, parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  orderBy,
  limit,
  Timestamp,
  addDoc,
  serverTimestamp,
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
  const [includeGroupedReport, setIncludeGroupedReport] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  // Stores the pending Firestore payload while the user previews
  const [pendingFirestorePayload, setPendingFirestorePayload] =
    React.useState<Record<string, unknown> | null>(null);

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
          const timestampDate = (
            te.timestamp as unknown as Timestamp
          )?.toDate();
          const endTimeDate = (te.endTime as unknown as Timestamp)?.toDate();
          return {
            ...te,
            // Format as local date-time string without timezone (YYYY-MM-DDTHH:mm:ss)
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
            // Format as local date-time string without timezone (YYYY-MM-DDTHH:mm:ss)
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
            // En el forEach que procesa los tasks:
            day.tasks.forEach((task) => {
              // CORRECCIÓN: Buscar directamente por taskId en lugar de nombre
              const originalTask = tasks.find((t) => t.id === task.taskId);

              if (!originalTask) {
                console.warn("⚠️ Task not found for invoicing:", {
                  taskId: task.taskId,
                  taskName: task.taskName,
                  clientId: clientData.id,
                  availableTaskIds: tasks.map((t) => t.id),
                });
                return;
              }

              // Verificar que la tarea pertenece al cliente correcto
              if (originalTask.clientId !== clientData.id) {
                console.warn("⚠️ Task belongs to different client:", {
                  taskId: task.taskId,
                  taskName: task.taskName,
                  taskClientId: originalTask.clientId,
                  expectedClientId: clientData.id,
                });
                return;
              }

              // Debug log para verificar el rate usado
              console.log("Rate calculation for invoicing:", {
                taskId: originalTask.id,
                taskName: originalTask.name,
                originalClientRate: originalTask.clientRate,
                piecePrice: originalTask.piecePrice,
                rateType: originalTask.clientRateType,
              });

              // Para tareas de piezas, usar clientRate si está disponible, sino piecePrice
              let effectiveClientRate = originalTask.clientRate;
              if (
                originalTask.clientRateType === "piece" &&
                (!effectiveClientRate || effectiveClientRate === 0)
              ) {
                effectiveClientRate = originalTask.piecePrice || 0;
                console.log("Using piecePrice as fallback for client rate:", {
                  taskId: originalTask.id,
                  taskName: originalTask.name,
                  piecePrice: originalTask.piecePrice,
                });
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

      // Sum up overtime premium
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

      // Generate consecutive invoice number by querying the highest existing one
      let invoiceNumber = "00001";
      try {
        const latestQuery = query(
          collection(firestore, "invoices"),
          orderBy("invoiceNumber", "desc"),
          limit(1)
        );
        const latestSnap = await getDocs(latestQuery);
        if (!latestSnap.empty) {
          const lastNum = parseInt(latestSnap.docs[0].data().invoiceNumber as string, 10);
          if (!isNaN(lastNum)) {
            invoiceNumber = String(lastNum + 1).padStart(5, "0");
          }
        }
      } catch (counterErr) {
        console.warn("Could not determine invoice number:", counterErr);
      }

      // Collect overtime hours from payroll summaries
      const totalOvertimeHours = filteredSummaries.reduce((acc, emp) => {
        return (
          acc +
          emp.weeklySummaries.reduce(
            (weekAcc, week) => weekAcc + (week.overtimeHours || 0),
            0
          )
        );
      }, 0);

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

        // Calculate per-employee adjustments
        const employeePaidRestBreaks = emp.weeklySummaries.reduce(
          (acc, week) => acc + week.paidRestBreaks,
          0
        );
        const employeeMinimumWageTopUp = emp.weeklySummaries.reduce(
          (acc, week) => acc + week.minimumWageTopUp,
          0
        );
        const employeeOvertimePremium = emp.weeklySummaries.reduce(
          (acc, week) => acc + (week.overtimePremium || 0),
          0
        );

        // Build task summary for this employee
        const tasksSummaryMap = new Map<string, {
          taskName: string;
          hours: number;
          pieces: number;
          taskId?: string;
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

            // Aggregate tasks for summary
            day.tasks.forEach((task) => {
              const existing = tasksSummaryMap.get(task.taskName);
              if (existing) {
                existing.hours += task.hours;
                existing.pieces += task.pieceworkCount;
              } else {
                tasksSummaryMap.set(task.taskName, {
                  taskName: task.taskName,
                  hours: task.hours,
                  pieces: task.pieceworkCount,
                  taskId: task.taskId,
                });
              }
            });
          });
        });

        // Convert task summary to array with costs
        const tasksSummary = Array.from(tasksSummaryMap.values()).map((taskSummary) => {
          const originalTask = tasks.find((t) => t.id === taskSummary.taskId);
          
          if (!originalTask) {
            console.warn("Task not found for summary:", taskSummary);
            // Determine rate type based on which quantity is greater
            // If both exist, prioritize the larger value as the primary work type
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
          };
        });

        return {
          employeeName: employee?.name || emp.employeeName,
          employeeId: emp.employeeId,
          totalHours,
          totalPieces,
          paidRestBreaks: employeePaidRestBreaks,
          minimumWageTopUp: employeeMinimumWageTopUp,
          overtimePremium: employeeOvertimePremium,
          dailyWork: dailyWork.sort(
            (a, b) =>
              parseLocalDate(a.date).getTime() -
              parseLocalDate(b.date).getTime()
          ),
          tasksSummary,
        };
      });

      const finalInvoiceData: DetailedInvoiceData = {
        client: clientData,
        date: {
          from: format(startDate, "yyyy-MM-dd"),
          to: format(endDate, "yyyy-MM-dd"),
        },
        invoiceNumber,
        invoiceDate: format(new Date(), "MM/dd/yyyy"),
        dailyBreakdown,
        laborCost,
        minimumWageTopUp: totalTopUp,
        paidRestBreaks: totalRestBreaks,
        overtimePremium: totalOvertimePremium,
        overtimeHours: totalOvertimeHours,
        subtotal,
        commission,
        total,
        employeeDetails,
      };

      // Build the Firestore payload (to be saved only when user clicks "Create Record")
      const firestorePayload: Record<string, unknown> = {
        invoiceNumber,
        invoiceDate: format(new Date(), "MM/dd/yyyy"),
        clientId: clientData.id,
        clientName: clientData.name,
        clientEmail: clientData.email || null,
        dateFrom: format(startDate, "yyyy-MM-dd"),
        dateTo: format(endDate, "yyyy-MM-dd"),
        laborCost,
        minimumWageTopUp: totalTopUp,
        paidRestBreaks: totalRestBreaks,
        overtimePremium: totalOvertimePremium,
        overtimeHours: totalOvertimeHours,
        subtotal,
        commission,
        total,
        status: "pending",
        sentAt: null,
        paidAt: null,
        emailSentCount: 0,
        dailyBreakdown,
        employeeDetails,
        invoiceClientData: {
          name: clientData.name,
          billingAddress: clientData.billingAddress ?? null,
          email: clientData.email ?? null,
          phone: clientData.phone ?? null,
          commissionRate: clientData.commissionRate ?? null,
          paymentTerms: clientData.paymentTerms ?? null,
        },
      };

      setPendingFirestorePayload(firestorePayload);
      setIsSaved(false);
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

  const handleSaveInvoice = async () => {
    if (!firestore || !pendingFirestorePayload) return;
    setIsSaving(true);
    try {
      await addDoc(collection(firestore, "invoices"), {
        ...pendingFirestorePayload,
        createdAt: serverTimestamp(),
      });
      setIsSaved(true);
      toast({
        title: "Invoice guardado",
        description: `Invoice #${pendingFirestorePayload.invoiceNumber} guardado en Gestión de Invoices.`,
      });
    } catch (saveErr) {
      console.warn("Could not save invoice record:", saveErr);
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: "No se pudo guardar el invoice. Intente de nuevo.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (invoiceData) {
    return (
      <InvoiceReportDisplay
        report={invoiceData}
        onBack={() => {
          setInvoiceData(null);
          setPendingFirestorePayload(null);
          setIsSaved(false);
        }}
        isGrouped={includeGroupedReport}
        onSave={handleSaveInvoice}
        isSaving={isSaving}
        isSaved={isSaved}
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
                // Only update if we have a valid range or are in the process of selecting
                // Prevent completely clearing the date range
                if (newDate?.from) {
                  // Convert UTC dates to local timezone to prevent date offset issues
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
          Generate Invoice
        </Button>
      </div>

      <div className="mt-4 flex items-center space-x-2">
        <Checkbox
          id="grouped-report"
          checked={includeGroupedReport}
          onCheckedChange={(checked) => setIncludeGroupedReport(checked === true)}
        />
        <label
          htmlFor="grouped-report"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Incluir reporte agrupado
        </label>
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
