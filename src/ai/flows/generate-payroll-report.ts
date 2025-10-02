'use server';

/**
 * @fileOverview A payroll report generation AI agent that understands Washington (WA) labor laws.
 *
 * - generatePayrollReport - A function that handles the payroll report generation process.
 * - GeneratePayrollReportInput - The input type for the generatePayrollReport function.
 * - GeneratePayrollReportOutput - The return type for the generatePayrollReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getFirestore, collection, query, where, getDocs, Timestamp} from 'firebase-admin/firestore';
import {initializeApp, getApps} from 'firebase-admin/app';
import type {TimeEntry, Piecework, Task, Employee} from '@/lib/types';


if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function getPayrollData(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const employeesRef = db.collection('employees');
  const employeesSnap = await employeesRef.get();
  const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));

  const tasksRef = db.collection('tasks');
  const tasksSnap = await tasksRef.get();
  const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

  const timeEntriesRef = db.collection('time_entries');
  const timeEntriesQuery = query(
    timeEntriesRef,
    where('timestamp', '>=', start),
    where('timestamp', '<=', end)
  );
  const timeEntriesSnap = await getDocs(timeEntriesQuery);
  const timeEntries = timeEntriesSnap.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate(),
        endTime: data.endTime ? (data.endTime as Timestamp).toDate() : null
     } as TimeEntry
  });

  const pieceworkRef = db.collection('piecework');
  const pieceworkQuery = query(
      pieceworkRef,
      where('timestamp', '>=', start),
      where('timestamp', '<=', end)
  );
  const pieceworkSnap = await getDocs(pieceworkQuery);
  const piecework = pieceworkSnap.docs.map(doc => {
       const data = doc.data();
      return { 
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate()
     } as Piecework
  });
  
  return {
    employees,
    tasks,
    timeEntries,
    piecework
  };
}

const payrollDataTool = ai.defineTool(
    {
        name: 'getPayrollData',
        description: 'Retrieves payroll data from the database for a given date range.',
        inputSchema: z.object({
            startDate: z.string().describe('The start date of the pay period (YYYY-MM-DD)'),
            endDate: z.string().describe('The end date of the pay period (YYYY-MM-DD)'),
        }),
        outputSchema: z.any(),
    },
    async ({startDate, endDate}) => {
        return await getPayrollData(startDate, endDate);
    }
);


const GeneratePayrollReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the payroll report (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date for the payroll report (YYYY-MM-DD).'),
});
export type GeneratePayrollReportInput = z.infer<typeof GeneratePayrollReportInputSchema>;

const GeneratePayrollReportOutputSchema = z.object({
  report: z.string().describe('The generated payroll report in markdown format.'),
});
export type GeneratePayrollReportOutput = z.infer<typeof GeneratePayrollReportOutputSchema>;

export async function generatePayrollReport(input: GeneratePayrollReportInput): Promise<GeneratePayrollReportOutput> {
  return generatePayrollReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePayrollReportPrompt',
  input: {schema: GeneratePayrollReportInputSchema},
  output: {schema: GeneratePayrollReportOutputSchema},
  tools: [payrollDataTool],
  prompt: `You are an expert in Washington (WA) labor laws.
  Your task is to generate a detailed and accurate payroll report.

  First, use the 'getPayrollData' tool to fetch all necessary data for the period between {{startDate}} and {{endDate}}.

  Then, using the retrieved data, generate a payroll report that includes the following for each employee:
  - Total hours worked on hourly tasks.
  - Total piecework earnings from piecework tasks.
  - A check for WA minimum wage compliance. For each work week, if an employee's total earnings (hourly + piecework) divided by total hours worked is less than the WA minimum wage, calculate the required top-up amount. The current WA minimum wage is $16.28 per hour.
  - Calculation and inclusion of paid break time as required by WA law (a 10-minute paid rest break for every 4 hours worked). The breaks should be paid at the employee's regular rate of pay.
  - Alerts for any missed breaks or potential compliance issues.

  The final report must be in a clean, easy-to-read markdown format. Ensure all calculations are clearly explained.
  
  Structure the report with a main summary, followed by a detailed breakdown for each employee.
`,
});

const generatePayrollReportFlow = ai.defineFlow(
  {
    name: 'generatePayrollReportFlow',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: GeneratePayrollReportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
