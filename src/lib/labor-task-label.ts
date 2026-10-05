import type { Task } from "@/lib/types";

// Labor report columns group tasks with the same name and rate. The rate is part
// of the label so columns with the same name but different prices stay separate;
// the legend shows it while the column headers keep their letters.
export function laborTaskLabel(tasks: Task[], taskId: string, taskName: string): string {
  const task = tasks.find((t) => t.id === taskId);
  const rate = !task
    ? 0
    : task.clientRateType === "hourly"
      ? task.clientRate
      : task.clientRate || task.piecePrice || 0;
  return `${taskName} · $${(rate ?? 0).toFixed(2)}`;
}
