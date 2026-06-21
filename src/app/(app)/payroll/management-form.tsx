"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, ChevronsUpDown } from "lucide-react";

import { cn, toLocalMidnight } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { Client } from "@/lib/types";
import type { DateRange } from "react-day-picker";
import { fetchPayrollRangeData } from "./range-data";
import { buildManagementReport, type ManagementReport } from "./management-report";
import { ManagementReportDisplay } from "./management-report-display";

export function PayrollManagementForm() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [date, setDate] = React.useState<DateRange | undefined>();
  const [payDate, setPayDate] = React.useState<Date | undefined>(new Date());
  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedClientIds, setSelectedClientIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [report, setReport] = React.useState<ManagementReport | null>(null);
  const [generatedPeriod, setGeneratedPeriod] = React.useState<{
    from: Date;
    to: Date;
  } | null>(null);

  // Load the client list for the dropdown.
  React.useEffect(() => {
    const loadClients = async () => {
      if (!firestore) return;
      try {
        const snap = await getDocs(collection(firestore, "clients"));
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Client)
          .sort((a, b) => a.name.localeCompare(b.name));
        setClients(list);
      } catch (error) {
        console.error("Failed to load clients:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load the client list.",
        });
      }
    };
    loadClients();
  }, [firestore, toast]);

  const allClientsSelected =
    clients.length > 0 && selectedClientIds.size === clients.length;

  const handleSelectAllClients = (checked: boolean) => {
    setSelectedClientIds(
      checked ? new Set(clients.map((c) => c.id)) : new Set(),
    );
  };

  const handleClientSelect = (clientId: string, checked: boolean) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(clientId);
      else next.delete(clientId);
      return next;
    });
  };

  const clientButtonLabel = (() => {
    if (selectedClientIds.size === 0) return "Select a client";
    if (allClientsSelected) return "All clients";
    const names = clients
      .filter((c) => selectedClientIds.has(c.id))
      .map((c) => c.name);
    if (names.length <= 2) return names.join(", ");
    return `${names.length} clients selected`;
  })();

  const canGenerate =
    !!date?.from &&
    !!date?.to &&
    !!payDate &&
    selectedClientIds.size > 0 &&
    !isGenerating;

  const handleGenerate = async () => {
    if (!firestore || !date?.from || !date?.to) return;
    setIsGenerating(true);
    try {
      const data = await fetchPayrollRangeData(firestore, date.from, date.to);
      const built = buildManagementReport(data, selectedClientIds);
      setReport(built);
      setGeneratedPeriod({ from: date.from, to: date.to });
    } catch (error) {
      console.error("Failed to generate management report:", error);
      toast({
        variant: "destructive",
        title: "Error Generating Report",
        description:
          "Could not generate the report. Please check your connection and try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (report && generatedPeriod) {
    return (
      <ManagementReportDisplay
        report={report}
        period={generatedPeriod}
        onBack={() => {
          setReport(null);
          setGeneratedPeriod(null);
        }}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 mb-4">
      <div className="grid gap-4">
        {/* Period */}
        <div>
          <Label>Period</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
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
        </div>

        {/* Client (multiselect) */}
        <div>
          <Label>Client</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-between text-left font-normal",
                  selectedClientIds.size === 0 && "text-muted-foreground",
                )}
              >
                <span className="truncate">{clientButtonLabel}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <div className="max-h-72 overflow-y-auto p-2">
                {clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">
                    No clients available.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center space-x-2 px-2 py-1.5 border-b mb-1">
                      <Checkbox
                        id="client-select-all"
                        checked={allClientsSelected}
                        onCheckedChange={(c) => handleSelectAllClients(!!c)}
                      />
                      <label
                        htmlFor="client-select-all"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        Select All
                      </label>
                    </div>
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center space-x-2 px-2 py-1.5 rounded-sm hover:bg-accent"
                      >
                        <Checkbox
                          id={`client-${client.id}`}
                          checked={selectedClientIds.has(client.id)}
                          onCheckedChange={(c) =>
                            handleClientSelect(client.id, !!c)
                          }
                        />
                        <label
                          htmlFor={`client-${client.id}`}
                          className="text-sm leading-snug cursor-pointer flex-1"
                        >
                          {client.name}
                        </label>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Pay Date */}
        <div>
          <Label>Pay Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !payDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {payDate ? format(payDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={payDate}
                onSelect={(d) => {
                  if (d) setPayDate(toLocalMidnight(d));
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div>
        <Button onClick={handleGenerate} disabled={!canGenerate}>
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Generate Report
        </Button>
        {isGenerating && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating report...
          </p>
        )}
        {!isGenerating && selectedClientIds.size > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {selectedClientIds.size} of {clients.length} clients selected.
          </p>
        )}
      </div>
    </div>
  );
}
