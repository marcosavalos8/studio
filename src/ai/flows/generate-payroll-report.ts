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
import { getWeek, getYear } from 'date-fns';

// Main input schema for the server action
const GeneratePayrollReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the payroll report (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date for the payroll report (YYYY-MM-DD).'),
  payDate: z.string().describe('The date the payment is issued (YYYY-MM-DD).'),
  jsonData: z.string().describe('A JSON string containing all necessary payroll data.'),
});
export type GeneratePayrollReportInput = z.infer<typeof GeneratePayrollReportInputSchema>;


// Define schemas for our processed data. This is what the tool will output.
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
    const { employees, tasks, timeEntries, piecework } = data;
    const WA_MINIMUM_WAGE = 16.28;
    const employeeSummaries: z.infer<typeof EmployeePayrollSummarySchema>[] = [];

    for (const employee of employees) {
        const weeklyData: Record<string, { totalHours: number; totalPieceworkEarnings: number; totalHourlyEarnings: number }> = {};

        // Process time entries for hours worked
        const empTimeEntries = timeEntries.filter((te: any) => te.employeeId === employee.id && te.timestamp && te.endTime);
        for (const entry of empTimeEntries) {
            const start = new Date(entry.timestamp);
            const end = new Date(entry.endTime);
            const weekKey = `${getYear(start)}-${getWeek(start)}`;

            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { totalHours: 0, totalPieceworkEarnings: 0, totalHourlyEarnings: 0 };
            }
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            weeklyData[weekKey].totalHours += hours;

            const task = tasks.find((t: any) => t.id === entry.taskId);
            if (task && task.employeePayType === 'hourly') {
                weeklyData[weekKey].totalHourlyEarnings += hours * task.employeeRate;
            }
        }

        // Process piecework entries
        const empPiecework = piecework.filter((pw: any) => pw.employeeId === employee.id && pw.timestamp);
         for (const entry of empPiecework) {
            const start = new Date(entry.timestamp);
            const weekKey = `${getYear(start)}-${getWeek(start)}`;
             if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { totalHours: 0, totalPieceworkEarnings: 0, totalHourlyEarnings: 0 };
            }
            const task = tasks.find((t: any) => t.id === entry.taskId);
            if (task && task.employeePayType === 'piecework') {
                weeklyData[weekKey].totalPieceworkEarnings += entry.pieceCount * task.employeeRate;
            }
        }

        const weeklySummaries: z.infer<typeof WeeklySummarySchema>[] = [];
        for (const weekKey in weeklyData) {
            const [year, weekNumber] = weekKey.split('-').map(Number);
            const week = weeklyData[weekKey];
            const totalEarnings = week.totalHourlyEarnings + week.totalPieceworkEarnings;
            const effectiveHourlyRate = week.totalHours > 0 ? totalEarnings / week.totalHours : 0;
            
            // Calculate minimum wage top-up
            let minimumWageTopUp = 0;
            if (week.totalHours > 0 && effectiveHourlyRate < WA_MINIMUM_WAGE) {
                minimumWageTopUp = (WA_MINIMUM_WAGE * week.totalHours) - totalEarnings;
            }

            // Calculate paid rest breaks
            const restBreakMinutes = Math.floor(week.totalHours / 4) * 10;
            const regularRateOfPay = effectiveHourlyRate > WA_MINIMUM_WAGE ? effectiveHourlyRate : WA_MINIMUM_WAGE;
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
            });
        }
        
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
