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
  parseISO,
  isWithinInterval,
  differenceInMilliseconds,
  startOfWeek,
} from "date-fns";
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

    // Create maps for quick lookups
    const reportEmployeeIds = new Set(allEmployees.map((e: Employee) => e.id));
    const taskMap = new Map(tasks.map((t: Task) => [t.id, t]));
    const clientMap = new Map(clients.map((c: Client) => [c.id, c]));

    // Create maps for quick lookup by ID and QRCode
    const allEmployeesById = new Map(
      allEmployees.map((e: Employee) => [e.id, e])
    );
    const allEmployeesByQr = new Map(
      allEmployees.map((e: Employee) => [e.qrCode, e])
    );

    const reportInterval = {
      start: startOfDay(parseISO(startDate)),
      end: startOfDay(parseISO(endDate)),
    };

    const employeeSummaries: EmployeePayrollSummary[] = [];

    for (const employee of allEmployees as Employee[]) {
      const employeeId = employee.id;

      const empTimeEntries = timeEntries.filter(
        (e: TimeEntry) =>
          e.employeeId === employeeId &&
          e.timestamp &&
          e.endTime &&
          isWithinInterval(parseISO(String(e.timestamp)), reportInterval)
      );

      const empPiecework: Piecework[] = [];
      piecework.forEach((pw: Piecework) => {
        if (
          !pw.timestamp ||
          !isWithinInterval(parseISO(String(pw.timestamp)), reportInterval)
        ) {
          return;
        }
        // Handle comma-separated employee identifiers (can be IDs or QRCodes)
        const employeeIdentifiersOnTicket = String(pw.employeeId)
          .split(",")
          .map((id) => id.trim());

        const isEmployeeOnThisTicket = employeeIdentifiersOnTicket.some(
          (identifier) => {
            // Check if the identifier matches the current employee being processed
            const empFromId = allEmployeesById.get(identifier);
            const empFromQr = allEmployeesByQr.get(identifier);
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
        const date = parseISO(String(entry.timestamp));
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

        const weekStartDate = parseISO(weekKey);
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
          const date = parseISO(String(entry.timestamp));
          const dayKey = format(date, "yyyy-MM-dd");
          const hours =
            differenceInMilliseconds(parseISO(String(entry.endTime)), date) /
            (1000 * 60 * 60);
          if (hours <= 0) return;

          if (!dailyWork[dayKey]) dailyWork[dayKey] = { tasks: {} };
          if (!dailyWork[dayKey].tasks[entry.taskId])
            dailyWork[dayKey].tasks[entry.taskId] = { hours: 0, pieces: 0 };
          dailyWork[dayKey].tasks[entry.taskId].hours += hours;
        });

        pieces.forEach((entry) => {
          if (!entry.timestamp) return;
          const date = parseISO(String(entry.timestamp));
          const dayKey = format(date, "yyyy-MM-dd");

          if (!dailyWork[dayKey]) dailyWork[dayKey] = { tasks: {} };
          if (!dailyWork[dayKey].tasks[entry.taskId])
            dailyWork[dayKey].tasks[entry.taskId] = { hours: 0, pieces: 0 };
          dailyWork[dayKey].tasks[entry.taskId].pieces += entry.pieceCount;
        });

        const dailyBreakdownsForWeek: DailyBreakdown[] = [];
        let weeklyTotalHours = 0;
        let weeklyTotalRawEarnings = 0;

        const sortedDays = Object.keys(dailyWork).sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime()
        );

        for (const dayKey of sortedDays) {
          let dailyTotalHours = 0;
          let dailyTotalEarnings = 0;
          const taskDetailsForDay: DailyTaskDetail[] = [];

          for (const taskId in dailyWork[dayKey].tasks) {
            const task = taskMap.get(taskId);
            if (!task) continue;

            const client = clientMap.get(task.clientId);
            if (client?.minimumWage && client.minimumWage > applicableMinWage) {
              applicableMinWage = client.minimumWage;
            }

            const { hours, pieces } = dailyWork[dayKey].tasks[taskId];
            let earningsForTask = 0;

            if (task.employeePaymentType === "hourly") {
              earningsForTask = hours * task.employeeRate;
            } else if (task.employeePaymentType === "piecework") {
              earningsForTask = pieces * task.employeeRate;
            }

            dailyTotalHours += hours;
            dailyTotalEarnings += earningsForTask;

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

          weeklyTotalHours += dailyTotalHours;
          weeklyTotalRawEarnings += dailyTotalEarnings;

          dailyBreakdownsForWeek.push({
            date: dayKey,
            tasks: taskDetailsForDay,
            totalDailyHours: parseFloat(dailyTotalHours.toFixed(2)),
            totalDailyEarnings: parseFloat(dailyTotalEarnings.toFixed(2)),
          });
        }

        if (weeklyTotalHours <= 0 && weeklyTotalRawEarnings <= 0) {
          continue; // Skip weeks with no work
        }

        const minimumGrossEarnings = weeklyTotalHours * applicableMinWage;
        const minimumWageTopUp = Math.max(
          0,
          minimumGrossEarnings - weeklyTotalRawEarnings
        );

        const totalEarningsBeforeRest =
          weeklyTotalRawEarnings + minimumWageTopUp;
        const regularRateOfPay =
          weeklyTotalHours > 0 ? totalEarningsBeforeRest / weeklyTotalHours : 0;

        const paidRestBreakHours = Math.floor(weeklyTotalHours / 4) * (10 / 60);
        const paidRestBreaksPay = paidRestBreakHours * regularRateOfPay;

        const finalWeeklyPay = totalEarningsBeforeRest + paidRestBreaksPay;

        weeklySummaries.push({
          weekNumber,
          year,
          totalHours: parseFloat(weeklyTotalHours.toFixed(2)),
          totalEarnings: parseFloat(weeklyTotalRawEarnings.toFixed(2)),
          minimumWageTopUp: parseFloat(minimumWageTopUp.toFixed(2)),
          paidRestBreaks: parseFloat(paidRestBreaksPay.toFixed(2)),
          finalPay: parseFloat(finalWeeklyPay.toFixed(2)),
          dailyBreakdown: dailyBreakdownsForWeek,
        });
      }

      // Only add employee to the final report if they have calculated summaries
      if (weeklySummaries.length > 0) {
        const totalPayForPeriod = weeklySummaries.reduce(
          (acc, week) => acc + week.finalPay,
          0
        );

        employeeSummaries.push({
          employeeId: employee.id,
          employeeName: employee.name,
          weeklySummaries,
          finalPay: parseFloat(totalPayForPeriod.toFixed(2)),
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
