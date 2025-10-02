'use server'

import { z } from "zod"
import { generatePayrollReport } from "@/ai/flows/generate-payroll-report"
import { format } from "date-fns"

const payrollSchema = z.object({
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }),
})

type PayrollState = {
  report?: string;
  error?: string;
}

export async function generateReportAction(prevState: PayrollState, formData: FormData): Promise<PayrollState> {
  const validatedFields = payrollSchema.safeParse({
    dateRange: {
      from: new Date(formData.get('from') as string),
      to: new Date(formData.get('to') as string),
    },
  });

  if (!validatedFields.success) {
    return { error: 'Invalid date range provided.' };
  }

  const { from, to } = validatedFields.data.dateRange;

  try {
    const result = await generatePayrollReport({
      startDate: format(from, 'yyyy-MM-dd'),
      endDate: format(to, 'yyyy-MM-dd'),
    });
    return { report: result.report };
  } catch (e) {
    console.error(e);
    return { error: 'Failed to generate report. Please try again.' };
  }
}
