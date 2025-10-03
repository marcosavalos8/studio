
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

const payrollDataTool = ai.defineTool(
    {
        name: 'getPayrollData',
        description: 'Receives payroll data from the client to be processed.',
        inputSchema: z.object({
            jsonData: z.string().describe('A JSON string containing employees, tasks, clients, time entries, and piecework records.'),
        }),
        outputSchema: z.any(),
    },
    async ({jsonData}) => {
        try {
            const data = JSON.parse(jsonData);
            return {
                summary: `Received data for ${data.employees.length} employees, ${data.tasks.length} tasks, ${data.clients.length} clients, ${data.timeEntries.length} time entries, and ${data.piecework.length} piecework records.`,
                data: data,
            }
        } catch (e: any) {
            console.error("Error parsing payroll data:", e);
            return { error: `Failed to parse data from the client. The error was: ${e.message}` };
        }
    }
);


const GeneratePayrollReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the payroll report (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date for the payroll report (YYYY-MM-DD).'),
  jsonData: z.string().describe('A JSON string containing all necessary payroll data.'),
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

  First, use the 'getPayrollData' tool to process the provided JSON data for the period between {{startDate}} and {{endDate}}. The 'jsonData' field in your tool call should be the 'jsonData' from the input.

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
