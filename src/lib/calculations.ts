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
  minimumWage: number = 19.82
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
 * @param totalHours Total hours worked in the week
 * @param totalEarnings Total earnings from work (before overtime)
 * @param minimumWage Applicable minimum wage (default WA state minimum)
 * @returns Object containing overtime hours and overtime premium pay
 */
export function calculateOvertimePay(
  totalHours: number,
  totalEarnings: number,
  minimumWage: number = 19.82
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
  let regularRate = totalHours > 0 ? totalEarnings / totalHours : 0;

  // If regular rate is below minimum wage, use minimum wage
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
