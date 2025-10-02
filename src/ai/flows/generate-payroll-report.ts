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
  prompt: `You are an expert in Washington (WA) labor laws.
  Generate a payroll report for the period between {{startDate}} and {{endDate}}.
  The report should include:
  - Total hours worked by each employee.
  - Total piecework earnings for each employee.
  - Adjustments for WA minimum wage compliance, if applicable.
  - Calculation and inclusion of paid breaks as required by WA law (10-minute paid break for every 4 hours worked).
  - Alerts for any missed breaks.
  The final report should be in markdown format.
  Ensure all calculations comply with WA labor laws regarding minimum wage and break times.
  Consider that if the total earned from piecework is less than what they would have earned at minimum wage, they are entitled to the difference.
  The report should be easy to read and understand, with clear labels for each section.
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
