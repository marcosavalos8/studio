'use server';

/**
 * @fileOverview A payroll report generation AI agent.
 *
 * - generatePayrollReport - A function that handles the payroll report generation process.
 * - GeneratePayrollReportInput - The input type for the generatePayrollReport function.
 * - ProcessedPayrollData - The return type for the generatePayrollReport function, containing structured payroll data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { getWeek, getYear, format, startOfDay, parseISO, isWithinInterval, differenceInMilliseconds } from 'date-fns';
import type { Client, Task, ProcessedPayrollData, EmployeePayrollSummary, WeeklySummary, DailyBreakdown, DailyTaskDetail, Employee, Piecework, TimeEntry } from '@/lib/types';


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
    totalEarnings: z.number(),
    dailyBreakdown: z.array(DailyBreakdownSchema),
});

const EmployeePayrollSummarySchema = z.object({
    employeeId: z.string(),
    employeeName: z.string(),
    weeklySummaries: z.array(WeeklySummarySchema),
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


// This tool does the heavy lifting of calculating a simple payroll.
const processPayrollData = ai.defineTool(
  {
    name: 'processPayrollData',
    description: 'Processes raw payroll data to calculate simple earnings. THIS IS A RADICALLY SIMPLIFIED VERSION.',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: ProcessedPayrollDataSchema,
  },
  async (input) => {
    const data = JSON.parse(input.jsonData);
    const { employees, tasks, timeEntries, piecework, clients } = data;
    
    const clientMap = new Map(clients.map((c: Client) => [c.id, c]));
    const taskMap = new Map(tasks.map((t: Task) => [t.id, t]));
    const employeeMap = new Map(employees.map((e: Employee) => [e.id, e]));

    const reportInterval = {
        start: startOfDay(parseISO(input.startDate)),
        end: startOfDay(parseISO(input.endDate)),
    };
    
    // Structure to hold aggregated work data per employee, per day, per task
    // employeeId -> day (yyyy-MM-dd) -> taskId -> { hours, pieces }
    const workData: Record<string, Record<string, Record<string, { hours: number, pieces: number }>>> = {};

    // 1. Aggregate all work data first

    // Aggregate hours from time entries
    for (const entry of timeEntries) {
        if (!entry.timestamp || !entry.endTime || !entry.employeeId || !entry.taskId) continue;
        
        const entryStart = parseISO(entry.timestamp);
        if (!isWithinInterval(entryStart, reportInterval)) continue;

        const employeeId = entry.employeeId;
        const employee = employeeMap.get(employeeId);
        if (!employee) continue;

        const hours = differenceInMilliseconds(parseISO(entry.endTime), entryStart) / (1000 * 60 * 60);
        if (hours <= 0) continue;

        const dayKey = format(entryStart, 'yyyy-MM-dd');
        
        if (!workData[employeeId]) workData[employeeId] = {};
        if (!workData[employeeId][dayKey]) workData[employeeId][dayKey] = {};
        if (!workData[employeeId][dayKey][entry.taskId]) workData[employeeId][dayKey][entry.taskId] = { hours: 0, pieces: 0 };
        
        workData[employeeId][dayKey][entry.taskId].hours += hours;
    }

    // Aggregate pieces from piecework entries
    for (const entry of piecework) {
        if (!entry.timestamp || !entry.employeeId || !entry.taskId || !entry.pieceCount) continue;
        
        const entryStart = parseISO(entry.timestamp);
        if (!isWithinInterval(entryStart, reportInterval)) continue;

        const employeeIdentifiers = String(entry.employeeId).split(',').map(id => id.trim()).filter(Boolean);
        if (employeeIdentifiers.length === 0) continue;
        
        const employeesOnTicket = employeeIdentifiers.map(id => employees.find((e: Employee) => e.id === id || e.qrCode === id)).filter(Boolean);
        if (employeesOnTicket.length === 0) continue;

        const pieceCountPerEmployee = entry.pieceCount / employeesOnTicket.length;
        const dayKey = format(entryStart, 'yyyy-MM-dd');

        for (const emp of employeesOnTicket) {
             if (!emp) continue;
             const employeeId = emp.id;
             if (!workData[employeeId]) workData[employeeId] = {};
             if (!workData[employeeId][dayKey]) workData[employeeId][dayKey] = {};
             if (!workData[employeeId][dayKey][entry.taskId]) workData[employeeId][dayKey][entry.taskId] = { hours: 0, pieces: 0 };
            
             workData[employeeId][dayKey][entry.taskId].pieces += pieceCountPerEmployee;
        }
    }

    // 2. Process aggregated data to calculate earnings
    const employeeSummaries: EmployeePayrollSummary[] = [];

    // Iterate over employees who actually have work data
    for (const employeeId in workData) {
        const employee = employeeMap.get(employeeId);
        if (!employee) continue;

        const empWork = workData[employeeId];
        const workByWeek: Record<string, Record<string, any>> = {};

        for (const dayKey in empWork) {
            const date = parseISO(dayKey);
            const weekKey = `${getYear(date)}-${getWeek(date, { weekStartsOn: 1 })}`;
            if (!workByWeek[weekKey]) workByWeek[weekKey] = {};
            workByWeek[weekKey][dayKey] = empWork[dayKey];
        }

        const weeklySummaries: WeeklySummary[] = [];
        
        for (const weekKey in workByWeek) {
            const weekData = workByWeek[weekKey];
            const [year, weekNumber] = weekKey.split('-').map(Number);
            
            let weeklyTotalHours = 0;
            let weeklyTotalEarnings = 0;
            const dailyBreakdownsForWeek: DailyBreakdown[] = [];

            const sortedDays = Object.keys(weekData).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

            for(const dayKey of sortedDays) {
                const dayData = weekData[dayKey];
                let dailyTotalHours = 0;
                let dailyTotalEarnings = 0;
                const taskDetailsForDay: DailyTaskDetail[] = [];

                for (const taskId in dayData) {
                    const task = taskMap.get(taskId);
                    if (!task) continue;
                    
                    const client = clientMap.get(task.clientId);
                    const clientName = client?.name || 'Unknown Client';
                    
                    const { hours, pieces } = dayData[taskId];
                    
                    // --- SIMPLE EARNINGS CALCULATION ---
                    let totalEarningsForTask = 0;
                    if (task.employeePayType === 'hourly') {
                        totalEarningsForTask = hours * task.employeeRate;
                    } else if (task.employeePayType === 'piecework') {
                        totalEarningsForTask = pieces * task.employeeRate;
                    }
                    
                    dailyTotalHours += hours;
                    dailyTotalEarnings += totalEarningsForTask;

                    taskDetailsForDay.push({
                        taskName: `${task.name} (${task.variety || 'N/A'})`,
                        clientName: clientName,
                        ranch: task.ranch,
                        block: task.block,
                        hours: hours,
                        pieceworkCount: pieces,
                        totalEarnings: totalEarningsForTask,
                    });
                }
                
                weeklyTotalHours += dailyTotalHours;
                weeklyTotalEarnings += dailyTotalEarnings;

                dailyBreakdownsForWeek.push({
                    date: dayKey,
                    tasks: taskDetailsForDay,
                    totalDailyHours: parseFloat(dailyTotalHours.toFixed(2)),
                    totalDailyEarnings: parseFloat(dailyTotalEarnings.toFixed(2)),
                });
            }

            // SIMPLE EARNINGS - NO MINIMUM WAGE ADJUSTMENT
            const finalWeeklyPay = weeklyTotalEarnings;

            weeklySummaries.push({
                weekNumber,
                year,
                totalHours: parseFloat(weeklyTotalHours.toFixed(2)),
                totalEarnings: parseFloat(finalWeeklyPay.toFixed(2)),
                dailyBreakdown: dailyBreakdownsForWeek,
            });
        }
        
        const totalPayForPeriod = weeklySummaries.reduce((acc, week) => acc + week.totalEarnings, 0);

        // Add employee to summary ONLY if they have summaries to show
        if (weeklySummaries.length > 0) {
            employeeSummaries.push({
                employeeId: employee.id,
                employeeName: employee.name,
                weeklySummaries,
                finalPay: parseFloat(totalPayForPeriod.toFixed(2)),
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


const generatePayrollReportFlow = ai.defineFlow(
  {
    name: 'generatePayrollReportFlow',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: ProcessedPayrollDataSchema,
  },
  async (input) => {
    // This is a direct pass-through to the simplified tool.
    const processedData = await processPayrollData(input);
    return processedData;
  }
);
