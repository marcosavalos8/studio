'use server'

import { generatePayrollReport } from "@/ai/flows/generate-payroll-report"
import type { ProcessedPayrollData } from "@/lib/types"

function convertDatesToISOStrings(obj: unknown): unknown {
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(convertDatesToISOStrings)
  if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj as object).reduce((acc, key) => {
      (acc as Record<string, unknown>)[key] = convertDatesToISOStrings((obj as Record<string, unknown>)[key])
      return acc
    }, {} as Record<string, unknown>)
  }
  return obj
}

export async function generateAccountingReportAction(
  startDate: string,
  endDate: string,
  jsonData: string,
): Promise<{ report?: ProcessedPayrollData; error?: string }> {
  try {
    const result = await generatePayrollReport({
      startDate,
      endDate,
      payDate: endDate,
      jsonData,
    })
    return { report: convertDatesToISOStrings(result) as ProcessedPayrollData }
  } catch (e) {
    console.error(e)
    return { error: e instanceof Error ? e.message : 'Failed to generate accounting report.' }
  }
}
