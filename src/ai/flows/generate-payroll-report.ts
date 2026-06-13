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
import { calculateOvertimePay, roundToQuarterHour } from "@/lib/calculations";
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
  PiecesByVariety,
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

    const STATE_MINIMUM_WAGE = 19.82; // Washington state minimum wage (as of 2025) - default fallback

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
          isWithinInterval(
            parseLocalDateOrDateTime(String(e.timestamp)),
            reportInterval
          )
      );

      const empPiecework: Piecework[] = [];
      piecework.forEach((pw: Piecework) => {
        if (
          !pw.timestamp ||
          !isWithinInterval(
            parseLocalDateOrDateTime(String(pw.timestamp)),
            reportInterval
          )
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
        const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // Sunday is the start of the week
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
          getWeek(weekStartDate, { weekStartsOn: 0 }),
        ];

        const dailyWork: Record<
          string,
          { tasks: Record<string, { hours: number; pieces: number }> }
        > = {};
        // Start with state minimum wage as fallback, will be replaced by client-specific minimum wage
        let applicableMinWage = STATE_MINIMUM_WAGE;
        let clientMinWageFound = false;

        time.forEach((entry) => {
          if (!entry.timestamp || !entry.endTime) return;
          const date = parseLocalDateOrDateTime(String(entry.timestamp));
          const dayKey = format(date, "yyyy-MM-dd");
          let hours =
            differenceInMilliseconds(
              parseLocalDateOrDateTime(String(entry.endTime)),
              date
            ) /
            (1000 * 60 * 60);
          if (hours <= 0) return;

          // Skip sick leave entries - they don't count as work hours
          if (entry.isSickLeave) return;

          // Apply meal break deduction: After 5 hours worked, deduct 30 minutes (unpaid meal break)
          if (hours > 5) {
            hours -= 0.5; // Deduct 30 minutes (0.5 hours)
          }

          // Round hours to nearest quarter hour (0.25 increments) to match 15-minute billing requirement
          hours = roundToQuarterHour(hours);

          if (!dailyWork[dayKey]) dailyWork[dayKey] = { tasks: {} };
          if (!dailyWork[dayKey].tasks[entry.taskId])
            dailyWork[dayKey].tasks[entry.taskId] = { hours: 0, pieces: 0 };
          dailyWork[dayKey].tasks[entry.taskId].hours += hours;

          // Add pieces from piecesWorked field in TimeEntry
          if (entry.piecesWorked && entry.piecesWorked > 0) {
            dailyWork[dayKey].tasks[entry.taskId].pieces += entry.piecesWorked;
          }
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

        // Acumuladores SEMANALES separados por tipo de trabajo
        let weeklyHourlyEarnings = 0; // Earnings from hourly tasks
        let weeklyHourlyHours = 0; // Hours worked on hourly tasks
        let weeklyPieceworkEarnings = 0; // Earnings from piecework tasks
        let weeklyPieceworkHours = 0; // Hours worked on piecework tasks
        
        // Track pieces by task/variety for the week (piecework)
        const piecesByTaskVariety = new Map<string, { taskName: string; variety: string; totalPieces: number; price?: number }>();
        // Track hours by payroll rate for the week (hourly)
        const hoursByRate = new Map<number, number>();

        // Accumulator for weekly break pay (computed per day)
        let weeklyRestBreaksPay = 0;

        const sortedDays = Object.keys(dailyWork).sort(
          (a, b) => parseLocalDate(a).getTime() - parseLocalDate(b).getTime()
        );

        for (const dayKey of sortedDays) {
          let dailyTotalHours = 0;
          let dailyTotalRawEarnings = 0; // Ganancia bruta por tareas, sin ajustes
          const taskDetailsForDay: DailyTaskDetail[] = [];

          // Per-day accumulators for break calculation
          let dailyPieceworkHours = 0;
          let dailyHourlyHours = 0;
          let dailyPieceworkEarnings = 0;

          for (const taskId in dailyWork[dayKey].tasks) {
            const task = taskMap.get(taskId);
            // CORRECCIÓN de TypeScript: saltar si la tarea no existe
            if (!task) continue;

            const client = clientMap.get(task.clientId);
            const clientPayrollMinWage = client?.minimumWageForPayroll || client?.minimumWage;
            if (clientPayrollMinWage) {
              if (!clientMinWageFound) {
                console.log("📊 Using client minimum wage for payroll:", {
                  clientName: client?.name,
                  clientMinWage: clientPayrollMinWage,
                  stateMinWage: STATE_MINIMUM_WAGE,
                });
                applicableMinWage = clientPayrollMinWage;
                clientMinWageFound = true;
              } else if (clientPayrollMinWage > applicableMinWage) {
                console.log("📊 Updating to higher client minimum wage for payroll:", {
                  clientName: client?.name,
                  clientMinWage: clientPayrollMinWage,
                  previousMinWage: applicableMinWage,
                });
                applicableMinWage = clientPayrollMinWage;
              }
            }

            const { hours, pieces } = dailyWork[dayKey].tasks[taskId];
            let earningsForTask = 0;
            let isHourlyTask = false;

            // Enhanced logging to diagnose all earnings calculation issues
            console.log("Processing task earnings:", {
              taskId,
              taskName: task.name,
              clientRateType: task.clientRateType,
              clientRate: task.clientRate,
              piecePrice: task.piecePrice,
              hours,
              pieces,
            });

            // Calculate earnings based on task type and rate
            // Use payroll-specific rates when available, fall back to client rates
            const effectivePiecePrice = task.piecePriceForPayroll ?? task.piecePrice;
            const effectiveHourlyRate = task.clientRateForPayroll ?? task.clientRate;

            if (
              task.clientRateType === "piece" &&
              pieces > 0 &&
              effectivePiecePrice &&
              effectivePiecePrice > 0
            ) {
              // Piecework task: calculate based on pieces
              earningsForTask = pieces * effectivePiecePrice;
              isHourlyTask = false;
              console.log("Calculated piecework earnings:", {
                taskName: task.name,
                pieces,
                piecePrice: effectivePiecePrice,
                earnings: earningsForTask,
              });
            } else if (task.clientRateType === "hourly" && hours > 0) {
              // Hourly task: calculate based on hours and clientRate
              earningsForTask = hours * (effectiveHourlyRate || 0);
              isHourlyTask = true;
              console.log("Calculated hourly earnings:", {
                taskName: task.name,
                hours,
                clientRate: effectiveHourlyRate,
                earnings: earningsForTask,
              });
            } else if (hours > 0) {
              // Fallback for tasks without explicit type (backward compatibility)
              // Check if it has piecePrice and pieces, otherwise treat as hourly
              if (pieces > 0 && effectivePiecePrice && effectivePiecePrice > 0) {
                earningsForTask = pieces * effectivePiecePrice;
                isHourlyTask = false;
              } else {
                // Treat as hourly work
                earningsForTask = hours * (effectiveHourlyRate || 0);
                isHourlyTask = true;
              }
              console.log("Calculated earnings (fallback):", {
                taskName: task.name,
                hours,
                pieces,
                earnings: earningsForTask,
                isHourly: isHourlyTask,
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

            // Track separately by task type for weekly and daily calculation
            if (isHourlyTask) {
              weeklyHourlyEarnings += earningsForTask;
              weeklyHourlyHours += hours;
              dailyHourlyHours += hours;
            } else {
              weeklyPieceworkEarnings += earningsForTask;
              weeklyPieceworkHours += hours;
              dailyPieceworkHours += hours;
              dailyPieceworkEarnings += earningsForTask;
            }
            
            // Track pieces by task/variety if this is a piecework task
            if (pieces > 0 && task.clientRateType === "piece") {
              const varietyKey = `${task.name}|${task.variety || "N/A"}`;
              if (piecesByTaskVariety.has(varietyKey)) {
                const existing = piecesByTaskVariety.get(varietyKey)!;
                existing.totalPieces += pieces;
                if (!existing.price && effectivePiecePrice) existing.price = effectivePiecePrice;
              } else {
                piecesByTaskVariety.set(varietyKey, {
                  taskName: task.name,
                  variety: task.variety || "N/A",
                  totalPieces: pieces,
                  price: effectivePiecePrice || 0,
                });
              }
            }

            // Track hours by payroll rate if this is an hourly task
            if (hours > 0 && task.clientRateType === "hourly" && effectiveHourlyRate) {
              const rate = effectiveHourlyRate;
              hoursByRate.set(rate, (hoursByRate.get(rate) ?? 0) + hours);
            }

            // Determine task type label and rate for display
            const taskTypeLabel =
              task.clientRateType === "piece"
                ? "Piecework"
                : task.clientRateType === "hourly"
                ? "Hourly"
                : "Unknown";
            const taskRate =
              task.clientRateType === "piece"
                ? effectivePiecePrice
                : effectiveHourlyRate;

            taskDetailsForDay.push({
              taskId: taskId, // <- Agregar esto
              taskName: `${task.name}${task.variety ? ` (${task.variety})` : ""} - ${taskTypeLabel}`,
              clientName: client?.name || "Unknown Client",
              ranch: task.ranch,
              block: task.block,
              hours: hours,
              pieceworkCount: pieces,
              totalEarnings: earningsForTask,
              taskType: task.clientRateType,
              rate: taskRate,
            });
          }

          weeklyTotalHours += dailyTotalHours;

          // Compute daily break pay using the dynamic formula:
          // IF(AND(piece_hours>0, piece_earn>piece_hours*minWage, piece_hours>=hourly_hours, piece_hours+hourly_hours>4),
          //   ((piece_earn/piece_hours)*(10/60))*MAX(1,FLOOR(piece_hours/4)), 0)
          const requiredPayForPieceHours = dailyPieceworkHours * applicableMinWage;
          const dailyBreakPay =
            dailyPieceworkHours > 0 &&
            dailyPieceworkEarnings > requiredPayForPieceHours &&
            dailyPieceworkHours >= dailyHourlyHours &&
            dailyPieceworkHours + dailyHourlyHours > 4
              ? ((dailyPieceworkEarnings / dailyPieceworkHours) * (10 / 60)) *
                Math.max(1, Math.floor(dailyPieceworkHours / 4))
              : 0;
          weeklyRestBreaksPay += dailyBreakPay;

          dailyBreakdownsForWeek.push({
            date: dayKey,
            tasks: taskDetailsForDay,
            totalDailyHours: parseFloat(dailyTotalHours.toFixed(2)),
            totalDailyEarnings: parseFloat(dailyTotalRawEarnings.toFixed(2)),
          });
        }

        if (weeklyTotalHours <= 0 && (weeklyHourlyEarnings + weeklyPieceworkEarnings) <= 0) {
          continue; // Skip weeks with no work
        }

        // NUEVA LÓGICA: Calcular hourly y piecework por separado según requerimientos del cliente
        
        // PASO 1: CALCULAR PAGO POR TRABAJO POR HORAS (HOURLY)
        // Para trabajo por horas, NO se agregan descansos pagados adicionales
        // porque los descansos ya están incluidos en la tarifa por hora.
        // Tampoco se aplica ajuste de salario mínimo porque ya se paga la tarifa por hora.
        const hourlyFinalPay = weeklyHourlyEarnings; // Sin ajustes adicionales
        
        // PASO 2: CALCULAR PAGO POR TRABAJO A DESTAJO (PIECEWORK)
        // Solo para piecework se calculan descansos pagados y ajustes de salario mínimo
        
        console.log("🔍 PIECEWORK CALCULATION DEBUG:", {
          weeklyPieceworkHours,
          weeklyPieceworkEarnings,
          applicableMinWage,
        });
        
        // 2.1: Calcular tasa regular basada SOLO en earnings de piecework
        const pieceworkRegularRate = 
          weeklyPieceworkHours > 0 ? weeklyPieceworkEarnings / weeklyPieceworkHours : 0;
        
        console.log("  Piecework regular rate:", pieceworkRegularRate.toFixed(2));
        
        // 2.2: Calcular descansos pagados SOLO para horas de piecework
        // Fórmula dinámica por día: se aplica solo cuando se cumplen las condiciones
        // (piece_hours>0, piece_earn>piece_hours*minWage, piece_hours>=hourly_hours, piece_hours+hourly_hours>=4)
        // ((piece_earn/piece_hours)*(10/60))*MAX(1,FLOOR(piece_hours/4))
        const pieceworkRestBreaksPay = parseFloat(weeklyRestBreaksPay.toFixed(2));
        console.log("  Rest breaks pay:", pieceworkRestBreaksPay.toFixed(2));
        
        // 2.3: Sumar ganancias de piecework + descansos
        const pieceworkEarningsWithBreaks = weeklyPieceworkEarnings + pieceworkRestBreaksPay;
        
        console.log("  Earnings with breaks:", pieceworkEarningsWithBreaks.toFixed(2));
        
        // 2.4: Comparación con salario mínimo SOLO para horas de piecework
        const pieceworkMinimumWageRequirement = weeklyPieceworkHours * applicableMinWage;
        
        console.log("  Min wage requirement:", pieceworkMinimumWageRequirement.toFixed(2));
        
        // 2.5: Calcular ajuste (top-up) SOLO para piecework
        const pieceworkMinimumWageTopUp = Math.max(
          0,
          pieceworkMinimumWageRequirement - pieceworkEarningsWithBreaks
        );
        
        console.log("  Min wage top-up:", pieceworkMinimumWageTopUp.toFixed(2));
        
        // 2.6: Pago final de piecework
        const pieceworkFinalPay = pieceworkEarningsWithBreaks + pieceworkMinimumWageTopUp;
        
        console.log("  Final piecework pay:", pieceworkFinalPay.toFixed(2));
        
        // PASO 3: COMBINAR HOURLY Y PIECEWORK PARA EL TOTAL SEMANAL
        const weeklyTotalRawEarnings = weeklyHourlyEarnings + weeklyPieceworkEarnings;
        const finalWeeklyPayBeforeOvertime = hourlyFinalPay + pieceworkFinalPay;
        
        // Para reporte: mostrar solo los descansos y ajustes de piecework
        const totalRestBreaksPay = pieceworkRestBreaksPay;
        const totalMinimumWageTopUp = pieceworkMinimumWageTopUp;

        // PASO 3.5: CALCULAR OVERTIME (HORAS EXTRAS)
        // El overtime se calcula sobre la COMBINACIÓN de hourly + piecework
        // usando el total de ganancias (incluyendo ajustes) y el total de horas
        let overtimeHours = 0;
        let overtimePremium = 0;
        let regularRate = 0;

        if (weeklyTotalHours > 40) {
          // IMPORTANT: Per WA state law and client requirements, overtime is calculated AFTER
          // minimum wage adjustments are applied. This ensures that:
          // 1. Workers receive at least minimum wage for all hours worked
          // 2. Overtime premium is calculated based on the adjusted (higher) rate
          // 
          // Example: 50 hrs, $800 raw earnings:
          //   - Raw rate: $800/50 = $16/hr (< $19.82 min wage)
          //   - Adjusted earnings: 50 × $19.82 = $991
          //   - Top-up: $991 - $800 = $191
          //   - Regular rate for OT: $991/50 = $19.82/hr
          //   - OT premium: ($19.82 × 0.5) × 10 = $99.10
          const totalEarningsForOvertimeCalc = weeklyTotalRawEarnings + totalRestBreaksPay + totalMinimumWageTopUp;
          
          // Use the overtime calculation function
          const overtimeResult = calculateOvertimePay(
            weeklyTotalHours,
            totalEarningsForOvertimeCalc,
            applicableMinWage
          );
          
          overtimeHours = overtimeResult.overtimeHours;
          overtimePremium = overtimeResult.overtimePremium;
          regularRate = overtimeResult.regularRate;
        }

        // PASO 4: PAGO FINAL INCLUYENDO OVERTIME
        const finalWeeklyPay = finalWeeklyPayBeforeOvertime + overtimePremium;

        // PASO 5: CALCULAR HORAS DE ENFERMEDAD (SICK HOURS)
        // 1 hora de enfermedad por cada 40 horas trabajadas (total de hourly + piecework)
        const sickHoursAccrued = weeklyTotalHours / 40;

        console.log("Weekly calculation breakdown:", {
          weekNumber,
          year,
          hourly: {
            hours: weeklyHourlyHours,
            earnings: weeklyHourlyEarnings,
            finalPay: hourlyFinalPay,
          },
          piecework: {
            hours: weeklyPieceworkHours,
            earnings: weeklyPieceworkEarnings,
            restBreaks: pieceworkRestBreaksPay,
            minimumWageTopUp: pieceworkMinimumWageTopUp,
            finalPay: pieceworkFinalPay,
          },
          overtime: {
            hours: overtimeHours,
            premium: overtimePremium,
            regularRate: regularRate,
          },
          total: {
            hours: weeklyTotalHours,
            rawEarnings: weeklyTotalRawEarnings,
            finalPay: finalWeeklyPay,
          },
        });

        // Calculate total pieces and pieces by variety for the week
        const piecesByVarietyArray = Array.from(piecesByTaskVariety.values());
        const totalWeeklyPieces = piecesByVarietyArray.reduce((sum, item) => sum + item.totalPieces, 0);

        // Build combined rate summary: piecework entries + hourly entries
        const combinedRateEntries = [
          ...piecesByVarietyArray.map(item => ({
            taskName: item.taskName,
            variety: item.variety,
            totalPieces: parseFloat(item.totalPieces.toFixed(2)),
            price: item.price ?? 0,
            rateType: "piece" as const,
            totalHours: undefined,
          })),
          ...Array.from(hoursByRate.entries()).map(([rate, hours]) => ({
            taskName: "Hourly",
            variety: "N/A",
            totalPieces: 0,
            price: rate,
            rateType: "hourly" as const,
            totalHours: parseFloat(hours.toFixed(2)),
          })),
        ];

        weeklySummaries.push({
          weekNumber,
          year,
          totalHours: parseFloat(weeklyTotalHours.toFixed(2)),
          // totalEarnings es la ganancia RAW (sin ajustes de salario mínimo ni descansos)
          totalEarnings: parseFloat(weeklyTotalRawEarnings.toFixed(2)),
          minimumWageTopUp: parseFloat(totalMinimumWageTopUp.toFixed(2)),
          paidRestBreaks: parseFloat(totalRestBreaksPay.toFixed(2)),
          overtimeHours: overtimeHours > 0 ? parseFloat(overtimeHours.toFixed(2)) : undefined,
          overtimePremium: overtimePremium > 0 ? parseFloat(overtimePremium.toFixed(2)) : undefined,
          regularRate: regularRate > 0 ? parseFloat(regularRate.toFixed(2)) : undefined,
          finalPay: parseFloat(finalWeeklyPay.toFixed(2)),
          dailyBreakdown: dailyBreakdownsForWeek,
          sickHoursAccrued: parseFloat(sickHoursAccrued.toFixed(2)),
          totalPieces: totalWeeklyPieces > 0 ? parseFloat(totalWeeklyPieces.toFixed(2)) : undefined,
          piecesByVariety: combinedRateEntries.length > 0 ? combinedRateEntries : undefined,
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
