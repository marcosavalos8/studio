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
import {googleAI} from '@genkit-ai/google-genai';
import { getWeek, getYear, format, startOfDay } from 'date-fns';
import type { Client, Task } from '@/lib/types';

const STATE_MINIMUM_WAGE = 16.28;

// Main input schema for the server action
const GeneratePayrollReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the payroll report (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date for the payroll report (YYYY-MM-DD).'),
  payDate: z.string().describe('The date the payment is issued (YYYY-MM-DD).'),
  jsonData: z.string().describe('A JSON string containing all necessary payroll data.'),
});
export type GeneratePayrollReportInput = z.infer<typeof GeneratePayrollReportInputSchema>;


// Define schemas for our processed data. This is what the tool will output.
const DailyTaskDetailSchema = z.object({
  taskName: z.string(),
  clientName: z.string(),
  ranch: z.string().optional(),
  block: z.string().optional(),
  hours: z.number(),
  pieceworkCount: z.number(),
  hourlyEarnings: z.number(),
  pieceworkEarnings: z.number(),
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
export type ProcessedPayrollData = z.infer<typeof ProcessedPayrollDataSchema>;


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
    
    const employeeSummaries: z.infer<typeof EmployeePayrollSummarySchema>[] = [];
    
    const clientMap = new Map(clients.map((c: Client) => [c.id, c]));
    const taskMap = new Map(tasks.map((t: Task) => [t.id, t]));

    for (const employee of employees) {
        // [WeekKey]: { data }
        const weeklyData: Record<string, { 
            totalHours: number; 
            totalPieceworkEarnings: number; 
            totalHourlyEarnings: number; 
            clientIds: Set<string>; // Keep track of clients worked for this week
            dailyBreakdown: Record<string, { tasks: Record<string, z.infer<typeof DailyTaskDetailSchema>> }> 
        }> = {};

        // Process time entries for hours worked
        const empTimeEntries = timeEntries.filter((te: any) => te.employeeId === employee.id && te.timestamp && te.endTime);
        for (const entry of empTimeEntries) {
            const start = new Date(entry.timestamp);
            const end = new Date(entry.endTime);
            const weekKey = `${getYear(start)}-${getWeek(start, { weekStartsOn: 1 })}`;
            const dayKey = format(startOfDay(start), 'yyyy-MM-dd');

            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { totalHours: 0, totalPieceworkEarnings: 0, totalHourlyEarnings: 0, clientIds: new Set(), dailyBreakdown: {} };
            }
            if (!weeklyData[weekKey].dailyBreakdown[dayKey]) {
                weeklyData[weekKey].dailyBreakdown[dayKey] = { tasks: {} };
            }

            const task = taskMap.get(entry.taskId);
            if (task) {
                weeklyData[weekKey].clientIds.add(task.clientId);
                if (!weeklyData[weekKey].dailyBreakdown[dayKey].tasks[task.id]) {
                    const clientName = clientMap.get(task.clientId)?.name || 'Unknown';
                    weeklyData[weekKey].dailyBreakdown[dayKey].tasks[task.id] = { taskName: `${task.name} (${task.variety || 'N/A'})`, clientName, ranch: task.ranch || '', block: task.block || '', hours: 0, pieceworkCount: 0, hourlyEarnings: 0, pieceworkEarnings: 0 };
                }

                const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                weeklyData[weekKey].totalHours += hours;
                weeklyData[weekKey].dailyBreakdown[dayKey].tasks[task.id].hours += hours;

                if (task.employeePayType === 'hourly') {
                    const earnings = hours * task.employeeRate;
                    weeklyData[weekKey].totalHourlyEarnings += earnings;
                    weeklyData[weekKey].dailyBreakdown[dayKey].tasks[task.id].hourlyEarnings += earnings;
                }
            }
        }

        // Process piecework entries
        const empPiecework = piecework.filter((pw: any) => {
            const employeeIds = String(pw.employeeId || '').split(',');
            return employeeIds.includes(employee.id) || employeeIds.includes(employee.qrCode);
        });

         for (const entry of empPiecework) {
            const start = new Date(entry.timestamp);
            const weekKey = `${getYear(start)}-${getWeek(start, { weekStartsOn: 1 })}`;
            const dayKey = format(startOfDay(start), 'yyyy-MM-dd');
            
            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { totalHours: 0, totalPieceworkEarnings: 0, totalHourlyEarnings: 0, clientIds: new Set(), dailyBreakdown: {} };
            }
            if (!weeklyData[weekKey].dailyBreakdown[dayKey]) {
                weeklyData[weekKey].dailyBreakdown[dayKey] = { tasks: {} };
            }

            const task = taskMap.get(entry.taskId);
            if (task) {
                weeklyData[weekKey].clientIds.add(task.clientId);
                if (!weeklyData[weekKey].dailyBreakdown[dayKey].tasks[task.id]) {
                     const clientName = clientMap.get(task.clientId)?.name || 'Unknown';
                     weeklyData[weekKey].dailyBreakdown[dayKey].tasks[task.id] = { taskName: `${task.name} (${task.variety || 'N/A'})`, clientName, ranch: task.ranch || '', block: task.block || '', hours: 0, pieceworkCount: 0, hourlyEarnings: 0, pieceworkEarnings: 0 };
                }

                if (task.employeePayType === 'piecework') {
                    const employeeIdsInEntry = String(entry.employeeId || '').split(',').map(id => id.trim()).filter(Boolean);
                    const numEmployees = employeeIdsInEntry.length > 0 ? employeeIdsInEntry.length : 1;
                    const individualPieceCount = entry.pieceCount / numEmployees;
                    const individualEarnings = individualPieceCount * task.employeeRate;

                    weeklyData[weekKey].totalPieceworkEarnings += individualEarnings;
                    weeklyData[weekKey].dailyBreakdown[dayKey].tasks[task.id].pieceworkCount += individualPieceCount;
                    weeklyData[weekKey].dailyBreakdown[dayKey].tasks[task.id].pieceworkEarnings += individualEarnings;
                }
            }
        }

        const weeklySummaries: z.infer<typeof WeeklySummarySchema>[] = [];
        for (const weekKey in weeklyData) {
            const [year, weekNumber] = weekKey.split('-').map(Number);
            const week = weeklyData[weekKey];

            // Determine the applicable minimum wage for the week
            const clientWages = Array.from(week.clientIds).map(id => clientMap.get(id)?.minimumWage).filter(Boolean) as number[];
            const applicableMinimumWage = clientWages.length > 0 ? Math.max(...clientWages) : STATE_MINIMUM_WAGE;
            
            const dailyBreakdown: z.infer<typeof DailyBreakdownSchema>[] = Object.entries(week.dailyBreakdown).map(([date, dayData]) => {
                const tasks = Object.values(dayData.tasks);
                const totalDailyHours = tasks.reduce((acc, t) => acc + t.hours, 0);
                const totalDailyEarnings = tasks.reduce((acc, t) => acc + t.hourlyEarnings + t.pieceworkEarnings, 0);
                return {
                    date,
                    tasks: tasks,
                    totalDailyHours: parseFloat(totalDailyHours.toFixed(2)),
                    totalDailyEarnings: parseFloat(totalDailyEarnings.toFixed(2)),
                }
            }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const totalEarnings = week.totalHourlyEarnings + week.totalPieceworkEarnings;
            
            let effectiveHourlyRate = week.totalHours > 0 ? totalEarnings / week.totalHours : 0;
            
            let minimumWageTopUp = 0;
            if (week.totalHours > 0 && effectiveHourlyRate < applicableMinimumWage) {
                minimumWageTopUp = (applicableMinimumWage * week.totalHours) - totalEarnings;
            }

            const totalEarningsWithTopUp = totalEarnings + minimumWageTopUp;
            const regularRateOfPay = week.totalHours > 0 ? totalEarningsWithTopUp / week.totalHours : applicableMinimumWage;

            const restBreakMinutes = Math.floor(week.totalHours / 4) * 10;
            const paidRestBreaksTotal = (restBreakMinutes / 60) * regularRateOfPay;

            weeklySummaries.push({
                weekNumber,
                year,
                totalHours: parseFloat(week.totalHours.toFixed(2)),
                totalPieceworkEarnings: parseFloat(week.totalPieceworkEarnings.toFixed(2)),
                totalHourlyEarnings: parseFloat(week.totalHourlyEarnings.toFixed(2)),
                totalEarnings: parseFloat(totalEarnings.toFixed(2)),
                effectiveHourlyRate: parseFloat(effectiveHourlyRate.toFixed(2)),
                minimumWageTopUp: parseFloat(minimumWageTopUp.toFixed(2)),
                paidRestBreaksTotal: parseFloat(paidRestBreaksTotal.toFixed(2)),
                dailyBreakdown: dailyBreakdown,
            });
        }
        
        const overallTotalEarnings = weeklySummaries.reduce((acc, s) => acc + s.totalEarnings, 0);
        const overallTotalHours = weeklySummaries.reduce((acc, s) => acc + s.totalHours, 0);
        const overallTotalMinimumWageTopUp = weeklySummaries.reduce((acc, s) => acc + s.minimumWageTopUp, 0);
        const overallTotalPaidRestBreaks = weeklySummaries.reduce((acc, s) => acc + s.paidRestBreaksTotal, 0);
        
        const finalPay = overallTotalEarnings + overallTotalMinimumWageTopUp + overallTotalPaidRestBreaks;

        if (weeklySummaries.length > 0) {
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
