export function calculateHoursWorked(
  startTime: string,
  endTime: string
): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

export function calculateMinimumWageTopUp(
  totalEarnings: number,
  hoursWorked: number,
  minimumWage: number
): number {
  const minimumDue = hoursWorked * minimumWage;
  return Math.max(0, minimumDue - totalEarnings);
}

export function calculateBreakPay(
  hoursWorked: number,
  hourlyRate: number
): number {
  // WA state requires 10 minute paid break every 4 hours
  const breaksRequired = Math.floor(hoursWorked / 4);
  return breaksRequired * (10 / 60) * hourlyRate;
}

/**
 * Calculate overtime hours and premium for a given week
 * 
 * IMPORTANT: According to WA state labor law, totalEarnings should include any
 * minimum wage adjustments that have already been applied. This function
 * calculates the regular rate from the adjusted earnings and ensures it meets
 * the minimum wage floor.
 * 
 * @param totalHours Total hours worked in the week
 * @param totalEarnings Total earnings including minimum wage adjustments (before overtime)
 * @param minimumWage Applicable minimum wage for the client
 * @returns Object containing overtime hours, overtime premium pay, and regular rate used
 * 
 * @example
 * // Scenario: 50 hours, $1200 earnings (above min wage)
 * calculateOvertimePay(50, 1200, 19.82)
 * // Returns: { overtimeHours: 10, overtimePremium: 120, regularRate: 24 }
 * 
 * @example
 * // Scenario: 50 hours, $991 earnings (already adjusted to min wage)
 * calculateOvertimePay(50, 991, 19.82)
 * // Returns: { overtimeHours: 10, overtimePremium: 99.10, regularRate: 19.82 }
 */
export function calculateOvertimePay(
  totalHours: number,
  totalEarnings: number,
  minimumWage: number
): {
  overtimeHours: number;
  overtimePremium: number;
  regularRate: number;
} {
  // No overtime if total hours <= 40
  if (totalHours <= 40) {
    return {
      overtimeHours: 0,
      overtimePremium: 0,
      regularRate: totalHours > 0 ? totalEarnings / totalHours : 0,
    };
  }

  // Calculate overtime hours (hours over 40)
  const overtimeHours = totalHours - 40;

  // Calculate regular rate (total earnings / total hours)
  // Note: totalEarnings should already include minimum wage adjustments
  let regularRate = totalHours > 0 ? totalEarnings / totalHours : 0;

  // Safety check: If regular rate is somehow below minimum wage, use minimum wage
  // This should rarely happen if minimum wage adjustments were properly applied earlier
  if (regularRate < minimumWage) {
    regularRate = minimumWage;
  }

  // Overtime premium is 0.5x (half) the regular rate for overtime hours
  // Note: This is the ADDITIONAL pay, not the full 1.5x
  const overtimePremium = regularRate * 0.5 * overtimeHours;

  return {
    overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    overtimePremium: parseFloat(overtimePremium.toFixed(2)),
    regularRate: parseFloat(regularRate.toFixed(2)),
  };
}
