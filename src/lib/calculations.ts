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
  minimumWage: number = 16.28
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
