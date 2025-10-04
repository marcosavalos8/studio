'use server';

/**
 * @fileOverview A payroll report generation AI agent.
 *
 * - generatePayrollReport - A function that handles the payroll report generation process.
 * - GeneratePayrollReportInput - The input type for the generatePayrollReport function.
 * - ProcessedPayrollData - The return type for the generatePayrollReport function, containing structured payroll data.
 */

import { z } from 'zod';
import { getWeek, getYear, format, startOfDay, parseISO, isWithinInterval, differenceInMilliseconds, eachDayOfInterval } from 'date-fns';
import type { Client, Task, ProcessedPayrollData, EmployeePayrollSummary, WeeklySummary, DailyBreakdown, DailyTaskDetail, Employee, Piecework, TimeEntry } from '@/lib/types';


// Main input schema for the server action
const GeneratePayrollReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the payroll report (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date for the payroll report (YYYY-MM-DD).'),
  payDate: z.string().describe('The date the payment is issued (YYYY-MM-DD).'),
  jsonData: z.string().describe('A JSON string containing all necessary payroll data.'),
});
export type GeneratePayrollReportInput = z.infer<typeof GeneratePayrollReportInputSchema>;


export async function generatePayrollReport(input: GeneratePayrollReportInput): Promise<ProcessedPayrollData> {
    const STATE_MINIMUM_WAGE = 16.28;
    const data = JSON.parse(input.jsonData);
    const { employees: reportEmployees, tasks, timeEntries, piecework, clients } = data;

    const clientMap = new Map(clients.map((c: Client) => [c.id, c]));
    const taskMap = new Map(tasks.map((t: Task) => [t.id, t]));
    const employeeMap = new Map(reportEmployees.map((e: Employee) => [e.id, e]));

    const reportInterval = {
        start: startOfDay(parseISO(input.startDate)),
        end: startOfDay(parseISO(input.endDate)),
    };

    const employeeSummaries: EmployeePayrollSummary[] = [];

    // Iterate over only the employees selected for the report
    for (const employee of reportEmployees as Employee[]) {
        const employeeId = employee.id;

        // Filter work for the current employee within the date range
        const empTimeEntries = timeEntries.filter((e: TimeEntry) => e.employeeId === employeeId && e.timestamp && e.endTime && isWithinInterval(parseISO(String(e.timestamp)), reportInterval));
        const empPiecework = piecework.filter((pw: Piecework) => {
            const employeeIdsOnTicket = String(pw.employeeId).split(',').map(id => id.trim());
            const emp = employeeMap.get(employeeId);
            return (employeeIdsOnTicket.includes(employeeId) || (emp && employeeIdsOnTicket.includes(emp.qrCode))) && pw.timestamp && isWithinInterval(parseISO(String(pw.timestamp)), reportInterval);
        });
        
        if (empTimeEntries.length === 0 && empPiecework.length === 0) {
            continue; // Skip employee if they have no activity in the period
        }

        const workByWeek: Record<string, { time: TimeEntry[], pieces: Piecework[] }> = {};

        const allWorkEntries = [...empTimeEntries, ...empPiecework];
        if(allWorkEntries.length === 0) continue;

        // Determine the full range of dates to create week keys
        if (allWorkEntries.length > 0 && allWorkEntries[0].timestamp) {
            const firstDate = allWorkEntries.reduce((min, entry) => {
                const d = parseISO(String(entry.timestamp));
                return d < min ? d : min;
            }, parseISO(String(allWorkEntries[0].timestamp)));
            
            const lastDate = allWorkEntries.reduce((max, entry) => {
                const d = parseISO(String(entry.timestamp));
                return d > max ? d : max;
            }, parseISO(String(allWorkEntries[0].timestamp)));


            const relevantDates = eachDayOfInterval({start: firstDate, end: lastDate});
            
            relevantDates.forEach(date => {
                const weekKey = `${getYear(date)}-${getWeek(date, { weekStartsOn: 1 })}`;
                if (!workByWeek[weekKey]) {
                    workByWeek[weekKey] = { time: [], pieces: [] };
                }
            });
        }


        empTimeEntries.forEach((entry: TimeEntry) => {
            if (!entry.timestamp) return;
            const date = parseISO(String(entry.timestamp));
            const weekKey = `${getYear(date)}-${getWeek(date, { weekStartsOn: 1 })}`;
            if (workByWeek[weekKey]) {
                workByWeek[weekKey].time.push(entry);
            }
        });

        empPiecework.forEach((entry: Piecework) => {
            if (!entry.timestamp) return;
            const date = parseISO(String(entry.timestamp));
            const weekKey = `${getYear(date)}-${getWeek(date, { weekStartsOn: 1 })}`;
            if (workByWeek[weekKey]) {
                workByWeek[weekKey].pieces.push(entry);
            }
        });
        
        const weeklySummaries: WeeklySummary[] = [];

        for (const weekKey in workByWeek) {
            const { time, pieces } = workByWeek[weekKey];
            if (time.length === 0 && pieces.length === 0) continue;

            const [year, weekNumber] = weekKey.split('-').map(Number);
            
            const dailyWork: Record<string, { tasks: Record<string, { hours: number, pieces: number }> }> = {};
            let applicableMinWage = STATE_MINIMUM_WAGE;

            // Process time entries for the week
            time.forEach(entry => {
                if (!entry.timestamp || !entry.endTime) return;
                const date = parseISO(String(entry.timestamp));
                const dayKey = format(date, 'yyyy-MM-dd');
                const hours = differenceInMilliseconds(parseISO(String(entry.endTime)), date) / (1000 * 60 * 60);
                if (hours <= 0) return;

                if (!dailyWork[dayKey]) dailyWork[dayKey] = { tasks: {} };
                if (!dailyWork[dayKey].tasks[entry.taskId]) dailyWork[dayKey].tasks[entry.taskId] = { hours: 0, pieces: 0 };
                dailyWork[dayKey].tasks[entry.taskId].hours += hours;
            });
            
            // Process piecework entries for the week
            pieces.forEach(entry => {
                if (!entry.timestamp) return;
                const date = parseISO(String(entry.timestamp));
                const dayKey = format(date, 'yyyy-MM-dd');
                
                const employeeIdsOnTicket = String(entry.employeeId).split(',').map(id => id.trim()).filter(Boolean);
                 const employeeQRsOnTicket = employeeIdsOnTicket.map(idOrQr => {
                    const empById = employeeMap.get(idOrQr);
                    if(empById) return empById.qrCode;
                    return idOrQr; // assume it is a qr if not an id
                });
                
                const currentEmpQr = employeeMap.get(employeeId)?.qrCode;
                
                if (currentEmpQr && employeeQRsOnTicket.includes(currentEmpQr)) {
                    const pieceCountPerEmployee = entry.pieceCount / employeeQRsOnTicket.length;

                    if (!dailyWork[dayKey]) dailyWork[dayKey] = { tasks: {} };
                    if (!dailyWork[dayKey].tasks[entry.taskId]) dailyWork[dayKey].tasks[entry.taskId] = { hours: 0, pieces: 0 };
                    dailyWork[dayKey].tasks[entry.taskId].pieces += pieceCountPerEmployee;
                }
            });
            
            const dailyBreakdownsForWeek: DailyBreakdown[] = [];
            let weeklyTotalHours = 0;
            let weeklyTotalRawEarnings = 0;

            const sortedDays = Object.keys(dailyWork).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

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

                    if (task.employeePaymentType === 'hourly') {
                        earningsForTask = hours * task.employeeRate;
                    } else if (task.employeePaymentType === 'piecework') {
                        earningsForTask = pieces * task.employeeRate;
                    }

                    dailyTotalHours += hours;
                    dailyTotalEarnings += earningsForTask;

                    taskDetailsForDay.push({
                        taskName: `${task.name} (${task.variety || 'N/A'})`,
                        clientName: client?.name || 'Unknown Client',
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

            if (weeklyTotalHours <= 0) continue;

            const minimumGrossEarnings = weeklyTotalHours * applicableMinWage;
            const minimumWageTopUp = Math.max(0, minimumGrossEarnings - weeklyTotalRawEarnings);

            const totalEarningsBeforeRest = weeklyTotalRawEarnings + minimumWageTopUp;
            const regularRateOfPay = weeklyTotalHours > 0 ? totalEarningsBeforeRest / weeklyTotalHours : 0;
            
            const paidRestBreakHours = Math.floor(weeklyTotalHours / 3.5) * (10 / 60);
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
        
        const totalPayForPeriod = weeklySummaries.reduce((acc, week) => acc + week.finalPay, 0);

        if (totalPayForPeriod > 0 || weeklySummaries.some(w => w.totalHours > 0)) {
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
