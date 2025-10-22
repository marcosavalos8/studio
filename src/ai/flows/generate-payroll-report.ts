"use server";

/**
 * @fileOverview A payroll report generation AI agent that adheres to Washington state labor laws.
 */

import { z } from "zod";
import {
  getWeek,
  getYear,
  format,
  startOfDay,
  endOfDay,
  isWithinInterval,
  differenceInMilliseconds,
  startOfWeek,
} from "date-fns";
import { parseLocalDate, parseLocalDateOrDateTime } from "@/lib/utils";
import type {
  Client,
  Task,
  ProcessedPayrollData,
  EmployeePayrollSummary,
  WeeklySummary,
  DailyBreakdown,
  DailyTaskDetail,
  Employee,
  Piecework,
  TimeEntry,
} from "@/lib/types";

// Main input schema for the server action
const GeneratePayrollReportInputSchema = z.object({
  startDate: z
    .string()
    .describe("The start date for the payroll report (YYYY-MM-DD)."),
  endDate: z
    .string()
    .describe("The end date for the payroll report (YYYY-MM-DD)."),
  payDate: z.string().describe("The date the payment is issued (YYYY-MM-DD)."),
  jsonData: z
    .string()
    .describe("A JSON string containing all necessary payroll data."),
});
export type GeneratePayrollReportInput = z.infer<
  typeof GeneratePayrollReportInputSchema
>;

