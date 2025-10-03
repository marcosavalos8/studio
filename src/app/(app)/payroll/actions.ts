
'use server'

import { z } from "zod"
import { generatePayrollReport, type ProcessedPayrollData } from "@/ai/flows/generate-payroll-report"

const payrollSchema = z.object({
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  payDate: z.string(),
  jsonData: z.string().min(1, 'JSON data is required'),
})

type PayrollState = {
  report?: ProcessedPayrollData;
  error?: string;
}

// Function to recursively convert Date objects to ISO strings
function convertDatesToISOStrings(obj: any): any {
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertDatesToISOStrings);
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[key] = convertDatesToISOStrings(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}


export async function generateReportAction(prevState: PayrollState, formData: FormData): Promise<PayrollState> {
  const validatedFields = payrollSchema.safeParse({
    dateRange: {
      from: formData.get('from') as string,
      to: formData.get('to') as string,
    },
    payDate: formData.get('payDate') as string,
    jsonData: formData.get('jsonData'),
  });

  if (!validatedFields.success) {
    console.error(validatedFields.error.flatten().fieldErrors);
    return { error: 'Invalid data provided.' };
  }

  const { from, to } = validatedFields.data.dateRange;
  const { payDate, jsonData } = validatedFields.data;

  try {
    const result = await generatePayrollReport({
      startDate: from,
      endDate: to,
      payDate: payDate,
      jsonData: jsonData,
    });
    
    // Ensure all dates are strings before returning to the client
    const serializableResult = convertDatesToISOStrings(result);
    
    return { report: serializableResult };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : 'Failed to generate report. Please try again.';
    return { error: errorMessage };
  }
}
