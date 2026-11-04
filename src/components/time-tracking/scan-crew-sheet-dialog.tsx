"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, Loader2, AlertTriangle, ScanLine, UserPlus } from "lucide-react";
import type { Employee } from "@/lib/types";
import type { WithId } from "@/firebase/firestore/use-collection";
import {
  bestNameMatch,
  MATCH_THRESHOLD_EXACT,
  MATCH_THRESHOLD_FUZZY,
} from "@/lib/fuzzy-match";
import type { ParsedCrewSheetRow } from "@/lib/ocr-crew-sheet";
import { AddEmployeeDialog } from "@/app/(app)/employees/add-employee-dialog";
import { clockOutFromHours } from "@/lib/entry-hours";

type MatchStatus = "matched" | "suggested" | "unmatched";

export type ScannedEmployeeEntry = {
  employee: Employee;
  pieces: string;
  clockIn?: string;
  clockOut?: string;
  hours?: string;
  lunchIn?: string;
  lunchBreak?: boolean;
  // Carried into the main Past Records list so a "suggested" (yellow) match
  // stays visibly flagged for a second look even after it's been added,
  // instead of losing all trace of needing review the moment it leaves
  // this dialog. Never "matched" — a confident match needs no flag, so
  // handleConfirm below always maps that case to undefined instead.
  scanStatus?: Exclude<MatchStatus, "matched">;
};

