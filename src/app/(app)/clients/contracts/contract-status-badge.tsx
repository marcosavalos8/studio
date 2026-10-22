import { Badge } from "@/components/ui/badge";
import { FileEdit, CheckCircle2, XCircle, Clock, CircleDot } from "lucide-react";
import type { ContractStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Every status pairs a color with its own icon and text label, so status
// is never conveyed by color alone.
const STATUS_META: Record<
  ContractStatus,
  { label: string; icon: typeof CircleDot; className: string }
> = {
  Draft: {
    label: "Draft",
    icon: FileEdit,
    className: "bg-gray-100 text-gray-700 border-gray-300",
  },
  Active: {
    label: "Active",
    icon: CircleDot,
    className: "bg-green-100 text-green-700 border-green-300",
  },
  Completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-blue-100 text-blue-700 border-blue-300",
  },
  Terminated: {
    label: "Terminated",
    icon: XCircle,
    className: "bg-red-100 text-red-700 border-red-300",
  },
  Expired: {
    label: "Expired",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 border-amber-300",
  },
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}
