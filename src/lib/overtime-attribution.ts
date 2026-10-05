import type { OvertimeLine, WeeklySummary } from "@/lib/types";

export type WeekTaskCandidate = {
  taskId: string;
  taskName: string;
  rateType: "piece" | "hourly";
  clientId: string;
  hours: number;
};

// override: undefined = no saved decision (use the automatic chronological split),
// null = not billed to any client, string = billed entirely to that client.
export function clientOvertimeForWeek(
  week: WeeklySummary,
  clientId: string,
  clientName: string,
  override: string | null | undefined,
  candidates: WeekTaskCandidate[],
): { hours: number; premium: number; lines: OvertimeLine[] } {
  const none = { hours: 0, premium: 0, lines: [] as OvertimeLine[] };

  if (override === undefined) {
    const lines = (week.overtimeByTask ?? [])
      .filter((line) => line.clientId === clientId)
      .map((line) => ({ ...line }));
    return {
      hours: lines.reduce((acc, line) => acc + line.overtimeHours, 0),
      premium: lines.reduce((acc, line) => acc + line.overtimePremium, 0),
      lines,
    };
  }

  if (override === null || override !== clientId) return none;

  const hours = week.overtimeHours ?? 0;
  const premium = week.overtimePremium ?? 0;
  if (hours <= 0) return none;

  const mainTask = candidates
    .filter((c) => c.clientId === clientId)
    .sort((a, b) => b.hours - a.hours)[0];
  if (!mainTask) return none;

  return {
    hours,
    premium,
    lines: [
      {
        clientId,
        clientName,
        taskId: mainTask.taskId,
        taskName: mainTask.taskName,
        rateType: mainTask.rateType,
        overtimeHours: hours,
        overtimePremium: premium,
      },
    ],
  };
}
