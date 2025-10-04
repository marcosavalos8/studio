'use server';

/**
 * @fileOverview A payroll report generation AI agent that understands Washington (WA) labor laws.
 *
 * - generatePayrollReport - A function that handles the payroll report generation process.
 * - GeneratePayrollReportInput - The input type for the generatePayrollReport function.
 * - ProcessedPayrollData - The return type for the generatePayrollTReport function, containing structured payroll data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { getWeek, getYear, format, startOfDay, parseISO, isWithinInterval } from 'date-fns';
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
    
    // --- Create maps for efficient lookups ---
    const clientMap = new Map(clients.map((c: Client) => [c.id, c]));
    const taskMap = new Map(tasks.map((t: Task) => [t.id, t]));
    
    // Universal employee map: find by ID or QR code
    const employeeIdMap = new Map(employees.map((e: Employee) => [e.id, e]));
    const employeeQrMap = new Map(employees.map((e: Employee) => [e.qrCode, e]));
    const findEmployee = (identifier: string): Employee | undefined => {
        return employeeIdMap.get(identifier) || employeeQrMap.get(identifier);
    }


    // --- Phase 1: Aggregate Raw Data ---
    // Structure: { employeeId: { "YYYY-MM-DD": { taskId: { hours: X, pieces: Y } } } }
    const workData: Record<string, Record<string, Record<string, { hours: number, pieces: number }>>> = {};

    const reportInterval = {
        start: startOfDay(parseISO(input.startDate)),
        end: startOfDay(parseISO(input.endDate)),
    };
    
    // Initialize structure for all selected employees in the report
    for (const employee of employees) {
        workData[employee.id] = {};
    }

    // Process time entries
    for (const entry of timeEntries) {
        if (!entry.timestamp || !entry.endTime || !entry.employeeId || !entry.taskId) continue;
        
        const entryStart = parseISO(entry.timestamp);
        if (!isWithinInterval(entryStart, reportInterval)) continue;

        const dayKey = format(entryStart, 'yyyy-MM-dd');
        const hours = (parseISO(entry.endTime).getTime() - entryStart.getTime()) / (1000 * 60 * 60);

        const employee = findEmployee(entry.employeeId);
        if (!employee) continue;

        if (!workData[employee.id]) workData[employee.id] = {};
        if (!workData[employee.id][dayKey]) workData[employee.id][dayKey] = {};
        if (!workData[employee.id][dayKey][entry.taskId]) workData[employee.id][dayKey][entry.taskId] = { hours: 0, pieces: 0 };
        
        workData[employee.id][dayKey][entry.taskId].hours += hours;
    }

    // Process piecework entries
    for (const entry of piecework) {
        if (!entry.timestamp || !entry.employeeId || !entry.taskId) continue;
        
        const entryStart = parseISO(entry.timestamp);
        if (!isWithinInterval(entryStart, reportInterval)) continue;

        const dayKey = format(entryStart, 'yyyy-MM-dd');
        const employeeIdentifiers = String(entry.employeeId).split(',').map(id => id.trim()).filter(Boolean);
        
        const validEmployeesInEntry = employeeIdentifiers.map(findEmployee).filter((e): e is Employee => !!e);
        if (validEmployeesInEntry.length === 0) continue;

        const numEmployees = validEmployeesInEntry.length;
        const individualPieceCount = (entry.pieceCount || 0) / numEmployees;
        
        for (const emp of validEmployeesInEntry) {
            if (!workData[emp.id]) workData[emp.id] = {};
            if (!workData[emp.id][dayKey]) workData[emp.id][dayKey] = {};
            if (!workData[emp.id][dayKey][entry.taskId]) workData[emp.id][dayKey][entry.taskId] = { hours: 0, pieces: 0 };
            
            workData[emp.id][dayKey][entry.taskId].pieces += individualPieceCount;
        }
    }


    // --- Phase 2: Calculate Earnings and Build Summaries ---
    const employeeSummaries: EmployeePayrollSummary[] = [];

    for (const employee of employees) {
        const empWork = workData[employee.id];
        if (!empWork || Object.keys(empWork).length === 0) continue;

        // Group daily work by week
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
            let weeklyTotalPieceworkEarnings = 0;
            let weeklyTotalHourlyEarnings = 0;
            const clientIdsInWeek = new Set<string>();
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

                    clientIdsInWeek.add(task.clientId);
                    const clientName = clientMap.get(task.clientId)?.name || 'Unknown Client';
                    const { hours, pieces } = dayData[taskId];

                    const hourlyEarnings = task.employeePayType === 'hourly' ? hours * task.employeeRate : 0;
                    const pieceworkEarnings = task.employeePayType === 'piecework' ? pieces * task.employeeRate : 0;
                    const totalEarningsForTask = hourlyEarnings + pieceworkEarnings;
                    
                    dailyTotalHours += hours;
                    dailyTotalEarnings += totalEarningsForTask;
                    
                    weeklyTotalHourlyEarnings += hourlyEarnings;
                    weeklyTotalPieceworkEarnings += pieceworkEarnings;

                    taskDetailsForDay.push({
                        taskName: `${task.name} (${task.variety || 'N/A'})`,
                        clientName: clientName,
                        ranch: task.ranch,
                        block: task.block,
                        hours: hours,
                        pieceworkCount: pieces,
                        hourlyEarnings,
                        pieceworkEarnings,
                        totalEarnings: totalEarningsForTask,
                    });
                }
                
                weeklyTotalHours += dailyTotalHours;
                dailyBreakdownsForWeek.push({
                    date: dayKey,
                    tasks: taskDetailsForDay,
                    totalDailyHours: parseFloat(dailyTotalHours.toFixed(2)),
                    totalDailyEarnings: parseFloat(dailyTotalEarnings.toFixed(2)),
                });
            }

            const weeklyTotalEarnings = weeklyTotalHourlyEarnings + weeklyTotalPieceworkEarnings;
            
            const clientWages = Array.from(clientIdsInWeek).map(id => clientMap.get(id)?.minimumWage).filter(Boolean) as number[];
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


const generatePayrollReportFlow = ai.defineFlow(
  {
    name: 'generatePayrollReportFlow',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: ProcessedPayrollDataSchema,
  },
  async (input) => {
    const processedData = await processPayrollData(input);
    return processedData;
  }
);

    