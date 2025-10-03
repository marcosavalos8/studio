'use server';

/**
 * @fileOverview A payroll report generation AI agent that understands Washington (WA) labor laws.
 *
 * - generatePayrollReport - A function that handles the payroll report generation process.
 * - GeneratePayrollReportInput - The input type for the generatePayrollReport function.
 * - GeneratePayrollReportOutput - The return type for the generatePayrollReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import {googleAI} from '@genkit-ai/google-genai';
import { getWeek, getYear } from 'date-fns';

// Main input schema for the server action
const GeneratePayrollReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the payroll report (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date for the payroll report (YYYY-MM-DD).'),
  jsonData: z.string().describe('A JSON string containing all necessary payroll data.'),
});
export type GeneratePayrollReportInput = z.infer<typeof GeneratePayrollReportInputSchema>;

// Main output schema for the server action
const GeneratePayrollReportOutputSchema = z.object({
  report: z.string().describe('The generated payroll report in markdown format.'),
});
export type GeneratePayrollReportOutput = z.infer<typeof GeneratePayrollReportOutputSchema>;

// Exported function called by the server action
export async function generatePayrollReport(input: GeneratePayrollReportInput): Promise<GeneratePayrollReportOutput> {
  // The main flow now orchestrates the tool call and the formatting flow
  return generatePayrollReportFlow(input);
}


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
    employeeSummaries: z.array(EmployeePayrollSummarySchema),
});


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
        employeeSummaries,
    };
  }
);


// This is a simple flow whose only job is to format the pre-processed data.
const formatReportFlow = ai.defineFlow(
  {
    name: 'formatReportFlow',
    inputSchema: ProcessedPayrollDataSchema,
    outputSchema: GeneratePayrollReportOutputSchema,
    model: googleAI('gemini-1.5-pro'),
  },
  async (processedData) => {
    const { output } = await ai.generate({
      prompt: `
        You are a payroll assistant. You have been given pre-calculated payroll data that complies with Washington (WA) state labor laws.
        Your task is to format this data into a clean, easy-to-read markdown report. Do not perform any new calculations.

        The data provided is:
        \`\`\`json
        ${JSON.stringify(processedData, null, 2)}
        \`\`\`
        
        Generate a markdown report with the following structure:
        - A main title: "Payroll Report for [startDate] to [endDate]".
        - A section for each employee, titled with their name.
        - For each employee, include a sub-section for each weekly summary.
        - In each weekly summary, list: Total Hours, Total Earnings, Effective Hourly Rate, Minimum Wage Top-up, and Paid Rest Breaks.
        - After the weekly summaries, provide an overall summary for the employee including: Final Pay.
        - Ensure all monetary values are prefixed with a '$' and formatted to two decimal places.
      `,
      output: {
        schema: GeneratePayrollReportOutputSchema,
      }
    });

    if (!output) {
      throw new Error("The AI model failed to generate the report format.");
    }
    return output;
  }
);

// This is the main flow that orchestrates the process.
const generatePayrollReportFlow = ai.defineFlow(
  {
    name: 'generatePayrollReportFlow',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: GeneratePayrollReportOutputSchema,
  },
  async (input) => {
    // Step 1: Process the raw data using our reliable tool.
    const processedData = await processPayrollData(input);

    // Step 2: Pass the clean, processed data to the formatting flow.
    const report = await formatReportFlow(processedData);

    return report;
  }
);
