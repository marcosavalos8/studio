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
import { getFirestore, collection, getDocs, Timestamp } from 'firebase-admin/firestore';
import {initializeApp, getApps, credential} from 'firebase-admin/app';
import type {TimeEntry, Piecework, Task, Employee, Client} from '@/lib/types';
import { firebaseConfig } from '@/firebase/config';


// Ensure Firebase is initialized for admin access
function getDb() {
  if (getApps().length === 0) {
    try {
        // When running in a managed environment like Firebase App Hosting,
        // this will automatically use the available service account.
        initializeApp();
    } catch(e) {
        console.warn("Default initializeApp failed, trying with config. This is expected in local dev.", e)
        // For local development, you might need to specify credentials.
        initializeApp({
            credential: credential.applicationDefault(),
            projectId: firebaseConfig.projectId,
        });
    }
  }
  return getFirestore();
}

async function getPayrollData(startDate: string, endDate: string) {
  const db = getDb();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const employeesSnap = await db.collection('employees').get();
  const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));

  const tasksSnap = await db.collection('tasks').get();
  const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
  
  const clientsSnap = await db.collection('clients').get();
  const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));

  const timeEntriesQuery = db.collection('time_entries')
    .where('timestamp', '>=', start)
    .where('timestamp', '<=', end);
  const timeEntriesSnap = await timeEntriesQuery.get();
  const timeEntries = timeEntriesSnap.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as Timestamp).toDate(),
        endTime: data.endTime ? (data.endTime as Timestamp).toDate() : null
     } as TimeEntry
  });

  const pieceworkQuery = db.collection('piecework')
      .where('timestamp', '>=', start)
      .where('timestamp', '<=', end);
  const pieceworkSnap = await pieceworkQuery.get();
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
    clients,
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
        try {
            const data = await getPayrollData(startDate, endDate);
            // Return a structured object that's easier for the LLM to parse.
            return {
                summary: `Found ${data.employees.length} employees, ${data.tasks.length} tasks, ${data.clients.length} clients, ${data.timeEntries.length} time entries, and ${data.piecework.length} piecework records.`,
                data: data,
            }
        } catch (e: any) {
            console.error("Error fetching payroll data:", e);
            // Provide a clear error message to the LLM.
            return { error: `Failed to retrieve data from the database. The error was: ${e.message}` };
        }
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

  If the tool returns an error object, you MUST report that error to the user and stop processing.

  Using the retrieved data from the 'data' field of the tool's output, generate a payroll report that includes the following for each employee:
  - A summary of total hours worked on hourly tasks and total earnings from those tasks.
  - A summary of total pieces completed for piecework tasks and total earnings from those tasks.
  - A check for WA minimum wage compliance. For each work week, if an employee's total earnings (hourly + piecework) divided by total hours worked is less than the WA minimum wage, calculate the required top-up amount. The current WA minimum wage is $16.28 per hour. A standard work week is Sunday to Saturday.
  - Calculation and inclusion of paid rest breaks as required by WA law (a 10-minute paid rest break for every 4 hours worked). Breaks should be paid at the employee's regular rate of pay, which for piecework is the average hourly rate for the week.
  - Alerts for any missed breaks or potential compliance issues.

  The final report must be in a clean, easy-to-read markdown format. Ensure all calculations are clearly explained.
  
  Structure the report with a main summary for the entire pay period, followed by a detailed breakdown for each employee.
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
    if (!output) {
      throw new Error("The AI model did not return a report. There might have been an issue with data fetching or the model itself.");
    }
    return output;
  }
);