export async function generatePayrollReport({
  startDate,
  endDate,
  payDate,
  jsonData,
}: GeneratePayrollReportInput) {
  try {
    const parsedData = JSON.parse(jsonData);

    // Validate and extract data from parsedData
    if (!parsedData.employees?.length) {
      throw new Error("No employees found in input data");
    }

    const allEmployees = parsedData.employees;
    const timeEntries = parsedData.timeEntries || [];
    const piecework = parsedData.piecework || [];
    const tasks = parsedData.tasks || [];
    const clients = parsedData.clients || [];

    // Debug logs
    console.log("Processing Payroll:", {
      employeesCount: allEmployees.length,
      timeEntriesCount: timeEntries.length,
      pieceworkCount: piecework.length,
      tasksCount: tasks.length,
      dateRange: { startDate, endDate },
    });

    const STATE_MINIMUM_WAGE = 16.28;

    // Create maps for quick lookups and ensure strong typing
    const reportEmployeeIds = new Set(allEmployees.map((e: Employee) => e.id));
    const taskMap = new Map<string, Task>(tasks.map((t: Task) => [t.id, t]));
    const clientMap = new Map<string, Client>(
      clients.map((c: Client) => [c.id, c])
    );

    // Create maps for quick lookup by ID and QRCode, ensuring strong typing
    const allEmployeesById = new Map<string, Employee>(
      allEmployees.map((e: Employee) => [e.id, e])
    );
    const allEmployeesByQr = new Map<string, Employee>(
      allEmployees.map((e: Employee) => [e.qrCode, e])
    );

    const reportInterval = {
      start: startOfDay(parseLocalDate(startDate)),
      end: endOfDay(parseLocalDate(endDate)),
    };

    const employeeSummaries: EmployeePayrollSummary[] = [];

    for (const employee of allEmployees as Employee[]) {
      const employeeId = employee.id;

      const empTimeEntries = timeEntries.filter(
        (e: TimeEntry) =>
          e.employeeId === employeeId &&
          e.timestamp &&
          e.endTime &&
          isWithinInterval(parseLocalDateOrDateTime(String(e.timestamp)), reportInterval)
      );

      const empPiecework: Piecework[] = [];
      piecework.forEach((pw: Piecework) => {
        if (
          !pw.timestamp ||
          !isWithinInterval(parseLocalDateOrDateTime(String(pw.timestamp)), reportInterval)
        ) {
          return;
        }
        // Handle comma-separated employee identifiers (can be IDs or QRCodes)
        const employeeIdentifiersOnTicket = String(pw.employeeId)
          .split(",")
          .map((id) => id.trim());

        const isEmployeeOnThisTicket = employeeIdentifiersOnTicket.some(
          (identifier) => {
            // Usa aserción 'as Employee | undefined' para ayudar al compilador.
            const empFromId = allEmployeesById.get(identifier) as
              | Employee
              | undefined;
            const empFromQr = allEmployeesByQr.get(identifier) as
              | Employee
              | undefined;

            return (
              (empFromId && empFromId.id === employeeId) ||
              (empFromQr && empFromQr.id === employeeId)
            );
          }
        );

        if (isEmployeeOnThisTicket) {
          // Find how many *selected* employees are on this ticket to divide the piece count
          const relevantEmployeesOnTicket = employeeIdentifiersOnTicket
            .map((identifier) => {
              const emp =
                allEmployeesById.get(identifier) ||
                allEmployeesByQr.get(identifier);
              return emp;
            })
            .filter((e): e is Employee => !!e && reportEmployeeIds.has(e.id));

          const numRelevantEmployees =
            relevantEmployeesOnTicket.length > 0
              ? relevantEmployeesOnTicket.length
              : 1;

          empPiecework.push({
            ...pw,
            pieceCount: pw.pieceCount / numRelevantEmployees,
          });
        }
      });

      if (empTimeEntries.length === 0 && empPiecework.length === 0) {
        continue;
      }

      const workByWeek: Record<
        string,
        { time: TimeEntry[]; pieces: Piecework[] }
      > = {};

      [...empTimeEntries, ...empPiecework].forEach((entry) => {
        if (!entry.timestamp) return;
        const date = parseLocalDateOrDateTime(String(entry.timestamp));
        const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday is the start of the week
        const weekKey = format(weekStart, "yyyy-MM-dd");
        if (!workByWeek[weekKey]) {
          workByWeek[weekKey] = { time: [], pieces: [] };
        }
        if ("endTime" in entry) {
          workByWeek[weekKey].time.push(entry as TimeEntry);
        } else {
          workByWeek[weekKey].pieces.push(entry as Piecework);
        }
      });

      const weeklySummaries: WeeklySummary[] = [];

      for (const weekKey in workByWeek) {
        const { time, pieces } = workByWeek[weekKey];

        const weekStartDate = parseLocalDate(weekKey);
        const [year, weekNumber] = [
          getYear(weekStartDate),
          getWeek(weekStartDate, { weekStartsOn: 1 }),
        ];

        const dailyWork: Record<
          string,
          { tasks: Record<string, { hours: number; pieces: number }> }
        > = {};
        let applicableMinWage = STATE_MINIMUM_WAGE;

        time.forEach((entry) => {
          if (!entry.timestamp || !entry.endTime) return;
          const date = parseLocalDateOrDateTime(String(entry.timestamp));
          const dayKey = format(date, "yyyy-MM-dd");
          let hours =
            differenceInMilliseconds(parseLocalDateOrDateTime(String(entry.endTime)), date) /
            (1000 * 60 * 60);
          if (hours <= 0) return;

          // Skip sick leave entries - they don't count as work hours
          if (entry.isSickLeave) return;

          // Apply meal break deduction: After 5 hours worked, deduct 30 minutes (unpaid meal break)
          if (hours > 5) {
            hours -= 0.5; // Deduct 30 minutes (0.5 hours)
          }

          if (!dailyWork[dayKey]) dailyWork[dayKey] = { tasks: {} };
          if (!dailyWork[dayKey].tasks[entry.taskId])
            dailyWork[dayKey].tasks[entry.taskId] = { hours: 0, pieces: 0 };
          dailyWork[dayKey].tasks[entry.taskId].hours += hours;
        });

        pieces.forEach((entry) => {
          if (!entry.timestamp) return;
          const date = parseLocalDateOrDateTime(String(entry.timestamp));
          const dayKey = format(date, "yyyy-MM-dd");

          if (!dailyWork[dayKey]) dailyWork[dayKey] = { tasks: {} };
          if (!dailyWork[dayKey].tasks[entry.taskId])
            dailyWork[dayKey].tasks[entry.taskId] = { hours: 0, pieces: 0 };
          dailyWork[dayKey].tasks[entry.taskId].pieces += entry.pieceCount;
        });

        const dailyBreakdownsForWeek: DailyBreakdown[] = [];
        let weeklyTotalHours = 0;

        // Acumuladores SEMANALES para la comparación final
        let weeklyTotalPieceworkEarnings = 0;
        let weeklyTotalMinimumWageEarnings = 0; // Ganancia que resulta de aplicar el ajuste diario (mínimo)

        const sortedDays = Object.keys(dailyWork).sort(
          (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
        );

        for (const dayKey of sortedDays) {
          let dailyTotalHours = 0;
          let dailyTotalRawEarnings = 0; // Ganancia bruta por tareas, antes de ajustes de mínimo
          const taskDetailsForDay: DailyTaskDetail[] = [];

          for (const taskId in dailyWork[dayKey].tasks) {
            const task = taskMap.get(taskId);
            // CORRECCIÓN de TypeScript: saltar si la tarea no existe
            if (!task) continue;

            const client = clientMap.get(task.clientId);
            if (client?.minimumWage && client.minimumWage > applicableMinWage) {
              applicableMinWage = client.minimumWage;
            }

            const { hours, pieces } = dailyWork[dayKey].tasks[taskId];
            let earningsForTask = 0;

            // Enhanced logging to diagnose all earnings calculation issues
            console.log("Processing task earnings:", {
              taskId,
              taskName: task.name,
              piecePrice: task.piecePrice,
              hours,
              pieces,
            });
            
            // Calculate earnings based on pieces if piecePrice is set
            if (pieces > 0 && task.piecePrice && task.piecePrice > 0) {
              earningsForTask = pieces * task.piecePrice;
              console.log("Calculated piecework earnings:", {
                taskName: task.name,
                pieces,
                piecePrice: task.piecePrice,
                earnings: earningsForTask,
              });

              // ACUMULA las ganancias en bruto SOLO de piezas para la comparación semanal
              weeklyTotalPieceworkEarnings += earningsForTask;
            } else if (hours > 0) {
              // For hourly work, earnings will be calculated based on minimum wage
              // The minimum wage adjustment will be applied later
              console.log("Hourly work (will be adjusted to minimum wage):", {
                taskName: task.name,
                hours,
              });
            } else {
              console.warn("⚠️ Task has neither hours nor pieces:", {
                taskName: task.name,
                taskId,
                hours,
                pieces,
              });
            }

            dailyTotalHours += hours;
            dailyTotalRawEarnings += earningsForTask;

            taskDetailsForDay.push({
              taskName: `${task.name} (${task.variety || "N/A"})`,
              clientName: client?.name || "Unknown Client",
              ranch: task.ranch,
              block: task.block,
              hours: hours,
              pieceworkCount: pieces,
              totalEarnings: earningsForTask,
            });
          }

          // PASO 1: AJUSTE DIARIO AL SALARIO MÍNIMO
          const dailyMinimumWageEarnings = dailyTotalHours * applicableMinWage;

          // La ganancia diaria debe ser MÁXIMA entre la ganancia bruta y el mínimo legal diario.
          const dailyEarningsAdjusted = Math.max(
            dailyTotalRawEarnings,
            dailyMinimumWageEarnings
          );

          weeklyTotalHours += dailyTotalHours;
          // Acumula la ganancia AJUSTADA al mínimo diario para la comparación semanal
          weeklyTotalMinimumWageEarnings += dailyEarningsAdjusted;

          dailyBreakdownsForWeek.push({
            date: dayKey,
            tasks: taskDetailsForDay,
            totalDailyHours: parseFloat(dailyTotalHours.toFixed(2)),
            totalDailyEarnings: parseFloat(dailyEarningsAdjusted.toFixed(2)),
          });
        }

        if (weeklyTotalHours <= 0 && weeklyTotalMinimumWageEarnings <= 0) {
          continue; // Skip weeks with no work
        }

        // PASO 2: COMPARACIÓN SEMANAL FINAL (WAC 296-126-021)
        // El pago base es el MAYOR entre:
        // A) Ganancia total por Piezas (weeklyTotalPieceworkEarnings)
        // B) Ganancia total ajustada al Mínimo Diario (weeklyTotalMinimumWageEarnings)
        const totalEarningsBeforeRest = Math.max(
          weeklyTotalMinimumWageEarnings,
          weeklyTotalPieceworkEarnings
        );

        // Calcular el top-up solo para fines de reporte (si se hubiera pagado solo piezas)
        const weeklyMinimumWageRequirement =
          weeklyTotalHours * applicableMinWage;
        const minimumWageTopUp = Math.max(
          0,
          // Usamos el total de piezas para ver cuánto faltaría para alcanzar el mínimo semanal
          weeklyMinimumWageRequirement - weeklyTotalPieceworkEarnings
        );

        // PASO 3: CALCULAR PAGO DE DESCANSOS (REST BREAKS)
        const regularRateOfPay =
          weeklyTotalHours > 0 ? totalEarningsBeforeRest / weeklyTotalHours : 0;

        // 10 minutos por cada 4 horas trabajadas o fracción mayor.
        // Math.floor(weeklyTotalHours / 4) * (10 / 60)
        const paidRestBreakHours = Math.floor(weeklyTotalHours / 4) * (10 / 60);
        const paidRestBreaksPay = paidRestBreakHours * regularRateOfPay;

        const finalWeeklyPay = totalEarningsBeforeRest + paidRestBreaksPay;

        // PASO 4: CALCULAR HORAS DE ENFERMEDAD (SICK HOURS)
        // 1 hora de enfermedad por cada 40 horas trabajadas
        const sickHoursAccrued = weeklyTotalHours / 40;

        weeklySummaries.push({
          weekNumber,
          year,
          totalHours: parseFloat(weeklyTotalHours.toFixed(2)),
          // totalEarnings es la cantidad base final elegida (Mínimo Ajustado o Piezas)
          totalEarnings: parseFloat(totalEarningsBeforeRest.toFixed(2)),
          minimumWageTopUp: parseFloat(minimumWageTopUp.toFixed(2)),
          paidRestBreaks: parseFloat(paidRestBreaksPay.toFixed(2)),
          finalPay: parseFloat(finalWeeklyPay.toFixed(2)),
          dailyBreakdown: dailyBreakdownsForWeek,
          sickHoursAccrued: parseFloat(sickHoursAccrued.toFixed(2)),
        });
      }

      // Only add employee to the final report if they have calculated summaries
      if (weeklySummaries.length > 0) {
        const totalPayForPeriod = weeklySummaries.reduce(
          (acc, week) => acc + week.finalPay,
          0
        );

        // Calculate total sick hours accrued in this period
        const totalSickHoursAccrued = weeklySummaries.reduce(
          (acc, week) => acc + (week.sickHoursAccrued || 0),
          0
        );

        // Calculate new sick hours balance
        const currentBalance = employee.sickHoursBalance || 0;
        const newSickHoursBalance = currentBalance + totalSickHoursAccrued;

        employeeSummaries.push({
          employeeId: employee.id,
          employeeName: employee.name,
          weeklySummaries,
          finalPay: parseFloat(totalPayForPeriod.toFixed(2)),
          totalSickHoursAccrued: parseFloat(totalSickHoursAccrued.toFixed(2)),
          newSickHoursBalance: parseFloat(newSickHoursBalance.toFixed(2)),
        });
      }
    }

    return {
      employeeSummaries,
      periodTotal: employeeSummaries.reduce(
        (acc, emp) => acc + emp.finalPay,
        0
      ),
      startDate,
      endDate,
      payDate,
    };
  } catch (error) {
    console.error("Error in payroll generation:", error);
    throw error;
  }
}
