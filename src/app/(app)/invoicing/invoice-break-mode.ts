import type { DailyBreakdown } from "./page";
import type { WeeklyTaskHours, OvertimeLine } from "@/lib/types";

// Shared by the generation form (Create Record / Print-as-PDF) and the live
// preview (on-screen table + Print/Save when a Labor Report forces the
// server-merged PDF path), so both ever apply this transform the same way.
// "Bill Break Only" zeroes everything except the break charge; "Exclude
// Break" zeroes just the break charge. Neither touches the source object —
// when both are off, the original `data` is returned untouched.
export function applyInvoiceBreakMode<
  T extends {
    dailyBreakdown: DailyBreakdown;
    weeklyHoursByTask?: WeeklyTaskHours;
    overtimeLines?: OvertimeLine[];
    laborCost: number;
    minimumWageTopUp: number;
    paidRestBreaks: number;
    breakHours: number;
    overtimePremium?: number;
    overtimeHours?: number;
    subtotal: number;
    commission: number;
    total: number;
  },
>(
  data: T,
  commissionRate: number | null | undefined,
  breakOnlyMode: boolean,
  excludeBreakMode: boolean,
): T {
  if (!breakOnlyMode && !excludeBreakMode) return data;

  const dailyBreakdown: DailyBreakdown = breakOnlyMode ? {} : data.dailyBreakdown;
  const weeklyHoursByTask = breakOnlyMode ? [] : data.weeklyHoursByTask;
  const overtimeLines = breakOnlyMode ? [] : data.overtimeLines;
  const laborCost = breakOnlyMode ? 0 : data.laborCost;
  const minimumWageTopUp = breakOnlyMode ? 0 : data.minimumWageTopUp;
  const overtimePremium = breakOnlyMode ? 0 : (data.overtimePremium ?? 0);
  const overtimeHours = breakOnlyMode ? 0 : (data.overtimeHours ?? 0);
  const paidRestBreaks = excludeBreakMode ? 0 : data.paidRestBreaks;
  const breakHours = excludeBreakMode ? 0 : data.breakHours;
  const subtotal = laborCost + minimumWageTopUp + paidRestBreaks + overtimePremium;
  // No contractor's fee on a break-only invoice — the contractor already
  // paid their cut on the normal invoice; this one is strictly the break.
  const commission = breakOnlyMode
    ? 0
    : commissionRate
      ? subtotal * (commissionRate / 100)
      : 0;
  const total = subtotal + commission;

  return {
    ...data,
    dailyBreakdown,
    weeklyHoursByTask,
    overtimeLines,
    laborCost,
    minimumWageTopUp,
    overtimePremium,
    overtimeHours,
    paidRestBreaks,
    breakHours,
    subtotal,
    commission,
    total,
  };
}
