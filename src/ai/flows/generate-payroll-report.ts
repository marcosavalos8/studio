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
    description: 'Processes raw payroll data to calculate simple earnings, including minimum wage adjustments.',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: ProcessedPayrollDataSchema,
  },
  async (input) => {
    const data = JSON.parse(input.jsonData);
    const { employees, tasks, timeEntries, piecework, clients } = data;
    
    const clientMap = new Map(clients.map((c: Client) => [c.id, c]));
    const taskMap = new Map(tasks.map((t: Task) => [t.id, t]));

    const employeeIdMap = new Map<string, Employee>();
    const employeeQrMap = new Map<string, Employee>();
    employees.forEach((e: Employee) => {
        if (e.id) employeeIdMap.set(e.id, e);
        if (e.qrCode) employeeQrMap.set(e.qrCode, e);
    });

    const findEmployee = (identifier: string): Employee | undefined => {
        return employeeIdMap.get(identifier) || employeeQrMap.get(identifier);
    };
    
    // 1. Aggregate all raw work data
    const workData: Record<string, Record<string, Record<string, { hours: number, pieces: number }>>> = {};
    const reportInterval = {
        start: startOfDay(parseISO(input.startDate)),
        end: startOfDay(parseISO(input.endDate)),
    };
    
    for (const entry of timeEntries) {
        if (!entry.timestamp || !entry.endTime || !entry.employeeId || !entry.taskId) continue;
        
        const entryStart = parseISO(entry.timestamp);
        if (!isWithinInterval(entryStart, reportInterval)) continue;

        const hours = differenceInMilliseconds(parseISO(entry.endTime), entryStart) / (1000 * 60 * 60);
        if (hours <= 0) continue;

        const employee = findEmployee(entry.employeeId);
        if (!employee) continue;

        if (!workData[employee.id]) workData[employee.id] = {};
        const dayKey = format(entryStart, 'yyyy-MM-dd');
        if (!workData[employee.id][dayKey]) workData[employee.id][dayKey] = {};
        if (!workData[employee.id][dayKey][entry.taskId]) workData[employee.id][dayKey][entry.taskId] = { hours: 0, pieces: 0 };
        
        workData[employee.id][dayKey][entry.taskId].hours += hours;
    }

    for (const entry of piecework) {
        if (!entry.timestamp || !entry.employeeId || !entry.taskId) continue;
        
        const entryStart = parseISO(entry.timestamp);
        if (!isWithinInterval(entryStart, reportInterval)) continue;

        const employeeIdentifiers = String(entry.employeeId).split(',').map(id => id.trim()).filter(Boolean);
        if (employeeIdentifiers.length === 0) continue;

        const validEmployeesInEntry = employeeIdentifiers.map(findEmployee).filter((e): e is Employee => !!e);
        if (validEmployeesInEntry.length === 0) continue;

        const numEmployees = validEmployeesInEntry.length;
        const individualPieceCount = (entry.pieceCount || 0) / numEmployees;
        const dayKey = format(entryStart, 'yyyy-MM-dd');
        
        for (const emp of validEmployeesInEntry) {
            if (!workData[emp.id]) workData[emp.id] = {};
            if (!workData[emp.id][dayKey]) workData[emp.id][dayKey] = {};
            if (!workData[emp.id][dayKey][entry.taskId]) workData[emp.id][dayKey][entry.taskId] = { hours: 0, pieces: 0 };
            
            workData[emp.id][dayKey][entry.taskId].pieces += individualPieceCount;
        }
    }

    // 2. Process aggregated data for each employee
    const employeeSummaries: EmployeePayrollSummary[] = [];

    for (const employeeId in workData) {
        const employee = findEmployee(employeeId);
        if (!employee) continue;

        const empWork = workData[employeeId];
        if (!empWork || Object.keys(empWork).length === 0) continue;

        const workByWeek: Record<string, Record<string, any>> = {};
        for (const dayKey in empWork) {
            const date = parseISO(dayKey);
            const weekKey = `${getYear(date)}-${getWeek(date, { weekStartsOn: 1 })}`;
            if (!workByWeek[weekKey]) workByWeek[weekKey] = {};
            workByWeek[weekKey][dayKey] = empWork[dayKey];
        }

        const weeklySummaries: WeeklySummary[] = [];
        let totalPayForPeriod = 0;
        
        for (const weekKey in workByWeek) {
            const weekData = workByWeek[weekKey];
            const [year, weekNumber] = weekKey.split('-').map(Number);
            
            let weeklyTotalHours = 0;
            let weeklyTotalEarnings = 0;
            const dailyBreakdownsForWeek: DailyBreakdown[] = [];
            let highestMinWageForWeek = 16.28; // WA State minimum wage

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
                    
                    if (client && client.minimumWage && client.minimumWage > highestMinWageForWeek) {
                        highestMinWageForWeek = client.minimumWage;
                    }

                    const { hours, pieces } = dayData[taskId];
                    
                    const hourlyEarnings = task.employeePayType === 'hourly' ? hours * task.employeeRate : 0;
                    const pieceworkEarnings = task.employeePayType === 'piecework' ? pieces * task.employeeRate : 0;
                    const totalEarningsForTask = hourlyEarnings + pieceworkEarnings;
                    
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

            const minimumWageGuarantee = weeklyTotalHours * highestMinWageForWeek;
            let finalWeeklyPay = weeklyTotalEarnings;

            if (weeklyTotalEarnings < minimumWageGuarantee) {
                finalWeeklyPay = minimumWageGuarantee;
            }

            weeklySummaries.push({
                weekNumber,
                year,
                totalHours: parseFloat(weeklyTotalHours.toFixed(2)),
                totalEarnings: parseFloat(finalWeeklyPay.toFixed(2)),
                dailyBreakdown: dailyBreakdownsForWeek,
            });

            totalPayForPeriod += finalWeeklyPay;
        }
        
        employeeSummaries.push({
            employeeId: employee.id,
            employeeName: employee.name,
            weeklySummaries,
            finalPay: parseFloat(totalPayForPeriod.toFixed(2)),
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
