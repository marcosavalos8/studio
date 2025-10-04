'use server';

/**
 * @fileOverview A payroll report generation AI agent that understands Washington (WA) labor laws.
 *
 * - generatePayrollReport - A function that handles the payroll report generation process.
 * - GeneratePayrollReportInput - The input type for the generatePayrollReport function.
 * - ProcessedPayrollData - The return type for the generatePayrollReport function, containing structured payroll data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { getWeek, getYear, format, startOfDay, parseISO } from 'date-fns';
import type { Client, Task, ProcessedPayrollData, EmployeePayrollSummary, WeeklySummary, DailyBreakdown, DailyTaskDetail, Employee, Piecework, TimeEntry } from '@/lib/types';


const STATE_MINIMUM_WAGE = 16.28;

// Main input schema for the server action
const GeneratePayrollReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the payroll report (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date for the payroll report (YYYY-MM-DD).'),
  payDate: z.string().describe('The date the payment is issued (YYYY-MM-DD).'),
  jsonData: z.string().describe('A JSON string containing all necessary payroll data.'),
});
export type GeneratePayrollReportInput = z.infer<typeof GeneratePayrollReportInputSchema>;


const DailyTaskDetailSchema = z.object({
  taskName: z.string(),
  clientName: z.string(),
  ranch: z.string().optional(),
  block: z.string().optional(),
  hours: z.number(),
  pieceworkCount: z.number(),
  hourlyEarnings: z.number(),
  pieceworkEarnings: z.number(),
  totalEarnings: z.number(),
});

const DailyBreakdownSchema = z.object({
  date: z.string().describe("The date for this entry in YYYY-MM-DD format."),
  tasks: z.array(DailyTaskDetailSchema),
  totalDailyHours: z.number(),
  totalDailyEarnings: z.number(),
});

const WeeklySummarySchema = z.object({
    weekNumber: z.number(),
    year: z.number(),
    totalHours: z.number(),
    totalPieceworkEarnings: z.number(),
    totalHourlyEarnings: z.number(),
    totalEarnings: z.number(),
    effectiveHourlyRate: z.number(),
    minimumWageTopUp: z.number(),
    paidRestBreaksTotal: z.number(),
    dailyBreakdown: z.array(DailyBreakdownSchema),
});

const EmployeePayrollSummarySchema = z.object({
    employeeId: z.string(),
    employeeName: z.string(),
    weeklySummaries: z.array(WeeklySummarySchema),
    overallTotalEarnings: z.number(),
    overallTotalHours: z.number(),
    overallTotalMinimumWageTopUp: z.number(),
    overallTotalPaidRestBreaks: z.number(),
    finalPay: z.number(),
});

const ProcessedPayrollDataSchema = z.object({
    startDate: z.string(),
    endDate: z.string(),
    payDate: z.string(),
    employeeSummaries: z.array(EmployeePayrollSummarySchema),
});


// Exported function called by the server action
export async function generatePayrollReport(input: GeneratePayrollReportInput): Promise<ProcessedPayrollData> {
  return generatePayrollReportFlow(input);
}


// This tool does the heavy lifting of calculating payroll based on WA rules.
const processPayrollData = ai.defineTool(
  {
    name: 'processPayrollData',
    description: 'Processes raw payroll data to calculate earnings, overtime, and compliance adjustments based on Washington state labor laws.',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: ProcessedPayrollDataSchema,
  },
  async (input) => {
    const data = JSON.parse(input.jsonData);
    const { employees, tasks, timeEntries, piecework, clients } = data;
    
    const employeeSummaries: EmployeePayrollSummary[] = [];

    const clientMap = new Map(clients.map((c: Client) => [c.id, c]));
    const taskMap = new Map(tasks.map((t: Task) => [t.id, t]));
    
    // Create robust maps for finding employees by ID or QR code
    const employeeIdMap = new Map(employees.map((e: Employee) => [e.id, e]));
    const employeeQrMap = new Map(employees.map((e: Employee) => [e.qrCode, e]));

    // Helper to find employee from either map
    const findEmployee = (identifier: string): Employee | undefined => {
        return employeeIdMap.get(identifier) || employeeQrMap.get(identifier);
    }
    
    const reportStartDate = parseISO(input.startDate);
    const reportEndDate = parseISO(input.endDate);

    for (const employee of employees) {
      if (!employee.id) continue;

      // Phase 1: Aggregate Raw Data (Hours and Pieces) per employee
      // Key: "dayKey-taskId"
      const empWorkData: Record<string, { hours: number; pieceworkCount: number; taskId: string }> = {};

      const empTimeEntries: TimeEntry[] = timeEntries
        .filter((te: any) => {
            if (!te.timestamp || !te.endTime) return false;
            const entryDate = parseISO(te.timestamp);
            return te.employeeId === employee.id && entryDate >= reportStartDate && entryDate <= reportEndDate;
        });

      for (const entry of empTimeEntries) {
        const start = parseISO(entry.timestamp as any);
        const dayKey = format(startOfDay(start), 'yyyy-MM-dd');
        const mapKey = `${dayKey}-${entry.taskId}`;
        
        if (!empWorkData[mapKey]) empWorkData[mapKey] = { hours: 0, pieceworkCount: 0, taskId: entry.taskId };
        
        const hours = (parseISO(entry.endTime as any).getTime() - start.getTime()) / (1000 * 60 * 60);
        empWorkData[mapKey].hours += hours;
      }
      
      const empPiecework: Piecework[] = piecework
        .filter((pw: Piecework) => {
             if (!pw.timestamp) return false;
             const entryDate = parseISO(pw.timestamp as any);
             if (entryDate < reportStartDate || entryDate > reportEndDate) return false;
             
             const employeeIdsInEntry = String(pw.employeeId || '').split(',').map(id => id.trim()).filter(Boolean);
             return employeeIdsInEntry.some(id => {
                const foundEmp = findEmployee(id);
                return foundEmp?.id === employee.id;
             });
        });

      for (const entry of empPiecework) {
        const start = parseISO(entry.timestamp as any);
        const dayKey = format(startOfDay(start), 'yyyy-MM-dd');
        const mapKey = `${dayKey}-${entry.taskId}`;

        if (!empWorkData[mapKey]) empWorkData[mapKey] = { hours: 0, pieceworkCount: 0, taskId: entry.taskId };
        
        const employeeIdsInEntry = String(entry.employeeId || '').split(',').map(id => id.trim()).filter(Boolean);
        const numEmployees = employeeIdsInEntry.length > 0 ? employeeIdsInEntry.length : 1;
        const individualPieceCount = (entry.pieceCount || 0) / numEmployees;

        empWorkData[mapKey].pieceworkCount += individualPieceCount;
      }

      // Group aggregated data by week
      const workByWeek: Record<string, Record<string, { hours: number; pieceworkCount: number; taskId: string }>> = {};
      for (const mapKey in empWorkData) {
          const [dayKey, taskId] = mapKey.split('-');
          const start = parseISO(dayKey);
          const weekKey = `${getYear(start)}-${getWeek(start, { weekStartsOn: 1 })}`;
          if (!workByWeek[weekKey]) workByWeek[weekKey] = {};
          workByWeek[weekKey][mapKey] = empWorkData[mapKey];
      }


      // Phase 2: Process Aggregated Data to Calculate Earnings and Summaries
      const weeklySummaries: WeeklySummary[] = [];

      for (const weekKey in workByWeek) {
        let weeklyTotalHours = 0;
        let weeklyTotalPieceworkEarnings = 0;
        let weeklyTotalHourlyEarnings = 0;
        const clientIdsInWeek = new Set<string>();
        const dailyBreakdownsForWeek: DailyBreakdown[] = [];

        const workInWeek = workByWeek[weekKey];
        const workByDay: Record<string, Record<string, { hours: number; pieceworkCount: number; taskId: string }>> = {};
        for(const mapKey in workInWeek) {
            const [dayKey, taskId] = mapKey.split('-');
            if (!workByDay[dayKey]) workByDay[dayKey] = {};
            workByDay[dayKey][taskId] = workInWeek[mapKey];
        }

        const sortedDays = Object.keys(workByDay).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

        for (const dayKey of sortedDays) {
            let dailyTotalHours = 0;
            let dailyTotalEarnings = 0;
            const taskDetailsForDay: DailyTaskDetail[] = [];

            for (const taskId in workByDay[dayKey]) {
                const task = taskMap.get(taskId);
                if (!task) continue;

                clientIdsInWeek.add(task.clientId);
                const clientName = clientMap.get(task.clientId)?.name || 'Unknown';
                const rawDayData = workByDay[dayKey][taskId];
                
                const hourlyEarnings = task.employeePayType === 'hourly' ? rawDayData.hours * task.employeeRate : 0;
                const pieceworkEarnings = task.employeePayType === 'piecework' ? rawDayData.pieceworkCount * task.employeeRate : 0;
                const totalEarningsForTask = hourlyEarnings + pieceworkEarnings;

                dailyTotalHours += rawDayData.hours;
                dailyTotalEarnings += totalEarningsForTask;
                
                taskDetailsForDay.push({
                    taskName: `${task.name} (${task.variety || 'N/A'})`,
                    clientName,
                    ranch: task.ranch || '',
                    block: task.block || '',
                    hours: rawDayData.hours,
                    pieceworkCount: rawDayData.pieceworkCount,
                    hourlyEarnings,
                    pieceworkEarnings,
                    totalEarnings: totalEarningsForTask,
                });
            }

            dailyBreakdownsForWeek.push({
                date: dayKey,
                tasks: taskDetailsForDay,
                totalDailyHours: parseFloat(dailyTotalHours.toFixed(2)),
                totalDailyEarnings: parseFloat(dailyTotalEarnings.toFixed(2)),
            });

            weeklyTotalHours += dailyTotalHours;
            weeklyTotalHourlyEarnings += taskDetailsForDay.reduce((acc, t) => acc + t.hourlyEarnings, 0);
            weeklyTotalPieceworkEarnings += taskDetailsForDay.reduce((acc, t) => acc + t.pieceworkEarnings, 0);
        }
        
        const [year, weekNumber] = weekKey.split('-').map(Number);
        const weeklyTotalEarnings = weeklyTotalHourlyEarnings + weeklyTotalPieceworkEarnings;
        
        const clientWages = Array.from(clientIdsInWeek).map(id => (clientMap.get(id) as any)?.minimumWage).filter(Boolean) as number[];
        const applicableMinimumWage = clientWages.length > 0 ? Math.max(...clientWages) : STATE_MINIMUM_WAGE;
        
        let effectiveHourlyRate = weeklyTotalHours > 0 ? weeklyTotalEarnings / weeklyTotalHours : 0;
        
        let minimumWageTopUp = 0;
        if (weeklyTotalHours > 0 && effectiveHourlyRate < applicableMinimumWage) {
            minimumWageTopUp = (applicableMinimumWage * weeklyTotalHours) - weeklyTotalEarnings;
        }
        
        const totalEarningsWithTopUp = weeklyTotalEarnings + minimumWageTopUp;
        const regularRateOfPay = weeklyTotalHours > 0 ? totalEarningsWithTopUp / weeklyTotalHours : applicableMinimumWage;

        const restBreakMinutes = Math.floor(weeklyTotalHours / 4) * 10;
        const paidRestBreaksTotal = (restBreakMinutes / 60) * regularRateOfPay;

        weeklySummaries.push({
            weekNumber,
            year,
            totalHours: parseFloat(weeklyTotalHours.toFixed(2)),
            totalPieceworkEarnings: parseFloat(weeklyTotalPieceworkEarnings.toFixed(2)),
            totalHourlyEarnings: parseFloat(weeklyTotalHourlyEarnings.toFixed(2)),
            totalEarnings: parseFloat(weeklyTotalEarnings.toFixed(2)),
            effectiveHourlyRate: parseFloat(effectiveHourlyRate.toFixed(2)),
            minimumWageTopUp: parseFloat(minimumWageTopUp.toFixed(2)),
            paidRestBreaksTotal: parseFloat(paidRestBreaksTotal.toFixed(2)),
            dailyBreakdown: dailyBreakdownsForWeek,
        });
      }
      
      if (weeklySummaries.length > 0) {
        const overallTotalEarnings = weeklySummaries.reduce((acc, s) => acc + s.totalEarnings, 0);
        const overallTotalHours = weeklySummaries.reduce((acc, s) => acc + s.totalHours, 0);
        const overallTotalMinimumWageTopUp = weeklySummaries.reduce((acc, s) => acc + s.minimumWageTopUp, 0);
        const overallTotalPaidRestBreaks = weeklySummaries.reduce((acc, s) => acc + s.paidRestBreaksTotal, 0);
        const finalPay = overallTotalEarnings + overallTotalMinimumWageTopUp + overallTotalPaidRestBreaks;

        employeeSummaries.push({
            employeeId: employee.id,
            employeeName: employee.name,
            weeklySummaries,
            overallTotalEarnings: parseFloat(overallTotalEarnings.toFixed(2)),
            overallTotalHours: parseFloat(overallTotalHours.toFixed(2)),
            overallTotalMinimumWageTopUp: parseFloat(overallTotalMinimumWageTopUp.toFixed(2)),
            overallTotalPaidRestBreaks: parseFloat(overallTotalPaidRestBreaks.toFixed(2)),
            finalPay: parseFloat(finalPay.toFixed(2)),
        });
      }
    }

    return {
        startDate: input.startDate,
        endDate: input.endDate,
        payDate: input.payDate,
        employeeSummaries,
    };
  }
);


// This is the main flow that orchestrates the process.
// It returns the structured data directly.
const generatePayrollReportFlow = ai.defineFlow(
  {
    name: 'generatePayrollReportFlow',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: ProcessedPayrollDataSchema,
  },
  async (input) => {
    // Step 1: Process the raw data using our reliable tool.
    const processedData = await processPayrollData(input);

    // Step 2: Return the clean, processed data directly.
    return processedData;
  }
);
