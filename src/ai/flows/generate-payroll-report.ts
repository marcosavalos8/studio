
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

const GeneratePayrollReportInputSchema = z.object({
  startDate: z.string().describe('The start date for the payroll report (YYYY-MM-DD).'),
  endDate: z.string().describe('The end date for the payroll report (YYYY-MM-DD).'),
  jsonData: z.string().describe('A JSON string containing all necessary payroll data.'),
});
export type GeneratePayrollReportInput = z.infer<typeof GeneratePayrollReportInputSchema>;

// This internal schema now expects a string for the JSON data.
const PromptInputSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  jsonData: z.string(), // Changed from payrollData to jsonData
});

const GeneratePayrollReportOutputSchema = z.object({
  report: z.string().describe('The generated payroll report in markdown format.'),
});
export type GeneratePayrollReportOutput = z.infer<typeof GeneratePayrollReportOutputSchema>;

export async function generatePayrollReport(input: GeneratePayrollReportInput): Promise<GeneratePayrollReportOutput> {
  return generatePayrollReportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePayrollReportPrompt',
  input: {schema: PromptInputSchema},
  output: {schema: GeneratePayrollReportOutputSchema},
  prompt: `You are an expert in Washington (WA) labor laws.
  Your task is to generate a detailed and accurate payroll report for the period between {{startDate}} and {{endDate}}.

  You have been provided with the following data:
  \`\`\`json
  {{{jsonData}}}
  \`\`\`

  Using this data, generate a payroll report that includes the following for each employee:
  - A summary of total hours worked on hourly tasks and total earnings from those tasks.
  - A summary of total pieces completed for piecework tasks and total earnings from those tasks.
  - A check for WA minimum wage compliance. For each work week, if an employee's total earnings (hourly + piecework) divided by total hours worked is less than the WA minimum wage, calculate the required top-up amount. The current WA minimum wage is $16.28 per hour. A standard work week is Sunday to Saturday.
  - Calculation and inclusion of paid rest breaks as required by WA law (a 10-minute paid rest break for every 4 hours worked). Breaks should be paid at the employee's regular rate of pay, which for piecework is the average hourly rate for the week.
  - Alerts for any missed breaks or potential compliance issues.

  The final report must be in a clean, easy-to-read markdown format. Ensure all calculations are clearly explained.
  
  Structure the report with a main summary for the entire pay period, followed by a detailed breakdown for each employee.
  
  Generate a markdown report based on the provided data.
`,
});

const generatePayrollReportFlow = ai.defineFlow(
  {
    name: 'generatePayrollReportFlow',
    inputSchema: GeneratePayrollReportInputSchema,
    outputSchema: GeneratePayrollReportOutputSchema,
  },
  async input => {
    // Pass the raw JSON string directly to the prompt.
    const {output} = await prompt({
        startDate: input.startDate,
        endDate: input.endDate,
        jsonData: input.jsonData,
    });
    
    if (!output) {
      throw new Error("The AI model did not return a report. There might have been an issue with the model itself.");
    }
    return output;
  }
);