type ReviewRow = {
  id: string;
  sheetName: string;
  matchStatus: MatchStatus;
  employeeId: string; // "" when nothing picked yet
  included: boolean;
  start: string;
  end: string;
  lunchIn: string;
  hours: string;
  bins: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  onConfirm: (entries: ScannedEmployeeEntry[]) => void;
  // Same values "Add employee"/"Load Crew" already pre-fill every new Past
  // Records row with — Clock In/Lunch In here come from these, same as
  // everywhere else a worker enters the list, never from the sheet itself.
  defaultClockIn?: string;
  defaultLunchIn?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_STYLES: Record<MatchStatus, string> = {
  matched: "border-l-4 border-l-green-500 bg-green-50/50",
  suggested: "border-l-4 border-l-amber-500 bg-amber-50/50",
  unmatched: "border-l-4 border-l-red-500 bg-red-50/50",
};

export function ScanCrewSheetDialog({
  open,
  onOpenChange,
  employees,
  onConfirm,
  defaultClockIn,
  defaultLunchIn,
}: Props) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<"upload" | "processing" | "review">(
    "upload",
  );
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  // A worker created right here (via "Add as new employee" on an unmatched
  // row) needs to be selectable immediately, before the live employees
  // list this dialog was handed has necessarily caught up — merged into
  // every lookup below right alongside it.
  const [locallyCreatedEmployees, setLocallyCreatedEmployees] = React.useState<
    WithId<Employee>[]
  >([]);
  const [addEmployeeFor, setAddEmployeeFor] = React.useState<{
    rowId: string;
    name: string;
  } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setStep("upload");
      setRows([]);
      setError(null);
      setLocallyCreatedEmployees([]);
      setAddEmployeeFor(null);
    }
  }, [open]);

  const allEmployees = React.useMemo(
    () => [...employees, ...locallyCreatedEmployees],
    [employees, locallyCreatedEmployees],
  );
  const employeesById = React.useMemo(
    () => new Map(allEmployees.map((e) => [e.id, e])),
    [allEmployees],
  );
  const sortedEmployees = React.useMemo(
    () => [...allEmployees].sort((a, b) => a.name.localeCompare(b.name)),
    [allEmployees],
  );

  const handleFile = async (file: File) => {
    setStep("processing");
    setError(null);
    try {
      const dataUrl = await fileToBase64(file);
      const res = await fetch("/api/ocr/scan-crew-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to scan the sheet.");
      }
      if (!data.headerFound) {
        setError(
          "Couldn't find the sheet's column headers (Employee Name / Start / Hours...). Make sure the photo shows the full table clearly and isn't too blurry.",
        );
        setStep("upload");
        return;
      }
      const parsedRows = (data.rows ?? []) as ParsedCrewSheetRow[];
      if (parsedRows.length === 0) {
        setError("No worker rows were found in this photo.");
        setStep("upload");
        return;
      }
      const candidates = employees.map((e) => ({ id: e.id, name: e.name }));
      const built: ReviewRow[] = parsedRows.map((parsed, idx) => {
        const { best } = bestNameMatch(parsed.name, candidates);
        const matchStatus: MatchStatus =
          best && best.score >= MATCH_THRESHOLD_EXACT
            ? "matched"
            : best && best.score >= MATCH_THRESHOLD_FUZZY
              ? "suggested"
              : "unmatched";
        const hours = parsed.hours ?? "";
        const hoursNum = parseFloat(hours);
        const end =
          defaultClockIn && Number.isFinite(hoursNum)
            ? (clockOutFromHours(defaultClockIn, hoursNum, !!defaultLunchIn) ?? "")
            : "";
        return {
          id: `${idx}-${parsed.name}`,
          sheetName: parsed.name,
          matchStatus,
          employeeId: matchStatus === "unmatched" ? "" : (best?.candidateId ?? ""),
          included: matchStatus !== "unmatched",
          start: defaultClockIn ?? "",
          end,
          lunchIn: defaultLunchIn ?? "",
          hours,
          bins: parsed.bins ?? "",
        };
      });
      setRows(built);
      setStep("review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong reading this photo.",
      );
      setStep("upload");
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const counts = React.useMemo(() => {
    const matched = rows.filter((r) => r.matchStatus === "matched").length;
    const suggested = rows.filter((r) => r.matchStatus === "suggested").length;
    const unmatched = rows.filter((r) => r.matchStatus === "unmatched").length;
    return { matched, suggested, unmatched };
  }, [rows]);

  // Dynamic sanity-check totals from the spec: a running sum of whatever is
  // currently in each included card's Hours/Bins fields (editable, so this
  // updates live as rows are fixed, toggled, or added) — the user glances
  // at this against the sheet's own handwritten "Total Hours"/"Total Bins"
  // line at the bottom of the paper to confirm nothing was missed, rather
  // than the app re-reading that handwritten total itself (no more
  // reliable than the per-worker digits it's already struggling with).
  const totals = React.useMemo(() => {
    const included = rows.filter((r) => r.included);
    const sum = (values: string[]) =>
      values.reduce((acc, v) => {
        const n = parseFloat(v);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
    return {
      hours: sum(included.map((r) => r.hours)),
      bins: sum(included.map((r) => r.bins)),
    };
  }, [rows]);

  // Never blocks the whole batch over a couple of unresolved rows — adds
  // every row that's ready now (into the same editable list "Add employee"
  // already fills, so any of them can still be fixed by hand afterward) and
  // tells the user which ones it skipped and why, instead of making them
  // fix everything inside this dialog before they can add anything at all.
  const handleConfirm = () => {
    const toAdd = rows.filter((r) => r.included);
    const seen = new Set<string>();
    const addedIds = new Set<string>();
    const skippedNames: string[] = [];
    const entries: ScannedEmployeeEntry[] = [];

    for (const r of toAdd) {
      const employee = r.employeeId ? employeesById.get(r.employeeId) : undefined;
      if (!employee || seen.has(r.employeeId)) {
        skippedNames.push(r.sheetName);
        continue;
      }
      seen.add(r.employeeId);
      addedIds.add(r.id);
      entries.push({
        employee,
        pieces: r.bins,
        clockIn: r.start,
        clockOut: r.end,
        hours: r.hours,
        lunchIn: r.lunchIn,
        lunchBreak: r.lunchIn ? true : undefined,
        scanStatus: r.matchStatus === "matched" ? undefined : r.matchStatus,
      });
    }

    if (entries.length > 0) {
      onConfirm(entries);
    }
    if (skippedNames.length === 0) {
      onOpenChange(false);
      toast({
        title: "Sheet scanned",
        description: `${entries.length} worker${entries.length === 1 ? "" : "s"} added — review their hours before saving.`,
      });
      return;
    }

    toast({
      variant: entries.length === 0 ? "destructive" : "default",
      title:
        entries.length > 0
          ? `${entries.length} added, ${skippedNames.length} skipped`
          : "Nothing added",
      description: `Still need a worker picked: ${skippedNames.join(", ")}. Fix them below and add again, or add them by hand in Past Records.`,
    });
    // Drop only the rows that made it in — keep the skipped ones on screen
    // (dialog stays open) so they can be fixed and resubmitted, instead of
    // closing and losing the review state for just those couple of rows.
    setRows((prev) => prev.filter((r) => !addedIds.has(r.id)));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-y-hidden overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scan Crew Sheet
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Take a photo or upload one of the paper Daily Crew Sheet, and the workers will be read automatically."}
            {step === "processing" && "Reading the sheet…"}
            {step === "review" &&
              "Review what was read before adding it. Green = matched, yellow = double-check, red = pick the worker manually."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3 max-w-md">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-3">
              <Button type="button" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Photo
              </Button>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileInputChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileInputChange}
            />
          </div>
        )}

        {step === "processing" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Reading the sheet…</p>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                {counts.matched} matched
              </Badge>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                {counts.suggested} to confirm
              </Badge>
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                {counts.unmatched} not found
              </Badge>
            </div>
            {/* Plain native scroll instead of the ScrollArea component —
                it uses JS-mediated scrolling that's been unreliable for
                touch drags on some mobile browsers in testing; a native
                overflow-y-auto div always responds to a finger drag. */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
              <div className="space-y-2 pb-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={`rounded-md p-3 space-y-2 ${STATUS_STYLES[row.matchStatus]}`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={row.included}
                        onCheckedChange={(checked) =>
                          updateRow(row.id, { included: !!checked })
                        }
                      />
                      <span className="text-xs text-muted-foreground shrink-0">
                        Read as &ldquo;{row.sheetName}&rdquo;
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Select
                          value={row.employeeId}
                          onValueChange={(value) =>
                            updateRow(row.id, { employeeId: value })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Pick worker…" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedEmployees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {row.matchStatus === "unmatched" && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-6 px-0 text-xs"
                            onClick={() =>
                              setAddEmployeeFor({ rowId: row.id, name: row.sheetName })
                            }
                          >
                            <UserPlus className="mr-1 h-3 w-3" />
                            Add &ldquo;{row.sheetName}&rdquo; as a new employee
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <div>
                          <label className="text-[10px] text-muted-foreground">
                            Start
                          </label>
                          <Input
                            className="h-9"
                            value={row.start}
                            placeholder="--:--"
                            onChange={(e) =>
                              updateRow(row.id, { start: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">
                            End
                          </label>
                          <Input
                            className="h-9"
                            value={row.end}
                            placeholder="--:--"
                            onChange={(e) =>
                              updateRow(row.id, { end: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">
                            Hours
                          </label>
                          <Input
                            className="h-9"
                            value={row.hours}
                            placeholder="0"
                            onChange={(e) =>
                              updateRow(row.id, { hours: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">
                            Bins/Pcs
                          </label>
                          <Input
                            className="h-9"
                            value={row.bins}
                            placeholder="0"
                            onChange={(e) =>
                              updateRow(row.id, { bins: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 text-sm border-t pt-2 shrink-0">
              <span>
                Total Hours: <strong>{totals.hours.toFixed(2)}</strong>
              </span>
              <span>
                Total Pieces/Bins: <strong>{totals.bins.toFixed(2)}</strong>
              </span>
              <span className="text-xs text-muted-foreground">
                (compare against the sheet)
              </span>
            </div>
          </>
        )}

        <DialogFooter>
          {step === "review" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Scan Different Photo
              </Button>
              <Button onClick={handleConfirm}>
                Add {rows.filter((r) => r.included).length} Worker
                {rows.filter((r) => r.included).length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AddEmployeeDialog
      isOpen={addEmployeeFor !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) setAddEmployeeFor(null);
      }}
      initialName={addEmployeeFor?.name}
      onCreated={(employee) => {
        if (!addEmployeeFor) return;
        setLocallyCreatedEmployees((prev) => [...prev, employee]);
        // Now a deliberate, certain assignment (the person just typed this
        // exact name themselves) — no longer flagged for a second look,
        // unlike a merely fuzzy-matched existing employee.
        updateRow(addEmployeeFor.rowId, {
          employeeId: employee.id,
          included: true,
          matchStatus: "matched",
        });
        setAddEmployeeFor(null);
      }}
    />
    </>
  );
}
