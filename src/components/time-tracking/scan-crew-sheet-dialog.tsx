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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, Loader2, AlertTriangle, ScanLine } from "lucide-react";
import type { Employee } from "@/lib/types";
import {
  bestNameMatch,
  MATCH_THRESHOLD_EXACT,
  MATCH_THRESHOLD_FUZZY,
} from "@/lib/fuzzy-match";
import type { ParsedCrewSheetRow } from "@/lib/ocr-crew-sheet";

export type ScannedEmployeeEntry = {
  employee: Employee;
  pieces: string;
  clockIn?: string;
  clockOut?: string;
  hours?: string;
  lunchIn?: string;
  lunchBreak?: boolean;
};

type MatchStatus = "matched" | "suggested" | "unmatched";

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
}: Props) {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<"upload" | "processing" | "review">(
    "upload",
  );
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setStep("upload");
      setRows([]);
      setError(null);
    }
  }, [open]);

  const employeesById = React.useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );
  const sortedEmployees = React.useMemo(
    () => [...employees].sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
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
        return {
          id: `${idx}-${parsed.name}`,
          sheetName: parsed.name,
          matchStatus,
          employeeId: matchStatus === "unmatched" ? "" : (best?.candidateId ?? ""),
          included: matchStatus !== "unmatched",
          start: parsed.start ?? "",
          end: parsed.end ?? "",
          lunchIn: parsed.lunchIn ?? "",
          hours: parsed.hours ?? "",
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

  const handleConfirm = () => {
    const toAdd = rows.filter((r) => r.included);
    const missingEmployee = toAdd.some((r) => !r.employeeId);
    if (missingEmployee) {
      toast({
        variant: "destructive",
        title: "Missing worker",
        description:
          "Every included row needs a worker picked before you can add them.",
      });
      return;
    }
    const seen = new Set<string>();
    const duplicate = toAdd.find((r) => {
      if (seen.has(r.employeeId)) return true;
      seen.add(r.employeeId);
      return false;
    });
    if (duplicate) {
      toast({
        variant: "destructive",
        title: "Same worker picked twice",
        description:
          "Two rows are assigned to the same worker — fix or uncheck one before continuing.",
      });
      return;
    }

    const entries: ScannedEmployeeEntry[] = toAdd
      .map((r): ScannedEmployeeEntry | null => {
        const employee = employeesById.get(r.employeeId);
        if (!employee) return null;
        return {
          employee,
          pieces: r.bins,
          clockIn: r.start,
          clockOut: r.end,
          hours: r.hours,
          lunchIn: r.lunchIn,
          lunchBreak: r.lunchIn ? true : undefined,
        };
      })
      .filter((e): e is ScannedEmployeeEntry => e !== null);

    onConfirm(entries);
    onOpenChange(false);
    toast({
      title: "Sheet scanned",
      description: `${entries.length} worker${entries.length === 1 ? "" : "s"} added — review their hours before saving.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
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
            <ScrollArea className="flex-1 -mx-1 px-1">
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
            </ScrollArea>
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
  );
}
