"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Loader2,
  Search,
  CheckCircle2,
} from "lucide-react";
import { cn, toLocalMidnight, parseLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import type { DateRange } from "react-day-picker";
import type {
  Employee,
  Task,
  Client,
  ProcessedPayrollData,
  WeeklySummary,
  AccountingCompletion,
} from "@/lib/types";
import { generateAccountingReportAction } from "./actions";

// ── helpers ─────────────────────────────────────────────────────────────────

function getUserName(): string {
  if (typeof window === "undefined") return "unknown";
  return localStorage.getItem("username") || "unknown";
}

interface PriceGroup {
  rateType: "piece" | "hourly";
  price: number;
  totalPieces: number;
  totalHours: number;
  subtotal: number;
}

function buildPriceGroups(weeklySummaries: WeeklySummary[]): PriceGroup[] {
  // key: "piece|4.50" or "hourly|16.00"
  const byKey = new Map<string, PriceGroup>();
  for (const week of weeklySummaries) {
    for (const item of week.piecesByVariety ?? []) {
      const rateType = item.rateType ?? "piece";
      const price = item.price ?? 0;
      const key = `${rateType}|${price}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.totalPieces += item.totalPieces ?? 0;
        existing.totalHours += item.totalHours ?? 0;
        existing.subtotal = parseFloat(
          (rateType === "piece"
            ? existing.totalPieces * price
            : existing.totalHours * price
          ).toFixed(2)
        );
      } else {
        const totalPieces = item.totalPieces ?? 0;
        const totalHours = item.totalHours ?? 0;
        byKey.set(key, {
          rateType,
          price,
          totalPieces,
          totalHours,
          subtotal: parseFloat(
            (rateType === "piece" ? totalPieces * price : totalHours * price).toFixed(2)
          ),
        });
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    if (a.rateType !== b.rateType) return a.rateType === "piece" ? -1 : 1;
    return a.price - b.price;
  });
}

// ── Left panel: Summary & Adjustments (per week) ─────────────────────────────

// Fuerza override del padding de ShadCN TableCell con !important
const td = "!py-[3px] !px-2.5 text-[11px] leading-none";
const tdr = "!py-[3px] !px-2.5 text-[11px] leading-none text-right";

function WeeklySummaryTable({ week }: { week: WeeklySummary }) {
  const hasOT = (week.overtimeHours ?? 0) > 0;

  return (
    <Card className="shadow-none border border-border/60">
      <CardHeader className="!py-3 !px-6 bg-muted/40 border-b">
        <CardTitle className="text-[10px] font-semibold text-foreground uppercase tracking-wide leading-none">
          Week {week.weekNumber}, {week.year} — Summary &amp; Adjustments
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2} className={td}>
                Total Hours Worked
              </TableCell>
              <TableCell colSpan={2} className={`${tdr} font-medium`}>
                {week.totalHours.toFixed(2)}
              </TableCell>
            </TableRow>

            {(week.totalPieces ?? 0) > 0 && (
              <>
                <TableRow className="bg-indigo-50 dark:bg-indigo-900/20">
                  <TableCell
                    className={`${td} font-semibold text-indigo-700 dark:text-indigo-300`}
                  >
                    Total Pieces Worked
                  </TableCell>
                  <TableCell className="!py-[3px] !px-2.5 text-[10px] leading-none text-right text-muted-foreground font-semibold uppercase tracking-wide">
                    Pieces
                  </TableCell>
                  <TableCell className="!py-[3px] !px-2.5 text-[10px] leading-none text-right text-muted-foreground font-semibold uppercase tracking-wide">
                    Price
                  </TableCell>
                  <TableCell className="!py-[3px] !px-2.5 text-[10px] leading-none text-right text-muted-foreground font-semibold uppercase tracking-wide">
                    Total
                  </TableCell>
                </TableRow>
                {(week.piecesByVariety ?? []).map((item, idx) => (
                  <TableRow
                    key={idx}
                    className="bg-indigo-50/40 dark:bg-indigo-900/10"
                  >
                    <TableCell className={`${td} !pl-5 text-muted-foreground`}>
                      {item.taskName} — {item.variety}
                      {item.isMissingBuckets && (
                        <span className="ml-1 text-[10px] font-semibold text-red-500">
                          {" "}– Missing Buckets
                          {item.originalDate ? ` (${format(parseLocalDate(item.originalDate), "MM/dd/yyyy")})` : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`${tdr} text-indigo-700 dark:text-indigo-300`}
                    >
                      {item.totalPieces.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`${tdr} text-indigo-700 dark:text-indigo-300`}
                    >
                      ${(item.price ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`${tdr} font-semibold text-indigo-700 dark:text-indigo-300`}
                    >
                      ${(item.totalPieces * (item.price ?? 0)).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}

            <TableRow>
              <TableCell colSpan={2} className={td}>
                Raw Task Earnings
              </TableCell>
              <TableCell colSpan={2} className={tdr}>
                ${week.totalEarnings.toFixed(2)}
              </TableCell>
            </TableRow>
            {week.paidRestBreaks > 0 && (
              <TableRow>
                <TableCell colSpan={2} className={td}>
                  Paid Rest Breaks (10min / 4hr)
                </TableCell>
                <TableCell colSpan={2} className={`${tdr} text-blue-600`}>
                  + ${week.paidRestBreaks.toFixed(2)}
                </TableCell>
              </TableRow>
            )}
            {week.minimumWageTopUp > 0 && (
              <TableRow>
                <TableCell colSpan={2} className={td}>
                  Minimum Wage Top-Up
                </TableCell>
                <TableCell colSpan={2} className={`${tdr} text-amber-600`}>
                  + ${week.minimumWageTopUp.toFixed(2)}
                </TableCell>
              </TableRow>
            )}
            {hasOT && (
              <>
                <TableRow className="bg-purple-50 dark:bg-purple-900/20">
                  <TableCell colSpan={2} className={`${td} font-medium`}>
                    Overtime Hours (over 40/week)
                  </TableCell>
                  <TableCell colSpan={2} className={`${tdr} text-purple-600 font-medium`}>
                    {(week.overtimeHours ?? 0).toFixed(2)} hrs
                  </TableCell>
                </TableRow>
                <TableRow className="bg-purple-50 dark:bg-purple-900/20">
                  <TableCell colSpan={2} className={`${td} font-medium`}>
                    Regular Rate for OT Calculation
                  </TableCell>
                  <TableCell colSpan={2} className={`${tdr} text-purple-600 font-medium`}>
                    ${(week.regularRate ?? 0).toFixed(2)}/hr
                  </TableCell>
                </TableRow>
                <TableRow className="bg-purple-50 dark:bg-purple-900/20">
                  <TableCell colSpan={2} className={`${td} font-medium`}>
                    Overtime Premium (0.5x rate)
                  </TableCell>
                  <TableCell colSpan={2} className={`${tdr} text-purple-600 font-medium`}>
                    + ${(week.overtimePremium ?? 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              </>
            )}
            {(week.sickHoursAccrued ?? 0) > 0 && (
              <TableRow className="bg-green-50 dark:bg-green-900/20">
                <TableCell colSpan={2} className={`${td} font-medium`}>
                  Sick Hours Accrued (1hr / 40hrs)
                </TableCell>
                <TableCell
                  colSpan={2}
                  className={`${tdr} text-green-600 font-medium`}
                >
                  + {week.sickHoursAccrued!.toFixed(2)} hrs
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className={`${td} font-semibold`}>
                Total Weekly Pay
              </TableCell>
              <TableCell colSpan={2} className={`${tdr} font-semibold`}>
                ${week.finalPay.toFixed(2)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Right panel: Accounting summary card ─────────────────────────────────────

function AccountingSummaryCard({
  weeklySummaries,
  finalPay,
  totalSickHoursAccrued,
  isCompleted,
  isToggling,
  employeeId,
  completionDocId,
  onToggleCompleted,
}: {
  weeklySummaries: WeeklySummary[];
  finalPay: number;
  totalSickHoursAccrued?: number;
  isCompleted: boolean;
  isToggling: boolean;
  employeeId: string;
  completionDocId: string | undefined;
  onToggleCompleted: (
    workerId: string,
    completionDocId: string | undefined,
  ) => Promise<void>;
}) {
  const groups = buildPriceGroups(weeklySummaries);
  const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const paidRestBreaks = weeklySummaries.reduce((s, w) => s + w.paidRestBreaks, 0);
  const minimumWageTopUp = weeklySummaries.reduce((s, w) => s + w.minimumWageTopUp, 0);
  const totalWeeklyPay = subtotal + paidRestBreaks + minimumWageTopUp;

  return (
    <div className="space-y-2">
      {/* Accounting summary card */}
      <Card className="overflow-hidden shadow-sm">
        {/* Header */}
        <div className="bg-emerald-700 dark:bg-emerald-800 px-3 py-2">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wide">
            Work Summary by Rate
          </h4>
        </div>

        {groups.length > 0 ? (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-4 bg-emerald-600/10 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800">
              <div className="px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                Type
              </div>
              <div className="px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide text-right">
                Price
              </div>
              <div className="px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide text-right">
                Quantity
              </div>
              <div className="px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide text-right">
                Subtotal
              </div>
            </div>

            {/* Rows */}
            {groups.map((g, idx) => (
              <div
                key={idx}
                className={cn(
                  "grid grid-cols-4 border-b border-border/40 last:border-0",
                  idx % 2 === 0 ? "bg-background" : "bg-muted/30",
                )}
              >
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                  {g.rateType === "piece" ? "Piecework" : "Hourly"}
                </div>
                <div className="px-3 py-1 text-xs text-right text-muted-foreground">
                  ${g.price.toFixed(2)}
                </div>
                <div className="px-3 py-1 text-xs font-medium text-right">
                  {g.rateType === "piece"
                    ? `${g.totalPieces.toFixed(2)} pcs`
                    : `${g.totalHours.toFixed(2)} hrs`}
                </div>
                <div className="px-3 py-1 text-xs font-semibold text-right">
                  ${g.subtotal.toFixed(2)}
                </div>
              </div>
            ))}

            {/* Footer rows */}
            <div className="border-t border-border bg-muted/20">
              <div className="grid grid-cols-2 px-3 py-1 border-b border-border/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Subtotal
                </span>
                <span className="text-xs font-semibold text-right">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              {paidRestBreaks > 0 && (
                <div className="grid grid-cols-2 px-3 py-1 border-b border-border/40">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Paid Rest Breaks
                  </span>
                  <span className="text-xs text-right text-blue-600">
                    + ${paidRestBreaks.toFixed(2)}
                  </span>
                </div>
              )}
              {minimumWageTopUp > 0 && (
                <div className="grid grid-cols-2 px-3 py-1 border-b border-border/40">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Minimum Wage Top-Up
                  </span>
                  <span className="text-xs text-right text-amber-600">
                    + ${minimumWageTopUp.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Total Weekly Pay — secondary figure */}
            <div className="bg-emerald-700/80 dark:bg-emerald-800/80 px-3 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-200 uppercase tracking-widest">
                  Total Weekly Pay
                </span>
                <span className="text-sm font-semibold text-white/90">
                  ${totalWeeklyPay.toFixed(2)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            No piecework data for this period.
          </div>
        )}
      </Card>

      {/* Period Final Pay — figura principal, siempre visible */}
      <Card className="border-2 border-primary/40 shadow-sm bg-primary/5 dark:bg-primary/10">
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Period Final Pay
            </span>
            <span className="text-2xl font-bold text-primary tabular-nums">
              ${finalPay.toFixed(2)}
            </span>
          </div>
          {(totalSickHoursAccrued ?? 0) > 0 && (
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/40">
              <span className="text-[10px] text-muted-foreground">Sick Hours Accrued</span>
              <span className="text-[10px] text-green-600 font-medium">+ {totalSickHoursAccrued!.toFixed(2)} hrs</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark as Completed */}
      <Card
        className={cn(
          "shadow-none transition-colors duration-200",
          isCompleted
            ? "border-2 border-green-400 bg-green-50 dark:bg-green-950/30 dark:border-green-600"
            : "border border-dashed border-border/80",
        )}
      >
        <CardContent className="p-0">
          <label
            htmlFor={`complete-${employeeId}`}
            className={cn(
              "flex items-center justify-center gap-3 py-3.5 px-4 cursor-pointer select-none w-full",
              isToggling && "opacity-50 cursor-not-allowed",
            )}
          >
            {isToggling ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground flex-shrink-0" />
            ) : (
              <Checkbox
                id={`complete-${employeeId}`}
                checked={isCompleted}
                disabled={isToggling}
                onCheckedChange={() =>
                  onToggleCompleted(employeeId, completionDocId)
                }
                className={cn(
                  "h-6 w-6 flex-shrink-0 rounded",
                  isCompleted
                    ? "border-green-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    : "border-2 border-muted-foreground/50",
                )}
              />
            )}
            <span
              className={cn(
                "text-sm font-semibold leading-none",
                isCompleted
                  ? "text-green-700 dark:text-green-400"
                  : "text-foreground",
              )}
            >
              {isCompleted ? "Marked as Completed" : "Mark as Completed"}
            </span>
            {isCompleted && (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 flex-shrink-0" />
            )}
          </label>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Worker accordion item ─────────────────────────────────────────────────────

interface WorkerAccordionItemProps {
  employeeSummary: ProcessedPayrollData["employeeSummaries"][0];
  isCompleted: boolean;
  completionDocId: string | undefined;
  onToggleCompleted: (
    workerId: string,
    completionDocId: string | undefined,
  ) => Promise<void>;
  isToggling: boolean;
}

function WorkerAccordionItem({
  employeeSummary,
  isCompleted,
  completionDocId,
  onToggleCompleted,
  isToggling,
}: WorkerAccordionItemProps) {
  return (
    <AccordionItem
      value={employeeSummary.employeeId}
      className={cn(
        "rounded-lg border mb-2 overflow-hidden shadow-sm transition-colors",
        isCompleted
          ? "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/10"
          : "border-border bg-card",
      )}
    >
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/40 transition-colors [&[data-state=open]]:border-b [&[data-state=open]]:border-border">
        <div className="flex items-center justify-between w-full pr-3 gap-4">
          {/* Left: name + status */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
                isCompleted
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-primary/10 text-primary",
              )}
            >
              {employeeSummary.employeeName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-semibold truncate">
                {employeeSummary.employeeName}
              </span>
              <span className="text-xs text-muted-foreground">
                {employeeSummary.weeklySummaries.length} week
                {employeeSummary.weeklySummaries.length !== 1 ? "s" : ""}
              </span>
            </div>
            {isCompleted && (
              <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 flex-shrink-0 hidden sm:flex">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
          </div>

          {/* Right: final pay */}
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-muted-foreground">Final Pay</div>
            <div
              className={cn(
                "text-base font-bold",
                isCompleted
                  ? "text-green-700 dark:text-green-400"
                  : "text-primary",
              )}
            >
              ${employeeSummary.finalPay.toFixed(2)}
            </div>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="p-0">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-0">
          {/* ── Left column: payroll detail ─────────────────────────── */}
          <div className="lg:col-span-2 p-3 space-y-3 border-r border-border/50">
            {employeeSummary.weeklySummaries.map((week) => (
              <WeeklySummaryTable
                key={`${week.weekNumber}-${week.year}`}
                week={week}
              />
            ))}
          </div>

          {/* ── Right column: accounting summary (sticky) ────────────── */}
          <div className="lg:col-span-1 p-3 bg-muted/20 dark:bg-muted/10">
            <div className="sticky top-4">
              <AccountingSummaryCard
                weeklySummaries={employeeSummary.weeklySummaries}
                finalPay={employeeSummary.finalPay}
                totalSickHoursAccrued={employeeSummary.totalSickHoursAccrued}
                isCompleted={isCompleted}
                isToggling={isToggling}
                employeeId={employeeSummary.employeeId}
                completionDocId={completionDocId}
                onToggleCompleted={onToggleCompleted}
              />
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AccountingCenterClient() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [date, setDate] = React.useState<DateRange | undefined>();
  const [isFetchingData, setIsFetchingData] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [reportData, setReportData] =
    React.useState<ProcessedPayrollData | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  const [completions, setCompletions] = React.useState<
    Map<string, AccountingCompletion & { docId: string }>
  >(new Map());
  const [togglingIds, setTogglingIds] = React.useState<Set<string>>(new Set());
  const [openItems, setOpenItems] = React.useState<string[]>([]);

  // ── Fetch data & generate report ─────────────────────────────────────────
  React.useEffect(() => {
    if (!date?.from || !date?.to || !firestore) {
      setReportData(null);
      setCompletions(new Map());
      setSearchQuery("");
      setOpenItems([]);
      return;
    }

    const run = async () => {
      setIsFetchingData(true);
      setReportData(null);
      try {
        const start = new Date(date.from!);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date.to!);
        end.setHours(23, 59, 59, 999);

        const startStr = format(date.from!, "yyyy-MM-dd");
        const endStr = format(date.to!, "yyyy-MM-dd");

        const [
          employeesSnap,
          tasksSnap,
          clientsSnap,
          timeEntriesSnap,
          pieceworkSnap,
        ] = await Promise.all([
          getDocs(collection(firestore, "employees")),
          getDocs(collection(firestore, "tasks")),
          getDocs(collection(firestore, "clients")),
          getDocs(
            query(
              collection(firestore, "time_entries"),
              where("timestamp", ">=", Timestamp.fromDate(start)),
              where("timestamp", "<=", Timestamp.fromDate(end)),
            ),
          ),
          getDocs(
            query(
              collection(firestore, "piecework"),
              where("timestamp", ">=", Timestamp.fromDate(start)),
              where("timestamp", "<=", Timestamp.fromDate(end)),
            ),
          ),
        ]);

        const allEmployees = employeesSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Employee,
        );
        const tasks = tasksSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Task,
        );
        const clients = clientsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Client,
        );

        const timeEntries = timeEntriesSnap.docs.map((d) => {
          const data = d.data();
          const ts = (data.timestamp as Timestamp)?.toDate();
          const et = (data.endTime as Timestamp)?.toDate();
          return {
            ...data,
            id: d.id,
            timestamp: ts ? format(ts, "yyyy-MM-dd'T'HH:mm:ss") : null,
            endTime: et ? format(et, "yyyy-MM-dd'T'HH:mm:ss") : null,
          };
        });

        const piecework = pieceworkSnap.docs.map((d) => {
          const data = d.data();
          const ts = (data.timestamp as Timestamp)?.toDate();
          return {
            ...data,
            id: d.id,
            timestamp: ts ? format(ts, "yyyy-MM-dd'T'HH:mm:ss") : null,
          };
        });

        const jsonData = JSON.stringify({
          employees: allEmployees,
          tasks,
          clients,
          timeEntries,
          piecework,
        });

        setIsFetchingData(false);
        setIsGenerating(true);

        const { report, error } = await generateAccountingReportAction(
          startStr,
          endStr,
          jsonData,
        );

        if (error || !report) {
          toast({
            variant: "destructive",
            title: "Error",
            description: error ?? "Unknown error",
          });
          return;
        }

        setReportData(report);
        setSearchQuery("");
        setOpenItems([]);

        const completionsSnap = await getDocs(
          query(
            collection(firestore, "accounting_completions"),
            where("periodStart", "==", startStr),
            where("periodEnd", "==", endStr),
          ),
        );
        const newCompletions = new Map<
          string,
          AccountingCompletion & { docId: string }
        >();
        completionsSnap.docs.forEach((d) => {
          const data = d.data() as AccountingCompletion;
          newCompletions.set(data.workerId, { ...data, docId: d.id });
        });
        setCompletions(newCompletions);
      } catch (e) {
        console.error(e);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load accounting data.",
        });
      } finally {
        setIsFetchingData(false);
        setIsGenerating(false);
      }
    };

    run();
  }, [date, firestore, toast]);

  // ── Toggle completed ──────────────────────────────────────────────────────
  const handleToggleCompleted = async (
    workerId: string,
    completionDocId: string | undefined,
  ) => {
    if (!firestore || !date?.from || !date?.to) return;
    setTogglingIds((prev) => new Set(prev).add(workerId));

    const startStr = format(date.from!, "yyyy-MM-dd");
    const endStr = format(date.to!, "yyyy-MM-dd");

    try {
      if (completionDocId) {
        await deleteDoc(
          doc(firestore, "accounting_completions", completionDocId),
        );
        setCompletions((prev) => {
          const next = new Map(prev);
          next.delete(workerId);
          return next;
        });
      } else {
        const newDoc: Omit<AccountingCompletion, "id"> = {
          workerId,
          periodStart: startStr,
          periodEnd: endStr,
          completedAt: Timestamp.now(),
          completedBy: getUserName(),
        };
        const ref = await addDoc(
          collection(firestore, "accounting_completions"),
          newDoc,
        );
        setCompletions((prev) =>
          new Map(prev).set(workerId, { ...newDoc, docId: ref.id }),
        );
        setOpenItems((prev) => prev.filter((id) => id !== workerId));
      }
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not update completion status.",
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(workerId);
        return next;
      });
    }
  };

  const isLoading = isFetchingData || isGenerating;

  // ── Render ────────────────────────────────────────────────────────────────

  const sorted = reportData
    ? [...reportData.employeeSummaries].sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName),
      )
    : [];
  const filtered = searchQuery.trim()
    ? sorted.filter((emp) =>
        emp.employeeName
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase()),
      )
    : sorted;
  const pending = sorted.filter((e) => !completions.has(e.employeeId)).length;
  const completed = sorted.length - pending;

  return (
    <div className="space-y-3">
      {/* ── Toolbar: date picker + stats + search (all left, single row) ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 justify-start text-left font-normal text-sm",
                !date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} –{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={(newDate) => {
                if (newDate?.from) {
                  setDate({
                    from: toLocalMidnight(newDate.from),
                    to: toLocalMidnight(newDate.to),
                  });
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Loading or stats + search */}
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">
              {isFetchingData ? "Fetching…" : "Generating…"}
            </span>
          </div>
        ) : reportData ? (
          <>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {sorted.length} worker{sorted.length !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full px-2 py-0.5 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {pending} pending
            </span>
            {completed > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full px-2 py-0.5 whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3" />
                {completed} done
              </span>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-sm w-48"
              />
            </div>
          </>
        ) : null}
      </div>

      {/* ── Worker list ──────────────────────────────────────────────────── */}
      {reportData &&
        !isLoading &&
        (() => {
          return (
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No workers match &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                <Accordion
                  type="multiple"
                  value={openItems}
                  onValueChange={setOpenItems}
                  className="w-full space-y-0"
                >
                  {filtered.map((emp) => {
                    const completion = completions.get(emp.employeeId);
                    return (
                      <WorkerAccordionItem
                        key={emp.employeeId}
                        employeeSummary={emp}
                        isCompleted={!!completion}
                        completionDocId={completion?.docId}
                        onToggleCompleted={handleToggleCompleted}
                        isToggling={togglingIds.has(emp.employeeId)}
                      />
                    );
                  })}
                </Accordion>
              )}
            </div>
          );
        })()}

      {!isLoading && !reportData && date?.from && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            No worker activity found for the selected date range.
          </p>
        </div>
      )}
    </div>
  );
}
