"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode,
  ClipboardEdit,
  Users,
  User,
  CheckCircle,
  Package,
  LogIn,
  LogOut,
  Loader2,
  VideoOff,
  History,
  Trash2,
  Calendar as CalendarIcon,
  Filter,
  Edit,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useFirestore } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import type {
  Task,
  TimeEntry,
  Piecework,
  Employee,
  Client,
  SoundSettings,
} from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { withAuth } from "@/components/withAuth";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { addOfflineIndicator } from "@/lib/offline-utils";
import { useAuth } from "@/contexts/auth-context";
import { SoundSettingsService } from "../../../services/SoundSettingsService";
import { AVAILABLE_SOUNDS, SoundOption } from "../../../lib/types";
// Al inicio del archivo, agregar el import
import SoundTestTab from "./SoundTestTab";
const QrScanner = dynamic(
  () => import("./qr-scanner").then((mod) => mod.QrScannerComponent),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="w-full aspect-video bg-muted rounded-md flex items-center justify-center">
        <VideoOff className="h-10 w-10 text-muted-foreground" />
      </Skeleton>
    ),
  },
);

type ScanMode = "clock-in" | "clock-out" | "piece";
type ManualLogType =
  | "clock-in"
  | "clock-out"
  | "start-break"
  | "end-break"
  | "piecework";
type PieceEntryMode = "scan" | "manual";
type SoundType =
  | "clock-in"
  | "clock-out"
  | "piece"
  | "alarm1"
  | "alarm2"
  | "beep1"
  | "beep2"
  | "melody1"
  | "melody2"
  | "notification"
  | "success"
  | "error";

// Constant for clear selection value in dropdowns
const CLEAR_SELECTION_VALUE = "none";

/**
 * Rounds a date to the nearest 15-minute interval (quarter hour).
 * Rules:
 * - Minutes 0-7: round down to current quarter (e.g., 7:04 → 7:00, 7:37 → 7:30)
 * - Minutes 8-14: round up to next quarter (e.g., 7:08 → 7:15, 7:38 → 7:45)
 *
 * Examples:
 * - 7:04 → 7:00
 * - 7:08 → 7:15
 * - 7:37 → 7:30
 * - 7:38 → 7:45
 */
function roundToNearestQuarterHour(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 15;

  if (remainder <= 7) {
    // Round down to current quarter
    rounded.setMinutes(minutes - remainder);
  } else {
    // Round up to next quarter
    rounded.setMinutes(minutes + (15 - remainder));
  }

  // Reset seconds and milliseconds to 0
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);

  return rounded;
}

function TimeTrackingPage() {
  const { username } = useAuth();
  const [soundSettings, setSoundSettings] = useState<SoundSettings | null>(
    null,
  );
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  const [scanMode, setScanMode] = useState<ScanMode>("clock-in");
  const [isSharedPiece, setIsSharedPiece] = useState(false);
  const [pieceEntryMode, setPieceEntryMode] = useState<PieceEntryMode>("scan");
  const [activeTab, setActiveTab] = useState<string>("qr-scanner");

  const [scannedSharedEmployees, setScannedSharedEmployees] = useState<
    string[]
  >([]);

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Bulk clock out
  const [isBulkClockingOut, setIsBulkClockingOut] = useState(false);
  const [selectedBulkTask, setSelectedBulkTask] = useState<string>("");
  const [useBulkClockOutManualDateTime, setUseBulkClockOutManualDateTime] =
    useState(false);
  const [bulkClockOutDate, setBulkClockOutDate] = useState<Date | undefined>(
    undefined,
  );
  // Independent client selector for bulk clock-out
  const [selectedBulkClient, setSelectedBulkClient] = useState<string>("");
  const [selectedBulkRanch, setSelectedBulkRanch] = useState<string>("");
  const [selectedBulkBlock, setSelectedBulkBlock] = useState<string>("");

  // Bulk clock in
  const [isBulkClockingIn, setIsBulkClockingIn] = useState(false);
  const [selectedBulkInTask, setSelectedBulkInTask] = useState<string>("");
  const [selectedBulkInEmployees, setSelectedBulkInEmployees] = useState<
    Set<string>
  >(new Set());
  const [useBulkClockInManualDateTime, setUseBulkClockInManualDateTime] =
    useState(false);
  const [bulkClockInDate, setBulkClockInDate] = useState<Date | undefined>(
    undefined,
  );

  // Load persisted selections from sessionStorage on mount
  const [selectedClient, setSelectedClient] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("time_tracking_selected_client") || "";
    }
    return "";
  });
  const [selectedRanch, setSelectedRanch] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("time_tracking_selected_ranch") || "";
    }
    return "";
  });
  const [selectedBlock, setSelectedBlock] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("time_tracking_selected_block") || "";
    }
    return "";
  });
  const [selectedTask, setSelectedTask] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("time_tracking_selected_task") || "";
    }
    return "";
  });

  // Piece-work tab specific state
  const [pieceWorkClient, setPieceWorkClient] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("time_tracking_piecework_client") || "";
    }
    return "";
  });
  const [pieceWorkTask, setPieceWorkTask] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("time_tracking_piecework_task") || "";
    }
    return "";
  });

  // Persist selections to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedClient) {
        sessionStorage.setItem("time_tracking_selected_client", selectedClient);
      } else {
        sessionStorage.removeItem("time_tracking_selected_client");
      }
    }
  }, [selectedClient]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedRanch) {
        sessionStorage.setItem("time_tracking_selected_ranch", selectedRanch);
      } else {
        sessionStorage.removeItem("time_tracking_selected_ranch");
      }
    }
  }, [selectedRanch]);
  useEffect(() => {
    if (username) {
      const settings = SoundSettingsService.getSoundSettings(username);
      setSoundSettings(settings);
    }
  }, [username]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedBlock) {
        sessionStorage.setItem("time_tracking_selected_block", selectedBlock);
      } else {
        sessionStorage.removeItem("time_tracking_selected_block");
      }
    }
  }, [selectedBlock]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedTask) {
        sessionStorage.setItem("time_tracking_selected_task", selectedTask);
      } else {
        sessionStorage.removeItem("time_tracking_selected_task");
      }
    }
  }, [selectedTask]);

  // Persist piece-work selections
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (pieceWorkClient) {
        sessionStorage.setItem(
          "time_tracking_piecework_client",
          pieceWorkClient,
        );
      } else {
        sessionStorage.removeItem("time_tracking_piecework_client");
      }
    }
  }, [pieceWorkClient]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (pieceWorkTask) {
        sessionStorage.setItem("time_tracking_piecework_task", pieceWorkTask);
      } else {
        sessionStorage.removeItem("time_tracking_piecework_task");
      }
    }
  }, [pieceWorkTask]);

  // Manual Entry State
  const [manualLogType, setManualLogType] = useState<ManualLogType>("clock-in");
  const [manualEmployeeSearch, setManualEmployeeSearch] = useState("");
  const [manualSelectedEmployee, setManualSelectedEmployee] =
    useState<Employee | null>(null);
  const [manualPieceQuantity, setManualPieceQuantity] = useState<
    number | string
  >("");
  const [manualNotes, setManualNotes] = useState("");
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Manual Date/Time Selection State
  const [useManualDateTime, setUseManualDateTime] = useState(false);
  const [manualClockInDate, setManualClockInDate] = useState<Date | undefined>(
    undefined,
  );
  const [manualClockOutDate, setManualClockOutDate] = useState<
    Date | undefined
  >(undefined);
  const [manualPieceworkDate, setManualPieceworkDate] = useState<
    Date | undefined
  >(undefined);

  // QR Scanner piecework state - for entering pieces completed when clocking in to piecework task
  const [qrPiecesCompleted, setQrPiecesCompleted] = useState<number | string>(
    "",
  );

  // Past records state - for creating both clock-in and clock-out at once
  const [usePastRecords, setUsePastRecords] = useState(false);
  const [pastRecordClockInDate, setPastRecordClockInDate] = useState<
    Date | undefined
  >(undefined);
  const [pastRecordClockOutDate, setPastRecordClockOutDate] = useState<
    Date | undefined
  >(undefined);
  const [pastRecordDate, setPastRecordDate] = useState<Date | undefined>(
    undefined,
  );
  const [pastRecordClockInTime, setPastRecordClockInTime] =
    useState<string>("");
  const [pastRecordClockOutTime, setPastRecordClockOutTime] =
    useState<string>("");
  const [pastRecordPiecesCount, setPastRecordPiecesCount] = useState<
    number | string
  >("");

  // History filtering state
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>(
    undefined,
  );
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>(
    undefined,
  );
  const [historyNameFilter, setHistoryNameFilter] = useState<string>("");

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "time" | "piecework";
    id: string;
  } | null>(null);

  // Delete all confirmation state
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllPassword, setDeleteAllPassword] = useState("");

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    type: "time" | "piecework";
    entry: TimeEntry | Piecework;
  } | null>(null);
  const [editTimestamp, setEditTimestamp] = useState<Date | undefined>(
    undefined,
  );
  const [editEndTime, setEditEndTime] = useState<Date | undefined>(undefined);
  const [editPiecesWorked, setEditPiecesWorked] = useState<number | string>(0);
  const [editPaymentModality, setEditPaymentModality] = useState<
    "Hourly" | "Piecework"
  >("Hourly");
  const [editPieceCount, setEditPieceCount] = useState<number | string>(1);
  const [editTaskId, setEditTaskId] = useState<string>("");
  const [editClient, setEditClient] = useState<string>("");
  const [editRanch, setEditRanch] = useState<string>("");
  const [editBlock, setEditBlock] = useState<string>("");
  const [editRelatedPiecework, setEditRelatedPiecework] = useState<Piecework[]>(
    [],
  );

  // Debounce state
  const [recentScans, setRecentScans] = useState<
    { scanData: string; mode: ScanMode; timestamp: number }[]
  >([]);
  const DEBOUNCE_MS = 5000; // 5 seconds - prevents camera from double-scanning QR codes
  const PIECEWORK_DEBOUNCE_MS = 180000; // 3 minutes for piecework tab

  // QR Scanner processing state - prevents duplicate scans while processing
  const [isQrProcessing, setIsQrProcessing] = useState(false);

  // Piecework QR Scanner processing state - prevents duplicate scans while processing
  const [isPieceworkQrProcessing, setIsPieceworkQrProcessing] = useState(false);

  // Sick leave state
  const [sickHoursToUse, setSickHoursToUse] = useState<number | string>(0);
  const [sickLeaveDate, setSickLeaveDate] = useState<string>("");
  const [sickLeaveNotes, setSickLeaveNotes] = useState("");
  const [isLoggingSickLeave, setIsLoggingSickLeave] = useState(false);

  // Use sick hours for payment state
  const [useSickHoursForPayment, setUseSickHoursForPayment] = useState(false);

  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "clients"), where("name", "!=", ""));
  }, [firestore]);
  const { data: clients } = useCollection<Client>(clientsQuery);

  const tasksQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "tasks"),
      where("status", "==", "Active"),
    );
  }, [firestore]);
  const { data: allTasks } = useCollection<Task>(tasksQuery);

  const employeesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "employees"),
      where("status", "==", "Active"),
    );
  }, [firestore]);
  const { data: activeEmployees } = useCollection<Employee>(employeesQuery);

  // Query for ALL time entries (for history tab) with date filtering
  const allTimeEntriesQuery = useMemo(() => {
    if (!firestore) return null;
    let q = collection(firestore, "time_entries");

    // Build query with date filters if specified
    const constraints = [];
    if (historyStartDate) {
      constraints.push(where("timestamp", ">=", startOfDay(historyStartDate)));
    }
    if (historyEndDate) {
      constraints.push(where("timestamp", "<=", endOfDay(historyEndDate)));
    }

    return constraints.length > 0 ? query(q, ...constraints) : query(q);
  }, [firestore, historyStartDate, historyEndDate]);
  const { data: allTimeEntriesRaw } =
    useCollection<TimeEntry>(allTimeEntriesQuery);

  // Sort all time entries in memory by timestamp descending
  const allTimeEntries = useMemo(() => {
    if (!allTimeEntriesRaw) return null;
    return [...allTimeEntriesRaw].sort((a, b) => {
      const aTime =
        a.timestamp instanceof Date
          ? a.timestamp
          : (a.timestamp as any)?.toDate?.()
            ? (a.timestamp as any).toDate()
            : new Date(a.timestamp as any);
      const bTime =
        b.timestamp instanceof Date
          ? b.timestamp
          : (b.timestamp as any)?.toDate?.()
            ? (b.timestamp as any).toDate()
            : new Date(b.timestamp as any);
      return bTime.getTime() - aTime.getTime();
    });
  }, [allTimeEntriesRaw]);

  // Query for ALL piecework records (for history tab) with date filtering
  const allPieceworkQuery = useMemo(() => {
    if (!firestore) return null;
    let q = collection(firestore, "piecework");

    // Build query with date filters if specified
    const constraints = [];
    if (historyStartDate) {
      constraints.push(where("timestamp", ">=", startOfDay(historyStartDate)));
    }
    if (historyEndDate) {
      constraints.push(where("timestamp", "<=", endOfDay(historyEndDate)));
    }

    return constraints.length > 0 ? query(q, ...constraints) : query(q);
  }, [firestore, historyStartDate, historyEndDate]);
  const { data: allPieceworkRaw } = useCollection<Piecework>(allPieceworkQuery);

  // Sort all piecework in memory by timestamp descending
  const allPiecework = useMemo(() => {
    if (!allPieceworkRaw) return null;
    return [...allPieceworkRaw].sort((a, b) => {
      const aTime =
        a.timestamp instanceof Date
          ? a.timestamp
          : (a.timestamp as any)?.toDate?.()
            ? (a.timestamp as any).toDate()
            : new Date(a.timestamp as any);
      const bTime =
        b.timestamp instanceof Date
          ? b.timestamp
          : (b.timestamp as any)?.toDate?.()
            ? (b.timestamp as any).toDate()
            : new Date(b.timestamp as any);
      return bTime.getTime() - aTime.getTime();
    });
  }, [allPieceworkRaw]);

  // Merged records - combining time entries and piecework for unified history view
  const mergedRecords = useMemo(() => {
    const records: Array<
      { type: "time"; data: TimeEntry } | { type: "piecework"; data: Piecework }
    > = [];

    if (allTimeEntries) {
      allTimeEntries.forEach((entry) => {
        records.push({ type: "time", data: entry });
      });
    }

    if (allPiecework) {
      allPiecework.forEach((piece) => {
        records.push({ type: "piecework", data: piece });
      });
    }

    // Sort all records by timestamp descending
    return records.sort((a, b) => {
      const aTime =
        a.data.timestamp instanceof Date
          ? a.data.timestamp
          : (a.data.timestamp as any)?.toDate?.()
            ? (a.data.timestamp as any).toDate()
            : new Date(a.data.timestamp as any);
      const bTime =
        b.data.timestamp instanceof Date
          ? b.data.timestamp
          : (b.data.timestamp as any)?.toDate?.()
            ? (b.data.timestamp as any).toDate()
            : new Date(b.data.timestamp as any);
      return bTime.getTime() - aTime.getTime();
    });
  }, [allTimeEntries, allPiecework]);

  // Filter merged records by employee name
  const filteredMergedRecords = useMemo(() => {
    if (!historyNameFilter.trim()) {
      return mergedRecords;
    }

    const searchTerm = historyNameFilter.toLowerCase().trim();

    return mergedRecords.filter((record) => {
      if (record.type === "time") {
        const employee = activeEmployees?.find(
          (e) => e.id === record.data.employeeId,
        );
        return employee?.name.toLowerCase().includes(searchTerm);
      } else {
        // Piecework - handle multiple employees (comma-separated IDs)
        const employeeIds = record.data.employeeId.split(",");
        const employeeNames = employeeIds
          .map(
            (id) =>
              activeEmployees?.find((e) => e.id === id || e.qrCode === id)
                ?.name,
          )
          .filter(Boolean);
        return employeeNames.some((name) =>
          name?.toLowerCase().includes(searchTerm),
        );
      }
    });
  }, [mergedRecords, historyNameFilter, activeEmployees]);

  // Query for active time entries (for history tab)
  const activeTimeEntriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "time_entries"),
      where("endTime", "==", null),
    );
  }, [firestore]);
  const { data: activeTimeEntriesRaw } = useCollection<TimeEntry>(
    activeTimeEntriesQuery,
  );

  // Sort active time entries in memory by timestamp descending
  const activeTimeEntries = useMemo(() => {
    if (!activeTimeEntriesRaw) return null;
    return [...activeTimeEntriesRaw].sort((a, b) => {
      const aTime =
        a.timestamp instanceof Date
          ? a.timestamp
          : (a.timestamp as any)?.toDate?.()
            ? (a.timestamp as any).toDate()
            : new Date(a.timestamp as any);
      const bTime =
        b.timestamp instanceof Date
          ? b.timestamp
          : (b.timestamp as any)?.toDate?.()
            ? (b.timestamp as any).toDate()
            : new Date(b.timestamp as any);
      return bTime.getTime() - aTime.getTime();
    });
  }, [activeTimeEntriesRaw]);

  // Find active piecework task - check if user has any active time entry with a piecework task
  const activePieceworkTask = useMemo(() => {
    if (!activeTimeEntries || !allTasks) return null;

    // Find any active time entry where the task is a piecework task
    for (const entry of activeTimeEntries) {
      const task = allTasks.find((t) => t.id === entry.taskId);
      if (task && task.clientRateType === "piece") {
        return task;
      }
    }
    return null;
  }, [activeTimeEntries, allTasks]);

  // Get the currently selected task for piecework - this is what shows in PIECEWORK tab
  const selectedPieceworkTask = useMemo(() => {
    if (!selectedTask || !allTasks) return null;
    const task = allTasks.find((t) => t.id === selectedTask);
    // Only return if it's a piecework task
    if (task && task.clientRateType === "piece") {
      return task;
    }
    return null;
  }, [selectedTask, allTasks]);

  // Get active piecework tasks by client (tasks with active clock-ins and piecework type)
  const activePieceworkTasksByClient = useMemo(() => {
    if (!activeTimeEntries || !allTasks || !pieceWorkClient) return [];

    // Find all unique task IDs from active time entries
    const activeTaskIds = new Set(
      activeTimeEntries.map((entry) => entry.taskId),
    );

    // Filter tasks that are:
    // 1. Piecework type
    // 2. Have active clock-ins
    // 3. Belong to selected client
    return allTasks.filter(
      (task) =>
        task.clientRateType === "piece" &&
        activeTaskIds.has(task.id) &&
        task.clientId === pieceWorkClient,
    );
  }, [activeTimeEntries, allTasks, pieceWorkClient]);

  // Get the selected piecework task for the piece-work tab
  const pieceWorkSelectedTask = useMemo(() => {
    if (!pieceWorkTask || !allTasks) return null;
    return allTasks.find((t) => t.id === pieceWorkTask) || null;
  }, [pieceWorkTask, allTasks]);

  // Get clients with active piecework tasks and their task counts
  const clientsWithActiveTasks = useMemo(() => {
    if (!clients || !activeTimeEntries || !allTasks) return [];

    const activeTaskIds = new Set(
      activeTimeEntries.map((entry) => entry.taskId),
    );

    return clients
      .map((client) => {
        const activeTasksCount = allTasks.filter(
          (task) =>
            task.clientRateType === "piece" &&
            activeTaskIds.has(task.id) &&
            task.clientId === client.id,
        ).length;

        return {
          ...client,
          activeTasksCount,
        };
      })
      .filter((client) => client.activeTasksCount > 0);
  }, [clients, activeTimeEntries, allTasks]);

  const tasksForClient = useMemo(() => {
    if (!allTasks || !selectedClient) return [];
    return allTasks.filter((t) => t.clientId === selectedClient);
  }, [allTasks, selectedClient]);

  const ranches = useMemo(() => {
    if (!tasksForClient) return [];
    return [
      ...new Set(tasksForClient.map((t) => t.ranch).filter(Boolean)),
    ] as string[];
  }, [tasksForClient]);

  const blocks = useMemo(() => {
    if (!selectedRanch || !tasksForClient) return [];
    return [
      ...new Set(
        tasksForClient
          .filter((t) => t.ranch === selectedRanch)
          .map((t) => t.block)
          .filter(Boolean),
      ),
    ] as string[];
  }, [tasksForClient, selectedRanch]);

  const filteredTasks = useMemo(() => {
    if (!tasksForClient) return [];
    let filtered = tasksForClient;
    if (selectedRanch) {
      filtered = filtered.filter((t) => t.ranch === selectedRanch);
    }
    if (selectedBlock) {
      filtered = filtered.filter((t) => t.block === selectedBlock);
    }
    return filtered;
  }, [tasksForClient, selectedRanch, selectedBlock]);

  // Filtered tasks for bulk clock out - only shows tasks with active clock-ins
  const bulkClockOutTasks = useMemo(() => {
    if (!filteredTasks || !activeTimeEntries) return [];

    // Get unique task IDs from active time entries
    const activeTaskIds = new Set(
      activeTimeEntries.map((entry) => entry.taskId),
    );

    // Filter to only include tasks that:
    // 1. Are in the filtered tasks list (client/ranch/block filter applied)
    // 2. Have active clock-ins
    // 3. Are active status
    return filteredTasks.filter(
      (task) => task.status === "Active" && activeTaskIds.has(task.id),
    );
  }, [filteredTasks, activeTimeEntries]);

  // Independent filters for bulk clock-out section
  const bulkTasksForClient = useMemo(() => {
    if (!allTasks || !selectedBulkClient) return [];
    return allTasks.filter((t) => t.clientId === selectedBulkClient);
  }, [allTasks, selectedBulkClient]);

  const bulkRanches = useMemo(() => {
    if (!bulkTasksForClient) return [];
    return [
      ...new Set(bulkTasksForClient.map((t) => t.ranch).filter(Boolean)),
    ] as string[];
  }, [bulkTasksForClient]);

  const bulkBlocks = useMemo(() => {
    if (!selectedBulkRanch || !bulkTasksForClient) return [];
    return [
      ...new Set(
        bulkTasksForClient
          .filter((t) => t.ranch === selectedBulkRanch)
          .map((t) => t.block)
          .filter(Boolean),
      ),
    ] as string[];
  }, [bulkTasksForClient, selectedBulkRanch]);

  const bulkFilteredTasks = useMemo(() => {
    if (!bulkTasksForClient) return [];
    let filtered = bulkTasksForClient;
    if (selectedBulkRanch) {
      filtered = filtered.filter((t) => t.ranch === selectedBulkRanch);
    }
    if (selectedBulkBlock) {
      filtered = filtered.filter((t) => t.block === selectedBulkBlock);
    }
    return filtered;
  }, [bulkTasksForClient, selectedBulkRanch, selectedBulkBlock]);

  // Bulk clock-out tasks with active clock-ins
  const bulkClockOutFilteredTasks = useMemo(() => {
    if (!bulkFilteredTasks || !activeTimeEntries) return [];

    // Get unique task IDs from active time entries
    const activeTaskIds = new Set(
      activeTimeEntries.map((entry) => entry.taskId),
    );

    // Filter to only include tasks that:
    // 1. Are in the bulk filtered tasks list (independent client/ranch/block filter applied)
    // 2. Have active clock-ins
    // 3. Are active status
    return bulkFilteredTasks.filter(
      (task) => task.status === "Active" && activeTaskIds.has(task.id),
    );
  }, [bulkFilteredTasks, activeTimeEntries]);

  // Filtered tasks for edit dialog
  const editTasksForClient = useMemo(() => {
    if (!allTasks || !editClient) return [];
    return allTasks.filter((t) => t.clientId === editClient);
  }, [allTasks, editClient]);

  const editRanches = useMemo(() => {
    if (!editTasksForClient) return [];
    return [
      ...new Set(editTasksForClient.map((t) => t.ranch).filter(Boolean)),
    ] as string[];
  }, [editTasksForClient]);

  const editBlocks = useMemo(() => {
    if (!editRanch || !editTasksForClient) return [];
    return [
      ...new Set(
        editTasksForClient
          .filter((t) => t.ranch === editRanch)
          .map((t) => t.block)
          .filter(Boolean),
      ),
    ] as string[];
  }, [editTasksForClient, editRanch]);

  const editFilteredTasks = useMemo(() => {
    if (!editTasksForClient) return [];
    let filtered = editTasksForClient;
    if (editRanch) {
      filtered = filtered.filter((t) => t.ranch === editRanch);
    }
    if (editBlock) {
      filtered = filtered.filter((t) => t.block === editBlock);
    }
    return filtered;
  }, [editTasksForClient, editRanch, editBlock]);

  const filteredManualEmployees = useMemo(() => {
    if (!activeEmployees) return [];
    if (!manualEmployeeSearch) return [];
    return activeEmployees.filter((emp) =>
      emp.name.toLowerCase().includes(manualEmployeeSearch.toLowerCase()),
    );
  }, [activeEmployees, manualEmployeeSearch]);

  useEffect(() => {
    // Creating AudioContext on user interaction is best practice
    const initializeAudio = () => {
      if (window.AudioContext && !audioContext) {
        setAudioContext(new window.AudioContext());
        document.removeEventListener("click", initializeAudio);
      }
    };
    document.addEventListener("click", initializeAudio);
    return () => document.removeEventListener("click", initializeAudio);
  }, [audioContext]);

  // Actualizar la función playSound para usar la configuración guardada
  const playSound = useCallback(
    (type: "clock-in" | "clock-out" | "piece") => {
      if (!audioContext || !soundSettings) return;

      let soundId: string;
      switch (type) {
        case "clock-in":
          soundId = soundSettings.clockInSound;
          break;
        case "clock-out":
          soundId = soundSettings.clockOutSound;
          break;
        case "piece":
          soundId = soundSettings.pieceworkSound;
          break;
      }

      const soundOption = AVAILABLE_SOUNDS.find((s) => s.id === soundId);
      if (!soundOption) return;

      // Función helper para crear osciladores
      const createOscillator = (
        frequency: number,
        waveType: OscillatorType = "sine",
      ) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(
          frequency,
          audioContext.currentTime,
        );
        oscillator.type = waveType;

        const volume = soundSettings.volume;
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(
          volume,
          audioContext.currentTime + 0.01,
        );

        return { oscillator, gainNode };
      };

      // Reproducir el sonido
      let currentTime = audioContext.currentTime;

      soundOption.frequencies.forEach((freq, index) => {
        const { oscillator, gainNode } = createOscillator(
          freq,
          soundOption.waveType,
        );
        const duration = soundOption.durations[index] || 0.2;
        const gap = soundOption.gaps[index] || 0.1;

        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          currentTime + duration,
        );

        currentTime += duration + gap;
      });

      // Vibración si está habilitada
      if (
        soundSettings.vibrationEnabled &&
        soundOption.vibrationPattern &&
        typeof navigator !== "undefined" &&
        "vibrate" in navigator
      ) {
        try {
          navigator.vibrate(soundOption.vibrationPattern);
        } catch (e) {
          console.debug("Vibration not supported:", e);
        }
      }
    },
    [audioContext, soundSettings],
  );

  /*   // Reset selections when client changes
  useEffect(() => {
    setSelectedRanch("");
    setSelectedBlock("");
    setSelectedTask("");
  }, [selectedClient]);

  useEffect(() => {
    setSelectedBlock("");
    setSelectedTask("");
  }, [selectedRanch]);

  useEffect(() => {
    setSelectedTask("");
  }, [selectedBlock]);

  // Reset edit selections when edit client changes
  useEffect(() => {
    setEditRanch("");
    setEditBlock("");
    setEditTaskId("");
  }, [editClient]);

  useEffect(() => {
    setEditBlock("");
    setEditTaskId("");
  }, [editRanch]);

  useEffect(() => {
    setEditTaskId("");
  }, [editBlock]); */

  // Synchronize past record date and time states
  useEffect(() => {
    if (pastRecordDate && pastRecordClockInTime) {
      const [hours, minutes] = pastRecordClockInTime.split(":").map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const dateWithTime = new Date(
          pastRecordDate.getFullYear(),
          pastRecordDate.getMonth(),
          pastRecordDate.getDate(),
          hours,
          minutes,
          0,
          0,
        );
        setPastRecordClockInDate(dateWithTime);
      }
    } else {
      setPastRecordClockInDate(undefined);
    }
  }, [pastRecordDate, pastRecordClockInTime]);

  useEffect(() => {
    if (pastRecordDate && pastRecordClockOutTime) {
      const [hours, minutes] = pastRecordClockOutTime.split(":").map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const dateWithTime = new Date(
          pastRecordDate.getFullYear(),
          pastRecordDate.getMonth(),
          pastRecordDate.getDate(),
          hours,
          minutes,
          0,
          0,
        );
        setPastRecordClockOutDate(dateWithTime);
      }
    } else {
      setPastRecordClockOutDate(undefined);
    }
  }, [pastRecordDate, pastRecordClockOutTime]);

  // Reset scans when mode changes
  useEffect(() => {
    setScannedSharedEmployees([]);
    setUseSickHoursForPayment(false); // Reset sick hours checkbox when mode changes
    setQrPiecesCompleted(""); // Reset pieces completed when mode or task changes
  }, [scanMode, isSharedPiece, selectedTask, pieceEntryMode]);

  // Reset manual employee selection when searching
  useEffect(() => {
    if (manualEmployeeSearch === "") {
      setManualSelectedEmployee(null);
    }
  }, [manualEmployeeSearch]);

  // Clear piecework selections when no active tasks remain
  useEffect(() => {
    if (clientsWithActiveTasks.length === 0) {
      // If there are no clients with active tasks, clear the selections
      if (pieceWorkClient) {
        setPieceWorkClient("");
      }
      if (pieceWorkTask) {
        setPieceWorkTask("");
      }
    } else {
      // If the previously selected client no longer has active tasks, clear it
      const selectedClientStillActive = clientsWithActiveTasks.some(
        (client) => client.id === pieceWorkClient,
      );
      if (pieceWorkClient && !selectedClientStillActive) {
        setPieceWorkClient("");
        setPieceWorkTask("");
      }

      // If the previously selected task is no longer active, clear it
      if (pieceWorkTask) {
        const taskStillActive = activePieceworkTasksByClient.some(
          (task) => task.id === pieceWorkTask,
        );
        if (!taskStillActive) {
          setPieceWorkTask("");
        }
      }
    }
  }, [
    clientsWithActiveTasks,
    activePieceworkTasksByClient,
    pieceWorkClient,
    pieceWorkTask,
  ]);

  const clockInEmployee = useCallback(
    async (
      employee: Employee,
      taskId: string,
      customTimestamp?: Date,
      useSickHours?: boolean,
      piecesWorked?: number,
    ): Promise<boolean> => {
      if (!firestore) return false;
      const batch = writeBatch(firestore);

      const activeEntriesQuery = query(
        collection(firestore, "time_entries"),
        where("employeeId", "==", employee.id),
        where("endTime", "==", null),
      );

      try {
        const activeEntriesSnap = await getDocs(activeEntriesQuery);

        // Check if employee is already clocked into the same task
        const alreadyInSameTask = activeEntriesSnap.docs.some(
          (docSnap) => (docSnap.data() as TimeEntry).taskId === taskId,
        );

        if (alreadyInSameTask) {
          toast({
            variant: "destructive",
            title: "Already Clocked In",
            description: `${employee.name} is already clocked into this task. Please clock out first or select a different task.`,
          });
          return false;
        }

        // Check if we're switching from a piecework task to an hourly task
        const newTask = allTasks?.find((t) => t.id === taskId);
        const isNewTaskHourly = newTask?.clientRateType === "hourly";

        // Round timestamp to nearest quarter hour
        const timestamp = roundToNearestQuarterHour(
          customTimestamp || new Date(),
        );

        // Auto-close any active entries when switching tasks (different task)
        activeEntriesSnap.forEach((docSnap) => {
          batch.update(docSnap.ref, { endTime: timestamp });
        });

        const newTimeEntryRef = doc(collection(firestore, "time_entries"));
        const newTimeEntry: Omit<TimeEntry, "id"> = {
          employeeId: employee.id,
          taskId: taskId,
          timestamp: timestamp,
          endTime: null,
          isBreak: false,
          useSickHoursForPayment: useSickHours || false,
          ...(piecesWorked && piecesWorked > 0 ? { piecesWorked } : {}),
        };
        batch.set(newTimeEntryRef, newTimeEntry);

        await batch.commit();
        playSound("clock-in");

        let description = `Clocked in ${employee.name}.${
          useSickHours ? " (Using sick hours for payment)" : ""
        }`;
        if (activeEntriesSnap.size > 0) {
          description += ` Previous task(s) automatically clocked out.`;
        }

        toast({
          title: "Clock In Successful",
          description: addOfflineIndicator(description, isOnline),
        });
        return true;
      } catch (serverError) {
        // When offline, Firestore operations are queued for sync
        // Only emit errors if we're online (actual permission/validation errors)
        if (isOnline) {
          const permissionError = new FirestorePermissionError({
            path: "time_entries",
            operation: "write",
            requestResourceData: { message: `Clock-in for ${employee.name}` },
          });
          errorEmitter.emit("permission-error", permissionError);
        } else {
          // When offline, show a user-friendly message instead of throwing
          console.warn("Clock-in operation failed offline:", serverError);
          toast({
            variant: "destructive",
            title: "Clock In Error",
            description:
              "Unable to complete clock-in. Please try again or check your data when back online.",
          });
        }
        return false;
      }
    },
    [firestore, toast, playSound, allTasks, isOnline],
  );

  const clockOutEmployee = useCallback(
    async (employee: Employee, taskId: string, customTimestamp?: Date) => {
      if (!firestore) return;

      const q = query(
        collection(firestore, "time_entries"),
        where("employeeId", "==", employee.id),
        where("endTime", "==", null), // Only clock out active entries
      );
      try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          toast({
            variant: "destructive",
            title: "Clock Out Failed",
            description: `No active clock-in found for ${employee.name}.`,
          });
        } else {
          // Round timestamp to nearest quarter hour
          const clockOutTime = roundToNearestQuarterHour(
            customTimestamp || new Date(),
          );

          // Validate that clock-out is not before clock-in
          let hasInvalidClockOut = false;
          let totalHoursForThisSession = 0;
          let usingSickHours = false;

          querySnapshot.forEach((docSnap) => {
            const entry = docSnap.data() as TimeEntry;
            const clockInTime =
              entry.timestamp instanceof Date
                ? entry.timestamp
                : (entry.timestamp as any)?.toDate?.()
                  ? (entry.timestamp as any).toDate()
                  : new Date(entry.timestamp as any);

            if (clockOutTime < clockInTime) {
              hasInvalidClockOut = true;
            } else {
              // Calculate hours for this session
              let hoursWorked =
                (clockOutTime.getTime() - clockInTime.getTime()) /
                (1000 * 60 * 60);

              // Apply meal break deduction: After 5 hours worked, deduct 30 minutes (0.5 hours) unpaid meal break
              if (hoursWorked > 5) {
                hoursWorked -= 0.5; // Deduct 30 minutes (0.5 hours)
              }

              totalHoursForThisSession += hoursWorked;
              usingSickHours = entry.useSickHoursForPayment || false;
            }
          });

          if (hasInvalidClockOut) {
            toast({
              variant: "destructive",
              title: "Invalid Clock Out Time",
              description: `Clock-out time cannot be before clock-in time.`,
            });
            return;
          }

          const batch = writeBatch(firestore);
          const updatedData = { endTime: clockOutTime };
          querySnapshot.forEach((doc) => {
            batch.update(doc.ref, updatedData);
          });

          // Update employee's totalHoursWorked and sickHoursBalance
          const currentTotalHours = employee.totalHoursWorked || 0;
          const newTotalHours = currentTotalHours + totalHoursForThisSession;

          const currentSickBalance = employee.sickHoursBalance || 0;
          let newSickBalance = currentSickBalance;
          let sickHoursAccrued = 0;

          // If using sick hours for payment, deduct the hours worked from sick balance
          if (usingSickHours) {
            newSickBalance = currentSickBalance - totalHoursForThisSession;
            if (newSickBalance < 0) {
              toast({
                variant: "destructive",
                title: "Insufficient Sick Hours",
                description: `Employee only has ${currentSickBalance.toFixed(
                  2,
                )} sick hours available. Cannot use sick hours for payment.`,
              });
              return;
            }
          } else {
            // Only accrue sick hours if not using them for payment
            // Calculate sick hours accrued (1 hour per 40 hours worked)
            sickHoursAccrued = totalHoursForThisSession / 40;
            newSickBalance = currentSickBalance + sickHoursAccrued;
          }

          const employeeRef = doc(firestore, "employees", employee.id);
          batch.update(employeeRef, {
            totalHoursWorked: newTotalHours,
            sickHoursBalance: newSickBalance,
          });

          await batch.commit();
          playSound("clock-out");

          let description = `Clocked out ${
            employee.name
          }. Worked ${totalHoursForThisSession.toFixed(2)} hrs.`;
          if (usingSickHours) {
            description += ` Used sick hours for payment. New balance: ${newSickBalance.toFixed(
              2,
            )} hrs.`;
          } else {
            description += ` Accrued ${sickHoursAccrued.toFixed(
              2,
            )} sick hrs. New balance: ${newSickBalance.toFixed(2)} hrs.`;
          }

          toast({
            title: "Clock Out Successful",
            description: addOfflineIndicator(description, isOnline),
          });
        }
      } catch (serverError) {
        // When offline, Firestore operations are queued for sync
        // Only emit errors if we're online (actual permission/validation errors)
        if (isOnline) {
          const permissionError = new FirestorePermissionError({
            path: "time_entries",
            operation: "update",
            requestResourceData: { endTime: customTimestamp || new Date() },
          });
          errorEmitter.emit("permission-error", permissionError);
        } else {
          // When offline, show a user-friendly message instead of throwing
          console.warn("Clock-out operation failed offline:", serverError);
          toast({
            variant: "destructive",
            title: "Clock Out Error",
            description:
              "Unable to complete clock-out. Please try again or check your data when back online.",
          });
        }
      }
    },
    [firestore, toast, playSound, isOnline],
  );

  const recordPiecework = useCallback(
    async (
      employeeIds: string[],
      taskId: string,
      binQr: string,
      customTimestamp?: Date,
    ) => {
      if (!firestore) return;

      const newPiecework: Omit<Piecework, "id"> = {
        employeeId: employeeIds.join(","),
        taskId: taskId,
        timestamp: customTimestamp || new Date(),
        pieceCount: 1, // Assume 1 bin per scan
        pieceQrCode: binQr,
      };
      try {
        await addDoc(collection(firestore, "piecework"), newPiecework);
        playSound("piece");
        const employeeNames = employeeIds
          .map(
            (id) =>
              activeEmployees?.find((e) => e.qrCode === id)?.name || "Unknown",
          )
          .join(", ");

        toast({
          title: "Piecework Recorded",
          description: addOfflineIndicator(
            `1 piece recorded for ${employeeNames}.`,
            isOnline,
          ),
        });
      } catch (serverError) {
        const permissionError = new FirestorePermissionError({
          path: "piecework",
          operation: "create",
          requestResourceData: newPiecework,
        });
        errorEmitter.emit("permission-error", permissionError);
      }
    },
    [firestore, toast, activeEmployees, playSound, isOnline],
  );

  // New function to record piecework with quantity (no bin scanning required)
  const recordPieceworkWithQuantity = useCallback(
    async (
      employeeIds: string[],
      taskId: string,
      quantity: number,
      customTimestamp?: Date,
    ) => {
      if (!firestore) return false;

      try {
        // For multiple employees (shared piece), divide quantity among them
        const pieceCountPerEmployee = isSharedPiece
          ? quantity / employeeIds.length
          : quantity;

        // Use batch write to ensure all records are created atomically
        const batch = writeBatch(firestore);

        // Create piecework record for each employee
        for (const employeeId of employeeIds) {
          const newPiecework: Omit<Piecework, "id"> = {
            employeeId: employeeId,
            taskId: taskId,
            timestamp: customTimestamp || new Date(),
            pieceCount: pieceCountPerEmployee,
            pieceQrCode: "qr_scan_entry", // Mark as QR scanned entry
          };
          const docRef = doc(collection(firestore, "piecework"));
          batch.set(docRef, newPiecework);
        }

        // Commit all records at once
        await batch.commit();

        playSound("piece");

        // Only show toast when online (offline toast is shown in the handler)
        if (isOnline) {
          const employeeNames = employeeIds
            .map(
              (id) =>
                activeEmployees?.find((e) => e.id === id)?.name || "Unknown",
            )
            .join(", ");

          toast({
            title: "Piecework Recorded",
            description: addOfflineIndicator(
              `${quantity} piece(s) recorded for ${employeeNames}.${
                isSharedPiece
                  ? ` (${pieceCountPerEmployee.toFixed(2)} each)`
                  : ""
              }`,
              isOnline,
            ),
          });
        }
        return true;
      } catch (serverError) {
        // When offline, Firestore operations are queued for sync
        // Only emit errors if we're online (actual permission/validation errors)
        if (isOnline) {
          const permissionError = new FirestorePermissionError({
            path: "piecework",
            operation: "create",
            requestResourceData: { taskId, quantity },
          });
          errorEmitter.emit("permission-error", permissionError);
          return false;
        } else {
          // When offline, show a user-friendly message instead of throwing
          console.warn("Piecework registration failed offline:", serverError);
          toast({
            variant: "destructive",
            title: "Piecework Registration Error",
            description:
              "Unable to complete registration. Please try again or check your data when back online.",
          });
          return false;
        }
      }
    },
    [firestore, toast, activeEmployees, playSound, isOnline, isSharedPiece],
  );

  const createPastRecord = useCallback(
    async (
      employee: Employee,
      taskId: string,
      clockInTime: Date,
      clockOutTime: Date,
      piecesCount?: number,
    ) => {
      if (!firestore) return;

      // Round both times to nearest quarter hour
      const roundedClockInTime = roundToNearestQuarterHour(clockInTime);
      const roundedClockOutTime = roundToNearestQuarterHour(clockOutTime);

      // Validate times
      if (roundedClockOutTime <= roundedClockInTime) {
        toast({
          variant: "destructive",
          title: "Invalid Times",
          description: "Clock-out time must be after clock-in time.",
        });
        return;
      }

      try {
        const batch = writeBatch(firestore);

        // Close any active entries first
        const activeEntriesQuery = query(
          collection(firestore, "time_entries"),
          where("employeeId", "==", employee.id),
          where("endTime", "==", null),
        );
        const activeEntriesSnap = await getDocs(activeEntriesQuery);
        activeEntriesSnap.forEach((docSnap) => {
          // Close previous entries 1 second before new clock-in to avoid overlapping timestamps
          batch.update(docSnap.ref, {
            endTime: new Date(roundedClockInTime.getTime() - 1000),
          });
        });

        // Create the time entry with both clock-in and clock-out
        const newTimeEntryRef = doc(collection(firestore, "time_entries"));
        const newTimeEntry: Omit<TimeEntry, "id"> = {
          employeeId: employee.id,
          taskId: taskId,
          timestamp: roundedClockInTime,
          endTime: roundedClockOutTime,
          isBreak: false,
          ...(piecesCount && piecesCount > 0
            ? { piecesWorked: piecesCount }
            : {}),
          //piecesWorked: piecesCount && piecesCount > 0 ? piecesCount : undefined,
        };
        batch.set(newTimeEntryRef, newTimeEntry);

        // Update employee's totalHoursWorked and sickHoursBalance
        let hoursWorked =
          (roundedClockOutTime.getTime() - roundedClockInTime.getTime()) /
          (1000 * 60 * 60);

        // Apply meal break deduction: After 5 hours worked, deduct 30 minutes (0.5 hours) unpaid meal break
        if (hoursWorked > 5) {
          hoursWorked -= 0.5; // Deduct 30 minutes (0.5 hours)
        }

        const currentTotalHours = employee.totalHoursWorked || 0;
        const newTotalHours = currentTotalHours + hoursWorked;

        const currentSickBalance = employee.sickHoursBalance || 0;
        const sickHoursAccrued = hoursWorked / 40;
        const newSickBalance = currentSickBalance + sickHoursAccrued;

        const employeeRef = doc(firestore, "employees", employee.id);
        batch.update(employeeRef, {
          totalHoursWorked: newTotalHours,
          sickHoursBalance: newSickBalance,
        });

        await batch.commit();
        playSound("clock-in");

        let description = `Created past record for ${
          employee.name
        }. Worked ${hoursWorked.toFixed(2)} hrs.`;
        description += ` Accrued ${sickHoursAccrued.toFixed(
          2,
        )} sick hrs. New balance: ${newSickBalance.toFixed(2)} hrs.`;
        if (piecesCount && piecesCount > 0) {
          description += ` Pieces worked: ${piecesCount}.`;
        }

        toast({
          title: "Past Record Created",
          description: addOfflineIndicator(description, isOnline),
        });
      } catch (serverError) {
        const permissionError = new FirestorePermissionError({
          path: "time_entries",
          operation: "write",
          requestResourceData: { message: `Past record for ${employee.name}` },
        });
        errorEmitter.emit("permission-error", permissionError);
      }
    },
    [firestore, toast, playSound, isOnline],
  );

  const handleScanResult = useCallback(
    async (scannedData: string) => {
      if (!selectedTask) {
        toast({
          variant: "destructive",
          title: "Task not selected",
          description:
            "Please select a client, ranch, block, and task before scanning.",
        });
        return;
      }

      // Prevent processing if already processing
      if (isQrProcessing) {
        return;
      }

      const now = Date.now();

      const isDebounced = recentScans.some(
        (scan) =>
          now - scan.timestamp < DEBOUNCE_MS &&
          scan.scanData === scannedData &&
          scan.mode === scanMode,
      );

      if (isDebounced) {
        return; // Silently ignore debounced scans
      }

      setRecentScans((prev) => [
        ...prev.filter((s) => now - s.timestamp < DEBOUNCE_MS),
        { scanData: scannedData, mode: scanMode, timestamp: now },
      ]);

      const scannedEmployee = activeEmployees?.find(
        (e) => e.qrCode === scannedData,
      );

      if (scannedEmployee) {
        // Set processing state for clock-in and clock-out operations
        if (scanMode === "clock-in" || scanMode === "clock-out") {
          setIsQrProcessing(true);
        }

        try {
          // If past records mode is enabled, create both clock-in and clock-out
          if (usePastRecords) {
            if (!pastRecordClockInDate || !pastRecordClockOutDate) {
              toast({
                variant: "destructive",
                title: "Missing Times",
                description:
                  "Please set both clock-in and clock-out times for past records.",
              });
              // Reset processing state before early return
              if (scanMode === "clock-in" || scanMode === "clock-out") {
                setIsQrProcessing(false);
              }
              return;
            }

            // Check for duplicate time entries (same employee, task, clock-in and clock-out times)
            if (allTimeEntries) {
              const duplicate = allTimeEntries.find((entry) => {
                if (
                  entry.employeeId !== scannedEmployee.id ||
                  entry.taskId !== selectedTask
                ) {
                  return false;
                }

                // Check if clock-in times match (within 1 minute tolerance)
                const entryClockIn =
                  entry.timestamp instanceof Date
                    ? entry.timestamp
                    : (entry.timestamp as any)?.toDate?.()
                      ? (entry.timestamp as any).toDate()
                      : new Date(entry.timestamp as any);
                const timeDiffIn = Math.abs(
                  entryClockIn.getTime() - pastRecordClockInDate.getTime(),
                );

                // Check if clock-out times match (within 1 minute tolerance)
                if (entry.endTime) {
                  const entryClockOut =
                    entry.endTime instanceof Date
                      ? entry.endTime
                      : (entry.endTime as any)?.toDate?.()
                        ? (entry.endTime as any).toDate()
                        : new Date(entry.endTime as any);
                  const timeDiffOut = Math.abs(
                    entryClockOut.getTime() - pastRecordClockOutDate.getTime(),
                  );

                  // If both clock-in and clock-out times match within 1 minute, it's a duplicate
                  return timeDiffIn < 60000 && timeDiffOut < 60000;
                }

                return false;
              });

              if (duplicate) {
                const task = allTasks?.find((t) => t.id === selectedTask);
                const client = clients?.find((c) => c.id === task?.clientId);
                toast({
                  variant: "destructive",
                  title: "Duplicate Entry Detected",
                  description: `A time entry already exists for ${
                    scannedEmployee.name
                  } on ${format(
                    pastRecordClockInDate,
                    "PPP",
                  )} with the same clock-in and clock-out times for ${
                    task?.name || "this task"
                  } (${client?.name || "this client"}).`,
                });
                // Reset processing state before early return
                if (scanMode === "clock-in" || scanMode === "clock-out") {
                  setIsQrProcessing(false);
                }
                return;
              }
            }

            const task = allTasks?.find((t) => t.id === selectedTask);
            const piecesCount =
              task?.clientRateType === "piece"
                ? typeof pastRecordPiecesCount === "number"
                  ? pastRecordPiecesCount
                  : parseFloat(String(pastRecordPiecesCount))
                : 0;

            await createPastRecord(
              scannedEmployee,
              selectedTask,
              pastRecordClockInDate,
              pastRecordClockOutDate,
              piecesCount > 0 ? piecesCount : undefined,
            );
          } else if (scanMode === "clock-in") {
            // When offline, show toast immediately to match Manual Entry UX pattern
            // This provides instant feedback and prevents UI from appearing frozen
            // Note: Validation (same-task check) still occurs - if it fails, error toast will also appear
            // This trade-off prioritizes responsive UX over avoiding potential dual toasts
            if (!isOnline) {
              toast({
                title: "Clock In Successful",
                description: addOfflineIndicator(
                  `Clocked in ${scannedEmployee.name}.${
                    useSickHoursForPayment
                      ? " (Using sick hours for payment)"
                      : ""
                  }`,
                  isOnline,
                ),
              });
            }

            const timestamp = useManualDateTime ? manualClockInDate : undefined;

            await clockInEmployee(
              scannedEmployee,
              selectedTask,
              timestamp,
              useSickHoursForPayment,
            );
          } else if (scanMode === "clock-out") {
            // When offline, show toast immediately to match Manual Entry behavior
            if (!isOnline) {
              toast({
                title: "Clock Out Successful",
                description: addOfflineIndicator(
                  `Clocked out ${scannedEmployee.name}.`,
                  isOnline,
                ),
              });
            }

            const timestamp = useManualDateTime
              ? manualClockOutDate
              : undefined;
            await clockOutEmployee(scannedEmployee, selectedTask, timestamp);
          } else if (scanMode === "piece") {
            if (isSharedPiece) {
              setScannedSharedEmployees((prev) => {
                if (prev.includes(scannedEmployee.id)) {
                  toast({
                    variant: "destructive",
                    title: "Duplicate Employee",
                    description: `${scannedEmployee.name} is already on the list.`,
                  });
                  return prev;
                }
                toast({
                  title: "Employee Added",
                  description: `Added ${scannedEmployee.name} to group.`,
                });
                playSound("clock-in");
                return [...prev, scannedEmployee.id];
              });
            } else {
              setScannedSharedEmployees([scannedEmployee.id]);
              toast({
                title: "Employee Scanned",
                description: `${scannedEmployee.name} ready. Scan a bin.`,
              });
              playSound("clock-in");
            }
          }
        } finally {
          // Reset processing state after operation completes
          if (scanMode === "clock-in" || scanMode === "clock-out") {
            setIsQrProcessing(false);
          }
        }
      } else {
        // Not an employee QR
        if (scanMode === "piece" && scannedSharedEmployees.length > 0) {
          const employeeQrCodes = scannedSharedEmployees
            .map((id) => activeEmployees?.find((e) => e.id === id)?.qrCode)
            .filter(Boolean) as string[];
          const timestamp = useManualDateTime ? manualPieceworkDate : undefined;
          await recordPiecework(
            employeeQrCodes,
            selectedTask,
            scannedData,
            timestamp,
          );
          if (!isSharedPiece) {
            setScannedSharedEmployees([]);
          }
        } else {
          const errorMsg =
            scanMode === "piece"
              ? "Scan an employee QR code first."
              : "Not a valid employee QR code.";
          toast({
            variant: "destructive",
            title: "Invalid Scan",
            description: errorMsg,
          });
        }
      }
    },
    [
      selectedTask,
      toast,
      scanMode,
      isSharedPiece,
      activeEmployees,
      clockInEmployee,
      clockOutEmployee,
      recordPiecework,
      recentScans,
      playSound,
      scannedSharedEmployees,
      useManualDateTime,
      manualClockInDate,
      manualClockOutDate,
      manualPieceworkDate,
      useSickHoursForPayment,
      usePastRecords,
      pastRecordClockInDate,
      pastRecordClockOutDate,
      pastRecordPiecesCount,
      createPastRecord,
      allTasks,
      isQrProcessing,
      isOnline,
      allTimeEntries,
      clients,
    ],
  );

  const handlePieceworkScanResult = useCallback(
    async (scannedData: string) => {
      if (!selectedPieceworkTask) {
        toast({
          variant: "destructive",
          title: "No Piecework Task Selected",
          description:
            "Please select a piecework task in QR Scanner or Manual Entry first.",
        });
        return;
      }
      const now = Date.now();

      const isDebounced = recentScans.some(
        (scan) =>
          now - scan.timestamp < DEBOUNCE_MS &&
          scan.scanData === scannedData &&
          scan.mode === "piece",
      );

      if (isDebounced) {
        return; // Silently ignore debounced scans
      }

      setRecentScans((prev) => [
        ...prev.filter((s) => now - s.timestamp < DEBOUNCE_MS),
        { scanData: scannedData, mode: "piece", timestamp: now },
      ]);

      const scannedEmployee = activeEmployees?.find(
        (e) => e.qrCode === scannedData,
      );

      if (scannedEmployee) {
        if (isSharedPiece) {
          setScannedSharedEmployees((prev) => {
            if (prev.includes(scannedEmployee.id)) {
              toast({
                variant: "destructive",
                title: "Duplicate Employee",
                description: `${scannedEmployee.name} is already on the list.`,
              });
              return prev;
            }
            toast({
              title: "Employee Added",
              description: `Added ${scannedEmployee.name} to group.`,
            });
            playSound("clock-in");
            return [...prev, scannedEmployee.id];
          });
        } else {
          setScannedSharedEmployees([scannedEmployee.id]);
          toast({
            title: "Employee Scanned",
            description: `${scannedEmployee.name} ready. Scan a bin.`,
          });
          playSound("clock-in");
        }
      } else {
        // Not an employee QR
        if (scannedSharedEmployees.length > 0) {
          const employeeQrCodes = scannedSharedEmployees
            .map((id) => activeEmployees?.find((e) => e.id === id)?.qrCode)
            .filter(Boolean) as string[];
          const timestamp = useManualDateTime ? manualPieceworkDate : undefined;
          await recordPiecework(
            employeeQrCodes,
            selectedPieceworkTask.id,
            scannedData,
            timestamp,
          );
          if (!isSharedPiece) {
            setScannedSharedEmployees([]);
          }
        } else {
          toast({
            variant: "destructive",
            title: "Invalid Scan",
            description: "Scan an employee QR code first.",
          });
        }
      }
    },
    [
      selectedPieceworkTask,
      toast,
      isSharedPiece,
      activeEmployees,
      recordPiecework,
      recentScans,
      playSound,
      scannedSharedEmployees,
      useManualDateTime,
      manualPieceworkDate,
    ],
  );

  // New handler for piece-work tab QR scanner (validates employee is active in task)
  const handlePieceWorkTabScanResult = useCallback(
    async (scannedData: string) => {
      if (!pieceWorkSelectedTask) {
        toast({
          variant: "destructive",
          title: "No Task Selected",
          description: "Please select a piecework task first.",
        });
        return;
      }

      // Prevent processing if already processing
      if (isPieceworkQrProcessing) {
        return;
      }

      const now = Date.now();

      // Find the scanned employee first
      const scannedEmployee = activeEmployees?.find(
        (e) => e.qrCode === scannedData,
      );

      if (!scannedEmployee) {
        toast({
          variant: "destructive",
          title: "Invalid Scan",
          description: "Not a valid employee QR code.",
        });
        return;
      }

      // Check for debounce specific to this employee and task combination
      const employeeTaskKey = `${scannedEmployee.id}-${pieceWorkSelectedTask.id}`;
      const isDebounced = recentScans.some(
        (scan) =>
          now - scan.timestamp < PIECEWORK_DEBOUNCE_MS &&
          scan.scanData === employeeTaskKey &&
          scan.mode === "piecework-tab",
      );

      if (isDebounced) {
        const lastScan = recentScans.find(
          (scan) =>
            scan.scanData === employeeTaskKey && scan.mode === "piecework-tab",
        );
        const timeRemaining = lastScan
          ? Math.ceil(
              (PIECEWORK_DEBOUNCE_MS - (now - lastScan.timestamp)) / 60000,
            )
          : 3;

        toast({
          variant: "destructive",
          title: "Please Wait",
          description: `You must wait ${timeRemaining} minute(s) before recording another piece for ${scannedEmployee.name} on this task.`,
        });
        return; // Block the scan with a clear message
      }

      // Validate employee is active in the selected task
      const isEmployeeActiveInTask = activeTimeEntries?.some(
        (entry) =>
          entry.employeeId === scannedEmployee.id &&
          entry.taskId === pieceWorkSelectedTask.id &&
          entry.endTime === null,
      );

      if (!isEmployeeActiveInTask) {
        toast({
          variant: "destructive",
          title: "Employee Not Active",
          description: `${scannedEmployee.name} is not clocked into this task.`,
        });
        return;
      }

      // Add to recent scans with employee-task key
      setRecentScans((prev) => [
        ...prev.filter((s) => now - s.timestamp < PIECEWORK_DEBOUNCE_MS),
        { scanData: employeeTaskKey, mode: "piecework-tab", timestamp: now },
      ]);

      // Add employee to scanned list
      if (isSharedPiece) {
        setScannedSharedEmployees((prev) => {
          if (prev.includes(scannedEmployee.id)) {
            toast({
              variant: "destructive",
              title: "Duplicate Employee",
              description: `${scannedEmployee.name} is already on the list.`,
            });
            return prev;
          }
          toast({
            title: "Employee Added",
            description: `Added ${scannedEmployee.name} to group.`,
          });
          playSound("clock-in");
          return [...prev, scannedEmployee.id];
        });
      } else if (pieceEntryMode === "scan") {
        // Single employee mode + Scan Employees - auto-submit with 1 piece
        // Set processing state to show loading overlay
        setIsPieceworkQrProcessing(true);

        try {
          const employeeIds = [scannedEmployee.id];

          // Show toast immediately when offline
          if (!isOnline) {
            toast({
              title: "Piecework Recorded",
              description: addOfflineIndicator(
                `1 piece recorded for ${scannedEmployee.name}.`,
                isOnline,
              ),
            });
          }

          // Record the piecework
          const success = await recordPieceworkWithQuantity(
            employeeIds,
            pieceWorkSelectedTask.id,
            1,
            undefined,
          );

          if (success) {
            playSound("piece");
          }
        } finally {
          // Reset processing state after operation completes
          setIsPieceworkQrProcessing(false);
        }
      } else {
        // Manual count mode - just add to list for manual submission
        setScannedSharedEmployees([scannedEmployee.id]);
        toast({
          title: "Employee Scanned",
          description: `${scannedEmployee.name} ready for piece entry.`,
        });
        playSound("clock-in");
      }
    },
    [
      pieceWorkSelectedTask,
      toast,
      isSharedPiece,
      activeEmployees,
      activeTimeEntries,
      recentScans,
      playSound,
      isOnline,
      recordPieceworkWithQuantity,
      addOfflineIndicator,
      pieceEntryMode,
      isPieceworkQrProcessing,
    ],
  );

  const handleManualSubmit = async () => {
    if (!firestore || !selectedTask || !manualSelectedEmployee) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please complete all fields.",
      });
      return;
    }

    setIsManualSubmitting(true);

    // If past records mode is enabled, create both clock-in and clock-out
    if (usePastRecords) {
      if (!pastRecordClockInDate || !pastRecordClockOutDate) {
        toast({
          variant: "destructive",
          title: "Missing Times",
          description:
            "Please set both clock-in and clock-out times for past records.",
        });
        setIsManualSubmitting(false);
        return;
      }

      // Check for duplicate time entries (same employee, task, clock-in and clock-out times)
      if (allTimeEntries) {
        const duplicate = allTimeEntries.find((entry) => {
          if (
            entry.employeeId !== manualSelectedEmployee.id ||
            entry.taskId !== selectedTask
          ) {
            return false;
          }

          // Check if clock-in times match (within 1 minute tolerance)
          const entryClockIn =
            entry.timestamp instanceof Date
              ? entry.timestamp
              : (entry.timestamp as any)?.toDate?.()
                ? (entry.timestamp as any).toDate()
                : new Date(entry.timestamp as any);
          const timeDiffIn = Math.abs(
            entryClockIn.getTime() - pastRecordClockInDate.getTime(),
          );

          // Check if clock-out times match (within 1 minute tolerance)
          if (entry.endTime) {
            const entryClockOut =
              entry.endTime instanceof Date
                ? entry.endTime
                : (entry.endTime as any)?.toDate?.()
                  ? (entry.endTime as any).toDate()
                  : new Date(entry.endTime as any);
            const timeDiffOut = Math.abs(
              entryClockOut.getTime() - pastRecordClockOutDate.getTime(),
            );

            // If both clock-in and clock-out times match within 1 minute, it's a duplicate
            return timeDiffIn < 60000 && timeDiffOut < 60000;
          }

          return false;
        });

        if (duplicate) {
          const task = allTasks?.find((t) => t.id === selectedTask);
          const client = clients?.find((c) => c.id === task?.clientId);
          toast({
            variant: "destructive",
            title: "Duplicate Entry Detected",
            description: `A time entry already exists for ${
              manualSelectedEmployee.name
            } on ${format(
              pastRecordClockInDate,
              "PPP",
            )} with the same clock-in and clock-out times for ${
              task?.name || "this task"
            } (${client?.name || "this client"}).`,
          });
          setIsManualSubmitting(false);
          return;
        }
      }

      // Show toast and stop loading immediately when offline to allow user to continue working
      if (!isOnline) {
        toast({
          title: "Past Record Created",
          description: addOfflineIndicator(
            `Created past record for ${manualSelectedEmployee.name}.`,
            isOnline,
          ),
        });
        setIsManualSubmitting(false);
      }

      const task = allTasks?.find((t) => t.id === selectedTask);
      const piecesCount =
        task?.clientRateType === "piece"
          ? typeof pastRecordPiecesCount === "number"
            ? pastRecordPiecesCount
            : parseFloat(String(pastRecordPiecesCount))
          : 0;

      await createPastRecord(
        manualSelectedEmployee,
        selectedTask,
        pastRecordClockInDate,
        pastRecordClockOutDate,
        piecesCount > 0 ? piecesCount : undefined,
      );

      // Reset form after Firestore operation
      setManualSelectedEmployee(null);
      setManualEmployeeSearch("");
      setUseSickHoursForPayment(false);
      setPastRecordClockInDate(undefined);
      setPastRecordClockOutDate(undefined);
      setPastRecordDate(undefined);
      setPastRecordClockInTime("");
      setPastRecordClockOutTime("");
      setPastRecordPiecesCount("");

      // Only update loading state if online (offline already set to false)
      if (isOnline) {
        setIsManualSubmitting(false);
      }
    } else if (manualLogType === "clock-in") {
      // Show toast and stop loading immediately when offline to allow user to continue working
      if (!isOnline) {
        toast({
          title: "Clock In Successful",
          description: addOfflineIndicator(
            `Clocked in ${manualSelectedEmployee.name}.${
              useSickHoursForPayment ? " (Using sick hours for payment)" : ""
            }`,
            isOnline,
          ),
        });
        setIsManualSubmitting(false);
      }

      const timestamp = useManualDateTime ? manualClockInDate : undefined;
      await clockInEmployee(
        manualSelectedEmployee,
        selectedTask,
        timestamp,
        useSickHoursForPayment,
      );

      // Reset form after Firestore operation
      setManualSelectedEmployee(null);
      setManualEmployeeSearch("");
      setUseSickHoursForPayment(false);

      // Only update loading state if online (offline already set to false)
      if (isOnline) {
        setIsManualSubmitting(false);
      }
    } else if (manualLogType === "clock-out") {
      // Show toast and stop loading immediately when offline to allow user to continue working
      if (!isOnline) {
        toast({
          title: "Clock Out Successful",
          description: addOfflineIndicator(
            `Clocked out ${manualSelectedEmployee.name}.`,
            isOnline,
          ),
        });
        setIsManualSubmitting(false);
      }

      const timestamp = useManualDateTime ? manualClockOutDate : undefined;
      await clockOutEmployee(manualSelectedEmployee, selectedTask, timestamp);

      // Reset form after Firestore operation
      setManualSelectedEmployee(null);
      setManualEmployeeSearch("");
      setUseSickHoursForPayment(false);

      // Only update loading state if online (offline already set to false)
      if (isOnline) {
        setIsManualSubmitting(false);
      }
    }
  };

  const handleManualPieceSubmit = async () => {
    if (
      !firestore ||
      !selectedPieceworkTask ||
      scannedSharedEmployees.length === 0
    ) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description:
          "Please select a piecework task and scan at least one employee.",
      });
      return;
    }
    const pieceCount =
      typeof manualPieceQuantity === "number"
        ? manualPieceQuantity
        : parseFloat(String(manualPieceQuantity));
    if (isNaN(pieceCount) || pieceCount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Quantity",
        description: "Please enter a valid number of pieces.",
      });
      return;
    }

    setIsManualSubmitting(true);

    try {
      const employeeQrCodes = scannedSharedEmployees
        .map((id) => activeEmployees?.find((e) => e.id === id)?.qrCode)
        .filter(Boolean) as string[];

      if (employeeQrCodes.length > 0) {
        // When offline, show success feedback immediately and reset UI to allow user to continue
        // The Firestore writes will be queued for sync when connection is restored
        if (!isOnline) {
          const employeeNames = scannedSharedEmployees
            .map(
              (id) =>
                activeEmployees?.find((e) => e.id === id)?.name || "Unknown",
            )
            .join(", ");

          toast({
            title: "Piecework Recorded",
            description: addOfflineIndicator(
              `${pieceCount} piece(s) recorded for ${employeeNames}.`,
              isOnline,
            ),
          });

          // Queue the Firestore writes in the background before clearing state
          const timestamp = useManualDateTime ? manualPieceworkDate : undefined;
          const baseTimestamp = timestamp || new Date();
          const employeeQrCodesToRecord = [...employeeQrCodes];
          const taskId = selectedPieceworkTask.id;

          // Queue all writes asynchronously using fire-and-forget pattern
          // Firestore's built-in offline queue will handle retries when connection is restored
          (async () => {
            for (let i = 0; i < pieceCount; i++) {
              const pieceTimestamp = new Date(baseTimestamp.getTime() + i * 1000);
              await recordPiecework(
                employeeQrCodesToRecord,
                taskId,
                "manual_entry",
                pieceTimestamp,
              ).catch((error) => {
                // Firestore automatically queues writes when offline
                // This catch prevents unhandled promise rejection warnings
                console.warn("Piecework write queued for offline sync:", error);
              });
            }
          })();

          // Clear form immediately when offline to allow continued use
          setScannedSharedEmployees([]);
          setManualPieceQuantity("");
          setIsManualSubmitting(false);

          return;
        }

        // Online flow: wait for operations to complete
        const timestamp = useManualDateTime ? manualPieceworkDate : undefined;
        const baseTimestamp = timestamp || new Date();
        for (let i = 0; i < pieceCount; i++) {
          // Add a small time offset (1 second) between each piece to maintain order
          const pieceTimestamp = new Date(baseTimestamp.getTime() + i * 1000);
          await recordPiecework(
            employeeQrCodes,
            selectedPieceworkTask.id,
            "manual_entry",
            pieceTimestamp,
          );
        }
      }

      setScannedSharedEmployees([]);
      setManualPieceQuantity("");
      setIsManualSubmitting(false);
    } catch (error) {
      console.error("Error in handleManualPieceSubmit:", error);
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: "An unexpected error occurred. Please try again.",
      });
      setIsManualSubmitting(false);
    }
  };

  // Handler for piece-work tab piece submission
  const handlePieceWorkSubmit = async (overrideQuantity?: number) => {
    if (
      !firestore ||
      !pieceWorkSelectedTask ||
      scannedSharedEmployees.length === 0
    ) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a task and scan at least one employee.",
      });
      return;
    }

    const pieceCount =
      typeof overrideQuantity === "number"
        ? overrideQuantity
        : typeof manualPieceQuantity === "number"
          ? manualPieceQuantity
          : parseFloat(String(manualPieceQuantity));

    if (isNaN(pieceCount) || pieceCount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Quantity",
        description: "Please enter a valid number of pieces.",
      });
      return;
    }

    setIsManualSubmitting(true);

    try {
      // When offline, show success feedback immediately and reset UI to allow user to continue
      // The Firestore write will be queued for sync when connection is restored
      if (!isOnline) {
        const employeeNames = scannedSharedEmployees
          .map(
            (id) =>
              activeEmployees?.find((e) => e.id === id)?.name || "Unknown",
          )
          .join(", ");

        const pieceCountPerEmployee = isSharedPiece
          ? pieceCount / scannedSharedEmployees.length
          : pieceCount;

        toast({
          title: "Piecework Recorded",
          description: addOfflineIndicator(
            `${pieceCount} piece(s) recorded for ${employeeNames}.${
              isSharedPiece ? ` (${pieceCountPerEmployee.toFixed(2)} each)` : ""
            }`,
            isOnline,
          ),
        });

        // Queue the Firestore write in the background before clearing state
        const employeeIdsToRecord = [...scannedSharedEmployees];
        recordPieceworkWithQuantity(
          employeeIdsToRecord,
          pieceWorkSelectedTask.id,
          pieceCount,
          undefined,
        ).catch((error) => {
          console.warn("Background piecework sync queued for later:", error);
        });

        // Clear form immediately when offline to allow continued use
        setScannedSharedEmployees([]);
        setManualPieceQuantity("");
        setIsManualSubmitting(false);

        return;
      }

      // Online flow: wait for the operation to complete
      const success = await recordPieceworkWithQuantity(
        scannedSharedEmployees,
        pieceWorkSelectedTask.id,
        pieceCount,
        undefined,
      );

      if (success) {
        setScannedSharedEmployees([]);
        setManualPieceQuantity("");
      }

      setIsManualSubmitting(false);
    } catch (error) {
      console.error("Error in handlePieceWorkSubmit:", error);
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: "An unexpected error occurred. Please try again.",
      });
      setIsManualSubmitting(false);
    }
  };

  const handleBulkClockOut = async () => {
    if (!firestore || !selectedBulkTask) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a task.",
      });
      return;
    }

    setIsBulkClockingOut(true);
    const timeLogsRef = collection(firestore, "time_entries");
    const q = query(
      timeLogsRef,
      where("taskId", "==", selectedBulkTask),
      where("endTime", "==", null),
    );

    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        toast({
          title: "No one to clock out",
          description: "No employees are currently clocked in for this task.",
        });
        setIsBulkClockingOut(false);
        return;
      }

      const timestamp =
        useBulkClockOutManualDateTime && bulkClockOutDate
          ? roundToNearestQuarterHour(bulkClockOutDate)
          : roundToNearestQuarterHour(new Date());
      const updatedData = { endTime: timestamp };
      const batch = writeBatch(firestore);
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, updatedData);
      });

      // ✅ OFFLINE: mostrar toast y terminar UI sin esperar
      if (!isOnline) {
        batch.commit().catch((err) => {
          console.warn("Bulk clock out queued for sync:", err);
        });

        toast({
          title: "Bulk Clock Out Queued",
          description: addOfflineIndicator(
            `Clock out queued for ${querySnapshot.size} employee(s).`,
            isOnline,
          ),
        });

        setIsBulkClockingOut(false);
        return;
      }

      await batch.commit();

      toast({
        title: "Bulk Clock Out Successful",
        description: addOfflineIndicator(
          `Successfully clocked out ${querySnapshot.size} employee(s) from the task.`,
          isOnline,
        ),
      });
    } catch (serverError) {
      if (isOnline) {
        const permissionError = new FirestorePermissionError({
          path: "time_entries",
          operation: "update",
          requestResourceData: {
            message: `Bulk clock out`,
            data: {
              endTime:
                useBulkClockOutManualDateTime && bulkClockOutDate
                  ? bulkClockOutDate
                  : new Date(),
            },
          },
        });
        errorEmitter.emit("permission-error", permissionError);
      }
    } finally {
      setIsBulkClockingOut(false);
    }
  };

  const handleBulkClockIn = async () => {
    if (
      !firestore ||
      !selectedBulkInTask ||
      selectedBulkInEmployees.size === 0
    ) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a task and at least one employee.",
      });
      return;
    }
    setIsBulkClockingIn(true);

    try {
      const batch = writeBatch(firestore);
      const clockInTimestamp =
        useBulkClockInManualDateTime && bulkClockInDate
          ? roundToNearestQuarterHour(bulkClockInDate)
          : roundToNearestQuarterHour(new Date());

      const clockOutTimestamp = clockInTimestamp;

      const activeEntriesQuery = query(
        collection(firestore, "time_entries"),
        where("employeeId", "in", Array.from(selectedBulkInEmployees)),
        where("endTime", "==", null),
      );
      const activeEntriesSnap = await getDocs(activeEntriesQuery);

      activeEntriesSnap.forEach((doc) => {
        batch.update(doc.ref, { endTime: clockOutTimestamp });
      });

      selectedBulkInEmployees.forEach((employeeId) => {
        const newTimeEntryRef = doc(collection(firestore, "time_entries"));
        const newTimeEntry: Omit<TimeEntry, "id"> = {
          employeeId: employeeId,
          taskId: selectedBulkInTask,
          timestamp: clockInTimestamp,
          endTime: null,
          isBreak: false,
        };
        batch.set(newTimeEntryRef, newTimeEntry);
      });

      // ✅ OFFLINE: mostrar toast y terminar UI sin esperar
      if (!isOnline) {
        batch.commit().catch((err) => {
          console.warn("Bulk clock in queued for sync:", err);
        });

        toast({
          title: "Bulk Clock In Queued",
          description: addOfflineIndicator(
            `Clock in queued for ${selectedBulkInEmployees.size} employee(s).`,
            isOnline,
          ),
        });

        setSelectedBulkInEmployees(new Set());
        setIsBulkClockingIn(false);
        return;
      }

      await batch.commit();

      toast({
        title: "Bulk Clock In Successful",
        description: addOfflineIndicator(
          `Successfully clocked in ${selectedBulkInEmployees.size} employee(s).`,
          isOnline,
        ),
      });
      setSelectedBulkInEmployees(new Set());
    } catch (serverError) {
      if (isOnline) {
        const permissionError = new FirestorePermissionError({
          path: "time_entries",
          operation: "write",
          requestResourceData: {
            message: `Bulk clock in for ${selectedBulkInEmployees.size} employees`,
          },
        });
        errorEmitter.emit("permission-error", permissionError);
      }
    } finally {
      setIsBulkClockingIn(false);
    }
  };

  const handleDeleteTimeEntry = async (entryId: string) => {
    if (!firestore) return;

    try {
      await deleteDoc(doc(firestore, "time_entries", entryId));

      toast({
        title: "Entry Deleted",
        description: addOfflineIndicator(
          "Time entry has been successfully deleted.",
          isOnline,
        ),
      });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: "time_entries",
        operation: "delete",
        requestResourceData: { entryId },
      });
      errorEmitter.emit("permission-error", permissionError);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Failed to delete the time entry.",
      });
    }
  };

  const handleDeletePiecework = async (pieceworkId: string) => {
    if (!firestore) return;

    try {
      await deleteDoc(doc(firestore, "piecework", pieceworkId));

      toast({
        title: "Piecework Deleted",
        description: addOfflineIndicator(
          "Piecework record has been successfully deleted.",
          isOnline,
        ),
      });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: "piecework",
        operation: "delete",
        requestResourceData: { pieceworkId },
      });
      errorEmitter.emit("permission-error", permissionError);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Failed to delete the piecework record.",
      });
    }
  };

  const handleEditTimeEntry = async () => {
    if (!firestore || !editTarget || editTarget.type !== "time") return;

    if (!editTimestamp) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Clock-in time is required.",
      });
      return;
    }

    if (!editTaskId) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Task is required.",
      });
      return;
    }

    if (editEndTime && editEndTime < editTimestamp) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Clock-out time cannot be before clock-in time.",
      });
      return;
    }

    try {
      const updateData: any = {
        timestamp: editTimestamp,
        paymentModality: editPaymentModality,
        taskId: editTaskId,
      };

      if (editEndTime) {
        updateData.endTime = editEndTime;
      }

      const pieces =
        typeof editPiecesWorked === "string"
          ? parseFloat(editPiecesWorked) || 0
          : editPiecesWorked || 0;
      updateData.piecesWorked = pieces;

      // Update the time entry
      await updateDoc(
        doc(firestore, "time_entries", editTarget.entry.id),
        updateData,
      );

      // Update all related piecework records
      for (const piece of editRelatedPiecework) {
        const validPieceCount =
          typeof piece.pieceCount === "number"
            ? piece.pieceCount
            : parseFloat(String(piece.pieceCount)) || 0;

        await updateDoc(doc(firestore, "piecework", piece.id), {
          pieceCount: validPieceCount,
          // Keep the timestamp and other fields as they were
        });
      }

      toast({
        title: "Entry Updated",
        description: addOfflineIndicator(
          "Time entry and all pieces have been successfully updated.",
          isOnline,
        ),
      });
      setEditDialogOpen(false);
      setEditTarget(null);
      setEditTimestamp(undefined);
      setEditEndTime(undefined);
      setEditPiecesWorked(0);
      setEditPaymentModality("Hourly");
      setEditTaskId("");
      setEditClient("");
      setEditRanch("");
      setEditBlock("");
      setEditRelatedPiecework([]);
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: "time_entries",
        operation: "update",
        requestResourceData: { entryId: editTarget.entry.id },
      });
      errorEmitter.emit("permission-error", permissionError);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update the time entry.",
      });
    }
  };

  const handleEditPiecework = async () => {
    if (!firestore || !editTarget || editTarget.type !== "piecework") return;

    if (!editTimestamp) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Timestamp is required.",
      });
      return;
    }

    if (!editTaskId) {
      toast({
        variant: "destructive",
        title: "Invalid Data",
        description: "Task is required.",
      });
      return;
    }

    // Validate piece count
    const pieceCount =
      typeof editPieceCount === "number"
        ? editPieceCount
        : parseFloat(String(editPieceCount));
    if (isNaN(pieceCount) || pieceCount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Quantity",
        description: "Please enter a valid piece count (can include decimals).",
      });
      return;
    }

    try {
      await updateDoc(doc(firestore, "piecework", editTarget.entry.id), {
        timestamp: editTimestamp,
        pieceCount: pieceCount,
        taskId: editTaskId,
      });

      toast({
        title: "Piecework Updated",
        description: addOfflineIndicator(
          "Piecework record has been successfully updated.",
          isOnline,
        ),
      });
      setEditDialogOpen(false);
      setEditTarget(null);
      setEditTimestamp(undefined);
      setEditPieceCount(1);
      setEditTaskId("");
      setEditClient("");
      setEditRanch("");
      setEditBlock("");
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: "piecework",
        operation: "update",
        requestResourceData: { pieceworkId: editTarget.entry.id },
      });
      errorEmitter.emit("permission-error", permissionError);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update the piecework record.",
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "time") {
      handleDeleteTimeEntry(deleteTarget.id);
    } else {
      handleDeletePiecework(deleteTarget.id);
    }
  };

  const handleDeleteAllMovements = async () => {
    if (!firestore) return;

    // Check if filters are applied
    const hasFilters = historyStartDate || historyEndDate || historyNameFilter;

    // If no filters, require password
    if (!hasFilters) {
      if (deleteAllPassword !== "4321") {
        toast({
          variant: "destructive",
          title: "Incorrect Password",
          description:
            "You must enter the correct password to delete all unfiltered records.",
        });
        setIsDeletingAll(false);
        return;
      }
    }

    setIsDeletingAll(true);

    try {
      const batch = writeBatch(firestore);
      let deleteCount = 0;

      // Delete only the filtered/visible records
      if (filteredMergedRecords && filteredMergedRecords.length > 0) {
        filteredMergedRecords.forEach((record) => {
          if (record.type === "time") {
            const entryRef = doc(firestore, "time_entries", record.data.id);
            batch.delete(entryRef);
            deleteCount++;
          } else {
            const pieceRef = doc(firestore, "piecework", record.data.id);
            batch.delete(pieceRef);
            deleteCount++;
          }
        });
      }

      if (deleteCount > 0) {
        await batch.commit();

        toast({
          title: "Movements Deleted",
          description: addOfflineIndicator(
            `Successfully deleted ${deleteCount} record(s).${
              hasFilters ? " (Filtered records only)" : " (All records)"
            }`,
            isOnline,
          ),
        });
      } else {
        toast({
          title: "No Records to Delete",
          description: "There are no movements matching the current filter.",
        });
      }

      setDeleteAllConfirmOpen(false);
      setDeleteAllPassword("");
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: "time_entries, piecework",
        operation: "delete",
        requestResourceData: { message: "Bulk delete all movements" },
      });
      errorEmitter.emit("permission-error", permissionError);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Failed to delete all movements.",
      });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleLogSickLeave = async () => {
    if (!firestore || !manualSelectedEmployee) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select an employee.",
      });
      return;
    }

    const hours =
      typeof sickHoursToUse === "number"
        ? sickHoursToUse
        : parseFloat(String(sickHoursToUse));

    if (isNaN(hours) || hours <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Hours",
        description: "Please enter a valid number of hours.",
      });
      return;
    }

    const availableHours = manualSelectedEmployee.sickHoursBalance || 0;
    if (hours > availableHours) {
      toast({
        variant: "destructive",
        title: "Insufficient Sick Hours",
        description: `Employee only has ${availableHours.toFixed(
          2,
        )} sick hours available.`,
      });
      return;
    }

    if (!sickLeaveDate) {
      toast({
        variant: "destructive",
        title: "Missing Date",
        description: "Please select a date for the absence.",
      });
      return;
    }

    setIsLoggingSickLeave(true);

    try {
      // Create a time entry marking sick leave
      const [year, month, day] = sickLeaveDate.split("-").map(Number);
      const leaveDate = new Date(year, month - 1, day, 8, 0, 0); // Default to 8 AM
      const endDate = new Date(leaveDate);
      endDate.setHours(leaveDate.getHours() + hours);

      // Find a default task or create a "Sick Leave" marker
      // For now, we'll use the first active task or require task selection
      const defaultTask = allTasks?.find((t) => t.status === "Active");

      if (!defaultTask) {
        toast({
          variant: "destructive",
          title: "No Active Task",
          description:
            "Please create an active task before logging sick leave.",
        });
        setIsLoggingSickLeave(false);
        return;
      }

      const sickLeaveEntry: Omit<TimeEntry, "id"> = {
        employeeId: manualSelectedEmployee.id,
        taskId: defaultTask.id,
        timestamp: leaveDate,
        endTime: endDate,
        isBreak: false,
        isSickLeave: true,
        sickHoursUsed: hours,
      };

      await addDoc(collection(firestore, "time_entries"), sickLeaveEntry);

      // Update employee's sick hours balance
      const newBalance = availableHours - hours;
      await updateDoc(doc(firestore, "employees", manualSelectedEmployee.id), {
        sickHoursBalance: newBalance,
      });

      toast({
        title: "Sick Leave Logged",
        description: addOfflineIndicator(
          `${hours} sick hours logged for ${
            manualSelectedEmployee.name
          }. New balance: ${newBalance.toFixed(2)} hrs`,
          isOnline,
        ),
      });

      // Reset form
      setSickHoursToUse(0);
      setSickLeaveDate("");
      setSickLeaveNotes("");
      setManualSelectedEmployee(null);
      setManualEmployeeSearch("");
    } catch (error) {
      console.error("Error logging sick leave:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log sick leave. Please try again.",
      });
    } finally {
      setIsLoggingSickLeave(false);
    }
  };

  const SelectionFields = ({
    isManual = false,
    filterPiecework = false,
  }: {
    isManual?: boolean;
    filterPiecework?: boolean;
  }) => {
    // Filter tasks based on whether we're in piecework mode
    const displayTasks = filterPiecework
      ? filteredTasks.filter((t) => t.clientRateType === "piece")
      : filteredTasks;

    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
          isManual ? "p-4 border rounded-md" : ""
        }`}
      >
        <div className="space-y-2">
          <Label htmlFor={`client-select-${isManual}`}>Client</Label>
          <Select
            value={selectedClient || ""}
            onValueChange={(value) =>
              setSelectedClient(value === CLEAR_SELECTION_VALUE ? "" : value)
            }
          >
            <SelectTrigger id={`client-select-${isManual}`}>
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CLEAR_SELECTION_VALUE}>
                -- Clear selection --
              </SelectItem>
              {clients?.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`ranch-select-${isManual}`}>Ranch</Label>
          <Select
            value={selectedRanch || ""}
            onValueChange={(value) =>
              setSelectedRanch(value === CLEAR_SELECTION_VALUE ? "" : value)
            }
            disabled={!selectedClient || ranches.length === 0}
          >
            <SelectTrigger id={`ranch-select-${isManual}`}>
              <SelectValue placeholder="Select a ranch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CLEAR_SELECTION_VALUE}>
                -- Clear selection --
              </SelectItem>
              {ranches.map((ranch) => (
                <SelectItem key={ranch} value={ranch}>
                  {ranch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`block-select-${isManual}`}>Block</Label>
          <Select
            value={selectedBlock || ""}
            onValueChange={(value) =>
              setSelectedBlock(value === CLEAR_SELECTION_VALUE ? "" : value)
            }
            disabled={!selectedRanch || blocks.length === 0}
          >
            <SelectTrigger id={`block-select-${isManual}`}>
              <SelectValue placeholder="Select a block" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CLEAR_SELECTION_VALUE}>
                -- Clear selection --
              </SelectItem>
              {blocks.map((block) => (
                <SelectItem key={block} value={block}>
                  {block}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`task-select-${isManual}`}>Task</Label>
          <Select
            value={selectedTask || ""}
            onValueChange={(value) =>
              setSelectedTask(value === CLEAR_SELECTION_VALUE ? "" : value)
            }
            disabled={displayTasks.length === 0}
          >
            <SelectTrigger id={`task-select-${isManual}`}>
              <SelectValue placeholder="Select a task" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CLEAR_SELECTION_VALUE}>
                -- Clear selection --
              </SelectItem>
              {displayTasks?.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.name} ({task.variety}) -{" "}
                  {task.clientRateType === "piece"
                    ? "📦 Piecework"
                    : "⏰ Hourly"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="qr-scanner" className="text-xs sm:text-sm">
            <QrCode className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">QR Scanner</span>
            <span className="sm:hidden">Scanner</span>
          </TabsTrigger>
          <TabsTrigger value="manual-entry" className="text-xs sm:text-sm">
            <ClipboardEdit className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Manual Entry</span>
            <span className="sm:hidden">Manual</span>
          </TabsTrigger>
          <TabsTrigger value="piece-work" className="text-xs sm:text-sm">
            <Package className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Piece-Work</span>
            <span className="sm:hidden">Pieces</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">
            <History className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
          <TabsTrigger value="test" className="text-xs sm:text-sm">
            <div className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full" />
            <span className="hidden sm:inline">Sound Test</span>
            <span className="sm:hidden">Test</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="qr-scanner">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">
                QR Code Scanner
              </CardTitle>
              <CardDescription className="text-sm">
                Select task and mode. Actions are processed automatically upon
                valid scan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4">
              <SelectionFields />

              <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="past-records-checkbox"
                    checked={usePastRecords}
                    onCheckedChange={(checked: boolean) => {
                      setUsePastRecords(checked);
                      if (!checked) {
                        setPastRecordClockInDate(undefined);
                        setPastRecordClockOutDate(undefined);
                        setPastRecordDate(undefined);
                        setPastRecordClockInTime("");
                        setPastRecordClockOutTime("");
                        setPastRecordPiecesCount("");
                      }
                      // Reset other modes when enabling past records
                      if (checked) {
                        setUseManualDateTime(false);
                        setManualClockInDate(undefined);
                        setManualClockOutDate(undefined);
                      }
                    }}
                  />
                  <Label
                    htmlFor="past-records-checkbox"
                    className="font-semibold"
                  >
                    Use Manual Date/Time for Past Records
                  </Label>
                </div>
                {usePastRecords && (
                  <div className="space-y-3 pt-2">
                    {/* Single Date Picker */}
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${
                              !pastRecordDate && "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pastRecordDate ? (
                              format(pastRecordDate, "PPP")
                            ) : (
                              <span>Select date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarUI
                            mode="single"
                            selected={pastRecordDate}
                            onSelect={setPastRecordDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Clock-In Time */}
                    <div className="space-y-2">
                      <Label htmlFor="past-clock-in-time">Clock-In Time</Label>
                      <Input
                        id="past-clock-in-time"
                        type="time"
                        value={pastRecordClockInTime}
                        onChange={(e) =>
                          setPastRecordClockInTime(e.target.value)
                        }
                        placeholder="Select clock-in time"
                      />
                    </div>

                    {/* Clock-Out Time */}
                    <div className="space-y-2">
                      <Label htmlFor="past-clock-out-time">
                        Clock-Out Time
                      </Label>
                      <Input
                        id="past-clock-out-time"
                        type="time"
                        value={pastRecordClockOutTime}
                        onChange={(e) =>
                          setPastRecordClockOutTime(e.target.value)
                        }
                        placeholder="Select clock-out time"
                      />
                    </div>

                    {selectedTask &&
                      allTasks?.find((t) => t.id === selectedTask)
                        ?.clientRateType === "piece" && (
                        <div className="space-y-2">
                          <Label htmlFor="past-pieces-count">
                            Pieces Completed
                          </Label>
                          <Input
                            id="past-pieces-count"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Enter number of pieces"
                            value={pastRecordPiecesCount}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPastRecordPiecesCount(
                                value === "" ? "" : parseFloat(value),
                              );
                            }}
                          />
                        </div>
                      )}
                  </div>
                )}
              </div>

              <div className="p-4 border rounded-lg space-y-4 bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use-sick-hours-checkbox"
                    checked={useSickHoursForPayment}
                    onCheckedChange={(checked: boolean) => {
                      setUseSickHoursForPayment(checked);
                    }}
                  />
                  <Label
                    htmlFor="use-sick-hours-checkbox"
                    className="font-semibold text-blue-900 dark:text-blue-100"
                  >
                    Use Sick Hours for Payment
                  </Label>
                </div>
                {useSickHoursForPayment && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    ⚠️ The hours worked in this shift will be deducted from the
                    employee's sick hours balance when they clock out.
                  </p>
                )}
              </div>

              {!usePastRecords && (
                <>
                  {/* <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="manual-datetime-checkbox"
                        checked={useManualDateTime}
                        onCheckedChange={(checked: boolean) => {
                          setUseManualDateTime(checked);
                          if (!checked) {
                            setManualClockInDate(undefined);
                            setManualClockOutDate(undefined);
                            setManualPieceworkDate(undefined);
                          }
                        }}
                      />
                      <Label
                        htmlFor="manual-datetime-checkbox"
                        className="font-semibold"
                      >
                        Use Manual Date/Time
                      </Label>
                    </div>
                    {useManualDateTime && (
                      <div className="space-y-3 pt-2">
                        {scanMode === "clock-in" && (
                          <DateTimePicker
                            date={manualClockInDate}
                            setDate={setManualClockInDate}
                            label="Clock-In Date & Time"
                            placeholder="Select date and time for clock-in"
                          />
                        )}
                        {scanMode === "clock-out" && (
                          <DateTimePicker
                            date={manualClockOutDate}
                            setDate={setManualClockOutDate}
                            label="Clock-Out Date & Time"
                            placeholder="Select date and time for clock-out"
                          />
                        )}
                        {scanMode === "piece" && (
                          <DateTimePicker
                            date={manualPieceworkDate}
                            setDate={setManualPieceworkDate}
                            label="Piecework Date & Time"
                            placeholder="Select date and time for piecework"
                          />
                        )}
                      </div>
                    )}
                  </div> */}

                  {!usePastRecords && (
                    <div className="space-y-3 md:space-y-4 rounded-lg border bg-card text-card-foreground shadow-sm p-3 md:p-4">
                      <Label className="font-semibold">Scan Mode</Label>
                      <RadioGroup
                        value={scanMode}
                        onValueChange={(value: string) =>
                          setScanMode(value as ScanMode)
                        }
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4"
                      >
                        <Label
                          htmlFor="mode-clock-in"
                          className="flex flex-1 items-center gap-2 md:gap-3 rounded-md border p-2 md:p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
                        >
                          <RadioGroupItem value="clock-in" id="mode-clock-in" />
                          <div className="flex items-center gap-1 md:gap-2">
                            <LogIn className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                            <p className="font-medium text-sm md:text-base">
                              Clock In
                            </p>
                          </div>
                        </Label>
                        <Label
                          htmlFor="mode-clock-out"
                          className="flex flex-1 items-center gap-2 md:gap-3 rounded-md border p-2 md:p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
                        >
                          <RadioGroupItem
                            value="clock-out"
                            id="mode-clock-out"
                          />
                          <div className="flex items-center gap-1 md:gap-2">
                            <LogOut className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
                            <p className="font-medium text-sm md:text-base">
                              Clock Out
                            </p>
                          </div>
                        </Label>
                      </RadioGroup>
                    </div>
                  )}
                </>
              )}

              {/* Pieces Completed input for piecework tasks in clock-in mode */}

              <QrScanner
                onScanResult={handleScanResult}
                isProcessing={isQrProcessing}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="manual-entry">
          <Card>
            <CardHeader>
              <CardTitle>Manual Log Entry</CardTitle>
              <CardDescription>
                Manually log time or piecework if QR codes are unavailable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SelectionFields isManual={true} />

              <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="past-records-checkbox-manual"
                    checked={usePastRecords}
                    onCheckedChange={(checked: boolean) => {
                      setUsePastRecords(checked);
                      if (!checked) {
                        setPastRecordClockInDate(undefined);
                        setPastRecordClockOutDate(undefined);
                        setPastRecordDate(undefined);
                        setPastRecordClockInTime("");
                        setPastRecordClockOutTime("");
                        setPastRecordPiecesCount("");
                      }
                      // Reset other modes when enabling past records
                      if (checked) {
                        setUseManualDateTime(false);
                        setManualClockInDate(undefined);
                        setManualClockOutDate(undefined);
                      }
                    }}
                  />
                  <Label
                    htmlFor="past-records-checkbox-manual"
                    className="font-semibold"
                  >
                    Use Manual Date/Time for Past Records
                  </Label>
                </div>
                {usePastRecords && (
                  <div className="space-y-3 pt-2">
                    {/* Single Date Picker */}
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${
                              !pastRecordDate && "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pastRecordDate ? (
                              format(pastRecordDate, "PPP")
                            ) : (
                              <span>Select date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarUI
                            mode="single"
                            selected={pastRecordDate}
                            onSelect={setPastRecordDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Clock-In Time */}
                    <div className="space-y-2">
                      <Label htmlFor="past-clock-in-time-manual">
                        Clock-In Time
                      </Label>
                      <Input
                        id="past-clock-in-time-manual"
                        type="time"
                        value={pastRecordClockInTime}
                        onChange={(e) =>
                          setPastRecordClockInTime(e.target.value)
                        }
                        placeholder="Select clock-in time"
                      />
                    </div>

                    {/* Clock-Out Time */}
                    <div className="space-y-2">
                      <Label htmlFor="past-clock-out-time-manual">
                        Clock-Out Time
                      </Label>
                      <Input
                        id="past-clock-out-time-manual"
                        type="time"
                        value={pastRecordClockOutTime}
                        onChange={(e) =>
                          setPastRecordClockOutTime(e.target.value)
                        }
                        placeholder="Select clock-out time"
                      />
                    </div>

                    {selectedTask &&
                      allTasks?.find((t) => t.id === selectedTask)
                        ?.clientRateType === "piece" && (
                        <div className="space-y-2">
                          <Label htmlFor="past-pieces-count-manual">
                            Pieces Completed
                          </Label>
                          <Input
                            id="past-pieces-count-manual"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Enter number of pieces"
                            value={pastRecordPiecesCount}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPastRecordPiecesCount(
                                value === "" ? "" : parseFloat(value),
                              );
                            }}
                          />
                        </div>
                      )}
                  </div>
                )}
              </div>
              <div className="p-4 border rounded-lg space-y-4 bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use-sick-hours-checkbox-manual"
                    checked={useSickHoursForPayment}
                    onCheckedChange={(checked: boolean) => {
                      setUseSickHoursForPayment(checked);
                    }}
                  />
                  <Label
                    htmlFor="use-sick-hours-checkbox-manual"
                    className="font-semibold text-blue-900 dark:text-blue-100"
                  >
                    Use Sick Hours for Payment
                  </Label>
                </div>
                {useSickHoursForPayment && (
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    ⚠️ The hours worked in this shift will be deducted from the
                    employee's sick hours balance when they clock out.
                  </p>
                )}
              </div>
              {!usePastRecords && (
                <>
                  {/*  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="manual-datetime-checkbox-entry"
                        checked={useManualDateTime}
                        onCheckedChange={(checked: boolean) => {
                          setUseManualDateTime(checked);
                          if (!checked) {
                            setManualClockInDate(undefined);
                            setManualClockOutDate(undefined);
                            setManualPieceworkDate(undefined);
                          }
                        }}
                      />
                      <Label
                        htmlFor="manual-datetime-checkbox-entry"
                        className="font-semibold"
                      >
                        Use Manual Date/Time
                      </Label>
                    </div>
                    {useManualDateTime && (
                      <div className="space-y-3 pt-2">
                        {manualLogType === "clock-in" && (
                          <DateTimePicker
                            date={manualClockInDate}
                            setDate={setManualClockInDate}
                            label="Clock-In Date & Time"
                            placeholder="Select date and time for clock-in"
                          />
                        )}
                        {manualLogType === "clock-out" && (
                          <DateTimePicker
                            date={manualClockOutDate}
                            setDate={setManualClockOutDate}
                            label="Clock-Out Date & Time"
                            placeholder="Select date and time for clock-out"
                          />
                        )}
                        {manualLogType === "piecework" && (
                          <DateTimePicker
                            date={manualPieceworkDate}
                            setDate={setManualPieceworkDate}
                            label="Piecework Date & Time"
                            placeholder="Select date and time for piecework"
                          />
                        )}
                      </div>
                    )}
                  </div> */}

                  {!usePastRecords && (
                    <div className="space-y-2">
                      <Label htmlFor="log-type">Log Type</Label>
                      <Select
                        value={manualLogType}
                        onValueChange={(v: string) =>
                          setManualLogType(v as ManualLogType)
                        }
                      >
                        <SelectTrigger id="log-type">
                          <SelectValue placeholder="Select log type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clock-in">Clock In</SelectItem>
                          <SelectItem value="clock-out">Clock Out</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="employee-search">Employee</Label>
                {manualSelectedEmployee ? (
                  <div className="flex items-center gap-2 rounded-md border p-2 bg-muted">
                    <User className="h-4 w-4" />
                    <span>{manualSelectedEmployee.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setManualSelectedEmployee(null);
                        setManualEmployeeSearch("");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="employee-search"
                      placeholder="Search for an active employee..."
                      value={manualEmployeeSearch}
                      onChange={(e) => setManualEmployeeSearch(e.target.value)}
                    />
                    {manualEmployeeSearch &&
                      filteredManualEmployees &&
                      filteredManualEmployees.length > 0 && (
                        <div className="border rounded-md max-h-48 overflow-y-auto">
                          {filteredManualEmployees.map((employee) => (
                            <Button
                              key={employee.id}
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => {
                                setManualSelectedEmployee(employee);
                                setManualEmployeeSearch(employee.name);
                              }}
                            >
                              {employee.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    {manualEmployeeSearch &&
                      filteredManualEmployees &&
                      filteredManualEmployees.length === 0 && (
                        <p className="p-4 text-sm text-muted-foreground">
                          No employees found.
                        </p>
                      )}
                  </>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleManualSubmit}
                disabled={
                  isManualSubmitting || !manualSelectedEmployee || !selectedTask
                }
              >
                {isManualSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Log
              </Button>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Bulk Clock In</CardTitle>
              <CardDescription>
                Clock in multiple employees for a single task.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/*    <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bulk-clock-in-manual-datetime-checkbox"
                    checked={useBulkClockInManualDateTime}
                    onCheckedChange={(checked: boolean) => {
                      setUseBulkClockInManualDateTime(checked);
                      if (!checked) {
                        setBulkClockInDate(undefined);
                      }
                    }}
                  />
                  <Label
                    htmlFor="bulk-clock-in-manual-datetime-checkbox"
                    className="font-semibold"
                  >
                    Use Manual Date/Time
                  </Label>
                </div>
                {useBulkClockInManualDateTime && (
                  <div className="pt-2">
                    <DateTimePicker
                      date={bulkClockInDate}
                      setDate={setBulkClockInDate}
                      label="Clock-In Date & Time"
                      placeholder="Select date and time for bulk clock-in"
                    />
                  </div>
                )}
              </div> */}

              <div className="space-y-2">
                <Label htmlFor="bulk-in-task-select">Task</Label>
                <Select
                  value={selectedBulkInTask}
                  onValueChange={setSelectedBulkInTask}
                >
                  <SelectTrigger id="bulk-in-task-select">
                    <SelectValue placeholder="Select a task for bulk clock-in" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTasks
                      ?.filter((t) => t.status === "Active")
                      .map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.name} (
                          {clients?.find((c) => c.id === task.clientId)?.name})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedBulkInTask && activeEmployees && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Select Employees</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all-bulk-in"
                        checked={
                          selectedBulkInEmployees.size ===
                          activeEmployees.length
                        }
                        onCheckedChange={(checked: boolean) => {
                          if (checked) {
                            setSelectedBulkInEmployees(
                              new Set(activeEmployees.map((e) => e.id)),
                            );
                          } else {
                            setSelectedBulkInEmployees(new Set());
                          }
                        }}
                      />
                      <Label
                        htmlFor="select-all-bulk-in"
                        className="text-sm font-medium"
                      >
                        Select All
                      </Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border rounded-md p-4 max-h-60 overflow-y-auto">
                    {activeEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`bulk-in-${employee.id}`}
                          checked={selectedBulkInEmployees.has(employee.id)}
                          onCheckedChange={(checked: boolean) => {
                            setSelectedBulkInEmployees((prev) => {
                              const newSet = new Set(prev);
                              if (checked) {
                                newSet.add(employee.id);
                              } else {
                                newSet.delete(employee.id);
                              }
                              return newSet;
                            });
                          }}
                        />
                        <Label
                          htmlFor={`bulk-in-${employee.id}`}
                          className="text-sm font-normal"
                        >
                          {employee.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleBulkClockIn}
                disabled={
                  isBulkClockingIn ||
                  !selectedBulkInTask ||
                  selectedBulkInEmployees.size === 0
                }
              >
                {isBulkClockingIn && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Clock In{" "}
                {selectedBulkInEmployees.size > 0
                  ? selectedBulkInEmployees.size
                  : ""}{" "}
                Employees
              </Button>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Bulk Clock Out</CardTitle>
              <CardDescription>
                Clock out all employees currently working on a specific task.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/*  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bulk-clock-out-manual-datetime-checkbox"
                    checked={useBulkClockOutManualDateTime}
                    onCheckedChange={(checked: boolean) => {
                      setUseBulkClockOutManualDateTime(checked);
                      if (!checked) {
                        setBulkClockOutDate(undefined);
                      }
                    }}
                  />
                  <Label
                    htmlFor="bulk-clock-out-manual-datetime-checkbox"
                    className="font-semibold"
                  >
                    Use Manual Date/Time
                  </Label>
                </div>
                {useBulkClockOutManualDateTime && (
                  <div className="pt-2">
                    <DateTimePicker
                      date={bulkClockOutDate}
                      setDate={setBulkClockOutDate}
                      label="Clock-Out Date & Time"
                      placeholder="Select date and time for bulk clock-out"
                    />
                  </div>
                )}
              </div> */}

              {/* Independent Client/Ranch/Block selectors for bulk clock-out */}
              <div className="space-y-2">
                <Label htmlFor="bulk-client-select">Client</Label>
                <Select
                  value={selectedBulkClient || ""}
                  onValueChange={(value) => {
                    setSelectedBulkClient(
                      value === CLEAR_SELECTION_VALUE ? "" : value,
                    );
                    setSelectedBulkRanch("");
                    setSelectedBulkBlock("");
                    setSelectedBulkTask("");
                  }}
                >
                  <SelectTrigger id="bulk-client-select">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR_SELECTION_VALUE}>
                      -- Clear selection --
                    </SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-ranch-select">Ranch (Optional)</Label>
                <Select
                  value={selectedBulkRanch || ""}
                  onValueChange={(value) => {
                    setSelectedBulkRanch(
                      value === CLEAR_SELECTION_VALUE ? "" : value,
                    );
                    setSelectedBulkBlock("");
                    setSelectedBulkTask("");
                  }}
                  disabled={!selectedBulkClient || bulkRanches.length === 0}
                >
                  <SelectTrigger id="bulk-ranch-select">
                    <SelectValue placeholder="Select a ranch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR_SELECTION_VALUE}>
                      -- Clear selection --
                    </SelectItem>
                    {bulkRanches.map((ranch) => (
                      <SelectItem key={ranch} value={ranch}>
                        {ranch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-block-select">Block (Optional)</Label>
                <Select
                  value={selectedBulkBlock || ""}
                  onValueChange={(value) => {
                    setSelectedBulkBlock(
                      value === CLEAR_SELECTION_VALUE ? "" : value,
                    );
                    setSelectedBulkTask("");
                  }}
                  disabled={!selectedBulkRanch || bulkBlocks.length === 0}
                >
                  <SelectTrigger id="bulk-block-select">
                    <SelectValue placeholder="Select a block" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR_SELECTION_VALUE}>
                      -- Clear selection --
                    </SelectItem>
                    {bulkBlocks.map((block) => (
                      <SelectItem key={block} value={block}>
                        {block}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-task-select">Task</Label>
                <Select
                  value={selectedBulkTask}
                  onValueChange={setSelectedBulkTask}
                  disabled={!selectedBulkClient}
                >
                  <SelectTrigger id="bulk-task-select">
                    <SelectValue
                      placeholder={
                        !selectedBulkClient
                          ? "Select a client first to view tasks"
                          : bulkClockOutFilteredTasks &&
                              bulkClockOutFilteredTasks.length > 0
                            ? "Select a task to bulk clock out"
                            : "No active tasks with clock-ins available"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {bulkClockOutFilteredTasks?.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                        {task.variety && ` (${task.variety})`}
                        {task.ranch && ` - ${task.ranch}`}
                        {task.block && ` - ${task.block}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleBulkClockOut}
                disabled={isBulkClockingOut || !selectedBulkTask}
                variant="destructive"
              >
                {isBulkClockingOut && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Clock Out All
              </Button>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Log Sick Leave</CardTitle>
              <CardDescription>
                Record time off using accumulated sick hours. Sick hours will be
                deducted from employee balance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sick-leave-employee-search">Employee</Label>
                <Input
                  id="sick-leave-employee-search"
                  placeholder="Search for an active employee..."
                  value={manualEmployeeSearch}
                  onChange={(e) => setManualEmployeeSearch(e.target.value)}
                />
                {manualEmployeeSearch &&
                  filteredManualEmployees &&
                  filteredManualEmployees.length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {filteredManualEmployees.map((employee) => (
                        <Button
                          key={employee.id}
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => {
                            setManualSelectedEmployee(employee);
                            setManualEmployeeSearch(employee.name);
                          }}
                        >
                          {employee.name} -{" "}
                          {employee.sickHoursBalance?.toFixed(2) || "0.00"} sick
                          hrs available
                        </Button>
                      ))}
                    </div>
                  )}
              </div>

              {manualSelectedEmployee && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Selected Employee:</span>
                    <span>{manualSelectedEmployee.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Available Sick Hours:</span>
                    <span className="text-green-600 font-semibold">
                      {manualSelectedEmployee.sickHoursBalance?.toFixed(2) ||
                        "0.00"}{" "}
                      hrs
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="sick-hours-to-use">Hours to Use</Label>
                <Input
                  id="sick-hours-to-use"
                  type="number"
                  step="0.5"
                  min="0"
                  max={manualSelectedEmployee?.sickHoursBalance || 0}
                  placeholder="Enter hours"
                  value={sickHoursToUse}
                  onChange={(e) =>
                    setSickHoursToUse(
                      e.target.value === "" ? 0 : parseFloat(e.target.value),
                    )
                  }
                  disabled={!manualSelectedEmployee}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sick-leave-date">Date of Absence</Label>
                <Input
                  id="sick-leave-date"
                  type="date"
                  value={sickLeaveDate}
                  onChange={(e) => setSickLeaveDate(e.target.value)}
                  disabled={!manualSelectedEmployee}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sick-leave-notes">Notes (Optional)</Label>
                <Textarea
                  id="sick-leave-notes"
                  placeholder="Reason for absence, doctor's note, etc."
                  value={sickLeaveNotes}
                  onChange={(e) => setSickLeaveNotes(e.target.value)}
                  disabled={!manualSelectedEmployee}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleLogSickLeave}
                disabled={!manualSelectedEmployee || isLoggingSickLeave}
              >
                {isLoggingSickLeave && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Log Sick Leave
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="piece-work">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Piece-Work</CardTitle>
              <CardDescription>
                Select a client and active piecework task to record pieces.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client List with Active Task Counts */}
              <div className="space-y-2">
                <Label>Clients with Active Tasks</Label>
                {clientsWithActiveTasks.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-yellow-300 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      No clients with active piecework tasks. Employees must be
                      clocked into a piecework task for it to appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {clientsWithActiveTasks.map((client) => (
                      <Card
                        key={client.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          pieceWorkClient === client.id
                            ? "border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                            : "hover:border-gray-400"
                        }`}
                        onClick={() => {
                          if (pieceWorkClient === client.id) {
                            setPieceWorkClient("");
                            setPieceWorkTask("");
                          } else {
                            setPieceWorkClient(client.id);
                            setPieceWorkTask("");
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{client.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {client.activeTasksCount} active task
                                {client.activeTasksCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                            {pieceWorkClient === client.id && (
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Tasks as Cards - only show if client selected */}
              {pieceWorkClient && activePieceworkTasksByClient.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Active Task</Label>
                  <div className="grid grid-cols-1 gap-3">
                    {activePieceworkTasksByClient.map((task) => (
                      <Card
                        key={task.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          pieceWorkTask === task.id
                            ? "border-2 border-green-500 bg-green-50 dark:bg-green-950/30"
                            : "hover:border-gray-400"
                        }`}
                        onClick={() => {
                          setPieceWorkTask(task.id);
                          setScannedSharedEmployees([]);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <p className="font-semibold">
                                  {task.name}
                                  {task.variety && ` (${task.variety})`}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                {task.ranch && <span>Ranch: {task.ranch}</span>}
                                {task.block && <span>Block: {task.block}</span>}
                                {task.piecePrice && (
                                  <span className="font-medium text-green-600 dark:text-green-400">
                                    ${task.piecePrice.toFixed(2)}/piece
                                  </span>
                                )}
                              </div>
                            </div>
                            {pieceWorkTask === task.id && (
                              <CheckCircle className="h-5 w-5 text-green-600 ml-2" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Show piecework entry interface only when task is selected */}
          {pieceWorkSelectedTask && (
            <>
              {/* Display Selected Task Card */}
              <Card className="mb-4 border-2 border-green-500">
                <CardHeader className="bg-green-50 dark:bg-green-950/30 pb-3">
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300 text-lg">
                    <CheckCircle className="h-5 w-5" />
                    Selected Task
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="p-4 border rounded-lg bg-card">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold text-base">
                          {pieceWorkSelectedTask.name}
                          {pieceWorkSelectedTask.variety &&
                            ` (${pieceWorkSelectedTask.variety})`}
                        </p>
                        {pieceWorkSelectedTask.piecePrice && (
                          <span className="ml-auto text-sm font-medium text-green-600 dark:text-green-400">
                            ${pieceWorkSelectedTask.piecePrice.toFixed(2)}/piece
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Client:</span>
                          <span>
                            {clients?.find(
                              (c) => c.id === pieceWorkSelectedTask.clientId,
                            )?.name || "Unknown"}
                          </span>
                        </div>
                        {pieceWorkSelectedTask.ranch && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Ranch:</span>
                            <span>{pieceWorkSelectedTask.ranch}</span>
                          </div>
                        )}
                        {pieceWorkSelectedTask.block && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Block:</span>
                            <span>{pieceWorkSelectedTask.block}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Piecework Entry Tabs */}
              <Tabs defaultValue="qr-piecework">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qr-piecework">
                    <QrCode className="mr-2 h-4 w-4" />
                    QR Code Scanner
                  </TabsTrigger>
                  <TabsTrigger value="manual-piecework">
                    <ClipboardEdit className="mr-2 h-4 w-4" />
                    Manual Entry
                  </TabsTrigger>
                </TabsList>

                {/* QR Scanner Tab */}
                <TabsContent value="qr-piecework">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg md:text-xl">
                        QR Code Scanner
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Scan employee QR codes to record piecework. Employees
                        must be clocked into the selected task.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 md:space-y-4">
                      <div className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="piece-qr-shared-piece-switch"
                            checked={isSharedPiece}
                            onCheckedChange={setIsSharedPiece}
                          />
                          <Label htmlFor="piece-qr-shared-piece-switch">
                            Shared Piece (Multiple Workers)
                          </Label>
                        </div>
                        <RadioGroup
                          value={pieceEntryMode}
                          onValueChange={(v: string) =>
                            setPieceEntryMode(v as PieceEntryMode)
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="scan" id="piece-qr-scan" />
                            <Label htmlFor="piece-qr-scan">
                              Scan Employees
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="manual"
                              id="piece-qr-manual"
                            />
                            <Label htmlFor="piece-qr-manual">
                              Manual Count
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {pieceEntryMode === "scan" ? (
                        <QrScanner
                          key="piecework-scan-mode"
                          onScanResult={(data) =>
                            handlePieceWorkTabScanResult(data)
                          }
                          isProcessing={isPieceworkQrProcessing}
                        />
                      ) : (
                        <div className="p-4 border rounded-lg space-y-4">
                          <div className="space-y-2">
                            <Label>Scan Employee QR Code</Label>
                            <QrScanner
                              key="piecework-manual-mode"
                              onScanResult={(data) =>
                                handlePieceWorkTabScanResult(data)
                              }
                              isProcessing={isPieceworkQrProcessing}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="piece-qr-quantity">
                              Quantity (Pieces/Bins)
                            </Label>
                            <Input
                              id="piece-qr-quantity"
                              type="number"
                              step="0.01"
                              placeholder="Enter number of pieces"
                              value={manualPieceQuantity}
                              onChange={(e) => {
                                const value = e.target.value;
                                setManualPieceQuantity(
                                  value === "" ? "" : parseFloat(value),
                                );
                              }}
                              min="0"
                            />
                          </div>
                          {scannedSharedEmployees.length > 0 && (
                            <Button
                              className="w-full"
                              onClick={handlePieceWorkSubmit}
                              disabled={
                                isManualSubmitting ||
                                !manualPieceQuantity ||
                                scannedSharedEmployees.length === 0
                              }
                            >
                              {isManualSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Submit Pieces
                            </Button>
                          )}
                        </div>
                      )}

                      {scannedSharedEmployees.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Users />
                                Scanned Employees (
                                {scannedSharedEmployees.length})
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setScannedSharedEmployees([])}
                              >
                                Clear List
                              </Button>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-1">
                              {scannedSharedEmployees.map((id) => {
                                const name =
                                  activeEmployees?.find((e) => e.id === id)
                                    ?.name || id;
                                return (
                                  <li
                                    key={id}
                                    className="flex items-center gap-2 text-green-600"
                                  >
                                    <CheckCircle className="h-5 w-5" />
                                    <p className="font-mono text-sm">{name}</p>
                                  </li>
                                );
                              })}
                            </ul>
                            {isSharedPiece && pieceEntryMode === "scan" && (
                              <div className="mt-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md mb-3">
                                  <p className="text-sm text-blue-700 dark:text-blue-300">
                                    <strong>Division:</strong> 1 piece will be
                                    divided equally among{" "}
                                    {scannedSharedEmployees.length} worker
                                    {scannedSharedEmployees.length !== 1
                                      ? "s"
                                      : ""}
                                    . Each will receive{" "}
                                    {(
                                      1 / scannedSharedEmployees.length
                                    ).toFixed(4)}{" "}
                                    piece
                                    {1 / scannedSharedEmployees.length !== 1
                                      ? "s"
                                      : ""}
                                    .
                                  </p>
                                </div>
                                <Button
                                  className="w-full"
                                  onClick={() => handlePieceWorkSubmit(1)}
                                  disabled={
                                    isManualSubmitting ||
                                    scannedSharedEmployees.length === 0
                                  }
                                >
                                  {isManualSubmitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Submit Pieces
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Manual Entry Tab */}
                <TabsContent value="manual-piecework">
                  <Card>
                    <CardHeader>
                      <CardTitle>Manual Piecework Entry</CardTitle>
                      <CardDescription>
                        Manually log piecework for employees without QR code.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="piece-manual-employee-search">
                          Employee
                        </Label>
                        {manualSelectedEmployee ? (
                          <div className="flex items-center gap-2 rounded-md border p-2 bg-muted">
                            <User className="h-4 w-4" />
                            <span>{manualSelectedEmployee.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto"
                              onClick={() => {
                                setManualSelectedEmployee(null);
                                setManualEmployeeSearch("");
                              }}
                            >
                              Change
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Input
                              id="piece-manual-employee-search"
                              placeholder="Search for an active employee..."
                              value={manualEmployeeSearch}
                              onChange={(e) =>
                                setManualEmployeeSearch(e.target.value)
                              }
                            />
                            {manualEmployeeSearch &&
                              filteredManualEmployees &&
                              filteredManualEmployees.length > 0 && (
                                <div className="border rounded-md max-h-48 overflow-y-auto">
                                  {filteredManualEmployees.map((employee) => {
                                    // Check if employee is active in selected task
                                    const isActiveInTask =
                                      activeTimeEntries?.some(
                                        (entry) =>
                                          entry.employeeId === employee.id &&
                                          entry.taskId ===
                                            pieceWorkSelectedTask.id &&
                                          entry.endTime === null,
                                      );

                                    return (
                                      <Button
                                        key={employee.id}
                                        variant="ghost"
                                        className="w-full justify-start"
                                        disabled={!isActiveInTask}
                                        onClick={() => {
                                          if (isActiveInTask) {
                                            setManualSelectedEmployee(employee);
                                            setManualEmployeeSearch(
                                              employee.name,
                                            );
                                          }
                                        }}
                                      >
                                        {employee.name}
                                        {!isActiveInTask && (
                                          <span className="ml-auto text-xs text-muted-foreground">
                                            (Not active in task)
                                          </span>
                                        )}
                                      </Button>
                                    );
                                  })}
                                </div>
                              )}
                            {manualEmployeeSearch &&
                              filteredManualEmployees &&
                              filteredManualEmployees.length === 0 && (
                                <p className="p-4 text-sm text-muted-foreground">
                                  No employees found.
                                </p>
                              )}
                          </>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="piece-manual-quantity">
                          Quantity (Pieces/Bins)
                        </Label>
                        <Input
                          id="piece-manual-quantity"
                          type="number"
                          step="0.01"
                          placeholder="Enter number of pieces"
                          value={manualPieceQuantity}
                          onChange={(e) => {
                            const value = e.target.value;
                            setManualPieceQuantity(
                              value === "" ? "" : parseFloat(value),
                            );
                          }}
                          min="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="piece-manual-notes">
                          Notes (Optional)
                        </Label>
                        <Textarea
                          id="piece-manual-notes"
                          placeholder="Add any relevant notes (e.g., QC issues)"
                          value={manualNotes}
                          onChange={(e) => setManualNotes(e.target.value)}
                        />
                      </div>

                      <Button
                        className="w-full"
                        onClick={async () => {
                          if (
                            !firestore ||
                            !pieceWorkSelectedTask ||
                            !manualSelectedEmployee
                          ) {
                            toast({
                              variant: "destructive",
                              title: "Missing Information",
                              description: "Please complete all fields.",
                            });
                            return;
                          }

                          const pieceCount =
                            typeof manualPieceQuantity === "number"
                              ? manualPieceQuantity
                              : parseFloat(String(manualPieceQuantity));
                          if (isNaN(pieceCount) || pieceCount <= 0) {
                            toast({
                              variant: "destructive",
                              title: "Invalid Quantity",
                              description:
                                "Please enter a valid number of pieces.",
                            });
                            return;
                          }

                          setIsManualSubmitting(true);
                          try {
                            const newPiecework: Omit<Piecework, "id"> = {
                              employeeId: manualSelectedEmployee.id,
                              taskId: pieceWorkSelectedTask.id,
                              timestamp: new Date(),
                              pieceCount: pieceCount,
                              pieceQrCode: "manual_entry",
                              qcNote: manualNotes,
                            };

                            // ✅ OFFLINE: cola y salida inmediata
                            if (!isOnline) {
                              addDoc(
                                collection(firestore, "piecework"),
                                newPiecework,
                              ).catch((error) => {
                                console.warn(
                                  "Manual piecework queued for sync:",
                                  error,
                                );
                              });

                              toast({
                                title: "Piecework Queued",
                                description: addOfflineIndicator(
                                  `${pieceCount} piece(s) queued for ${manualSelectedEmployee.name}.`,
                                  isOnline,
                                ),
                              });

                              setManualSelectedEmployee(null);
                              setManualEmployeeSearch("");
                              setManualPieceQuantity("");
                              setManualNotes("");
                              setIsManualSubmitting(false);
                              return;
                            }

                            await addDoc(
                              collection(firestore, "piecework"),
                              newPiecework,
                            );

                            playSound("piece");

                            toast({
                              title: "Piecework Recorded",
                              description: addOfflineIndicator(
                                `${pieceCount} piece(s) recorded for ${manualSelectedEmployee.name}.`,
                                isOnline,
                              ),
                            });

                            setManualSelectedEmployee(null);
                            setManualEmployeeSearch("");
                            setManualPieceQuantity("");
                            setManualNotes("");
                          } catch (serverError) {
                            const permissionError =
                              new FirestorePermissionError({
                                path: "piecework",
                                operation: "create",
                                requestResourceData: {
                                  taskId: pieceWorkSelectedTask.id,
                                },
                              });
                            errorEmitter.emit(
                              "permission-error",
                              permissionError,
                            );
                          } finally {
                            setIsManualSubmitting(false);
                          }
                        }}
                        disabled={
                          isManualSubmitting ||
                          !manualSelectedEmployee ||
                          !pieceWorkSelectedTask
                        }
                      >
                        {isManualSubmitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Submit Piecework
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Complete History
                  </CardTitle>
                  <CardDescription>
                    View and manage all clock-in/clock-out records and piecework
                    entries. Filter by date range and delete individual records.
                  </CardDescription>
                </div>
                {filteredMergedRecords && filteredMergedRecords.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteAllConfirmOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Date Range Filter */}
              <div className="mb-6 p-4 border rounded-lg space-y-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="h-4 w-4" />
                  <Label className="font-semibold">Filter by Date Range</Label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="history-start-date">Start Date</Label>
                    <Input
                      id="history-start-date"
                      type="date"
                      value={
                        historyStartDate
                          ? format(historyStartDate, "yyyy-MM-dd")
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          // Parse as local date to avoid timezone offset issues
                          const [year, month, day] = e.target.value
                            .split("-")
                            .map(Number);
                          setHistoryStartDate(new Date(year, month - 1, day));
                        } else {
                          setHistoryStartDate(undefined);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="history-end-date">End Date</Label>
                    <Input
                      id="history-end-date"
                      type="date"
                      value={
                        historyEndDate
                          ? format(historyEndDate, "yyyy-MM-dd")
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          // Parse as local date to avoid timezone offset issues
                          const [year, month, day] = e.target.value
                            .split("-")
                            .map(Number);
                          setHistoryEndDate(new Date(year, month - 1, day));
                        } else {
                          setHistoryEndDate(undefined);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Name Filter */}
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="history-name-filter">
                    Filter by Employee Name
                  </Label>
                  <Input
                    id="history-name-filter"
                    type="text"
                    placeholder="Type employee name to filter..."
                    value={historyNameFilter}
                    onChange={(e) => setHistoryNameFilter(e.target.value)}
                  />
                </div>

                {(historyStartDate || historyEndDate || historyNameFilter) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHistoryStartDate(undefined);
                      setHistoryEndDate(undefined);
                      setHistoryNameFilter("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Unified Records Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-600" />
                  All Records (Clock-In/Clock-Out & Piecework)
                </h3>
                {!filteredMergedRecords ||
                filteredMergedRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p>No records found.</p>
                    {(historyStartDate ||
                      historyEndDate ||
                      historyNameFilter) && (
                      <p className="text-sm mt-2">
                        Try adjusting your filters.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMergedRecords.map((record) => {
                      if (record.type === "time") {
                        const entry = record.data;
                        const employee = activeEmployees?.find(
                          (e) => e.id === entry.employeeId,
                        );
                        const task = allTasks?.find(
                          (t) => t.id === entry.taskId,
                        );
                        const client = clients?.find(
                          (c) => c.id === task?.clientId,
                        );
                        const clockInTime =
                          entry.timestamp instanceof Date
                            ? entry.timestamp
                            : (entry.timestamp as any)?.toDate
                              ? (entry.timestamp as any).toDate()
                              : new Date(entry.timestamp as any);
                        const clockOutTime = entry.endTime
                          ? entry.endTime instanceof Date
                            ? entry.endTime
                            : (entry.endTime as any)?.toDate
                              ? (entry.endTime as any).toDate()
                              : new Date(entry.endTime as any)
                          : null;

                        return (
                          <div
                            key={`time-${entry.id}`}
                            className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <p className="font-semibold">
                                  {employee?.name || "Unknown Employee"}
                                </p>
                                {!entry.endTime && (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                    Active
                                  </span>
                                )}
                                {/* Record Type Badge */}
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  Time Entry
                                </span>
                                {/* Payment Type Badge */}
                                {(() => {
                                  const taskForEntry = allTasks?.find(
                                    (t) => t.id === entry.taskId,
                                  );
                                  const paymentType =
                                    entry.paymentModality ||
                                    (taskForEntry?.clientRateType === "piece"
                                      ? "Piecework"
                                      : "Hourly");
                                  return (
                                    <span
                                      className={`text-xs px-2 py-1 rounded-full ${
                                        paymentType === "Piecework"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-orange-100 text-orange-800"
                                      }`}
                                    >
                                      {paymentType}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Package className="h-3 w-3" />
                                <p>
                                  {task?.name || "Unknown Task"}
                                  {task?.variety && ` (${task.variety})`}
                                </p>
                              </div>
                              {client && (
                                <div className="text-xs text-muted-foreground">
                                  Client: {client.name}
                                </div>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <LogIn className="h-3 w-3 text-green-600" />
                                  <p className="text-muted-foreground">
                                    In: {format(clockInTime, "PPp")}
                                  </p>
                                </div>
                                {clockOutTime && (
                                  <div className="flex items-center gap-2">
                                    <LogOut className="h-3 w-3 text-red-600" />
                                    <p className="text-muted-foreground">
                                      Out: {format(clockOutTime, "PPp")}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {/* Show pieces: both from piecesWorked field and related piecework records */}
                              {(() => {
                                const relatedPiecework =
                                  allPiecework?.filter(
                                    (p) =>
                                      p.employeeId === entry.employeeId &&
                                      p.taskId === entry.taskId &&
                                      (() => {
                                        const pieceTime =
                                          p.timestamp instanceof Date
                                            ? p.timestamp
                                            : (p.timestamp as any)?.toDate
                                              ? (p.timestamp as any).toDate()
                                              : new Date(p.timestamp as any);
                                        // Show pieces that fall within the time entry period, or within same day if no end time
                                        if (entry.endTime) {
                                          const endTime =
                                            entry.endTime instanceof Date
                                              ? entry.endTime
                                              : (entry.endTime as any)?.toDate
                                                ? (
                                                    entry.endTime as any
                                                  ).toDate()
                                                : new Date(
                                                    entry.endTime as any,
                                                  );
                                          return (
                                            pieceTime.getTime() >=
                                              clockInTime.getTime() &&
                                            pieceTime.getTime() <=
                                              endTime.getTime()
                                          );
                                        } else {
                                          // If entry is still active, show pieces from same day
                                          return (
                                            pieceTime.toDateString() ===
                                            clockInTime.toDateString()
                                          );
                                        }
                                      })(),
                                  ) || [];

                                const hasPieces =
                                  (entry.piecesWorked &&
                                    entry.piecesWorked > 0) ||
                                  relatedPiecework.length > 0;

                                if (!hasPieces) return null;

                                // Calculate total pieces
                                const totalPieces =
                                  (entry.piecesWorked || 0) +
                                  relatedPiecework.reduce(
                                    (sum, p) => sum + p.pieceCount,
                                    0,
                                  );

                                return (
                                  <div className="text-sm">
                                    <p className="font-medium text-muted-foreground mb-1">
                                      Pieces (Total: {totalPieces.toFixed(2)}):
                                    </p>
                                    <ul className="list-none space-y-1 ml-4">
                                      {entry.piecesWorked &&
                                        entry.piecesWorked > 0 && (
                                          <li className="text-muted-foreground">
                                            {clockOutTime
                                              ? format(clockOutTime, "p")
                                              : "In progress"}
                                            :{" "}
                                            {typeof entry.piecesWorked ===
                                            "number"
                                              ? entry.piecesWorked.toFixed(2)
                                              : entry.piecesWorked}{" "}
                                            piece(s)
                                          </li>
                                        )}
                                      {relatedPiecework.map((piece) => {
                                        const pieceTime =
                                          piece.timestamp instanceof Date
                                            ? piece.timestamp
                                            : (piece.timestamp as any)?.toDate
                                              ? (
                                                  piece.timestamp as any
                                                ).toDate()
                                              : new Date(
                                                  piece.timestamp as any,
                                                );
                                        return (
                                          <li
                                            key={piece.id}
                                            className="text-muted-foreground"
                                          >
                                            {format(pieceTime, "p")}:{" "}
                                            {typeof piece.pieceCount ===
                                            "number"
                                              ? piece.pieceCount.toFixed(2)
                                              : piece.pieceCount}{" "}
                                            piece(s)
                                            {piece.pieceQrCode &&
                                              piece.pieceQrCode !==
                                                "manual_entry" &&
                                              piece.pieceQrCode !==
                                                "past_record_entry" && (
                                                <span className="text-xs ml-2">
                                                  (Bin: {piece.pieceQrCode})
                                                </span>
                                              )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const taskForEntry = allTasks?.find(
                                    (t) => t.id === entry.taskId,
                                  );
                                  // Initialize payment modality based on task type or entry's paymentModality
                                  const initialModality =
                                    entry.paymentModality ||
                                    (taskForEntry?.clientRateType === "piece"
                                      ? "Piecework"
                                      : "Hourly");

                                  // Get related piecework for this time entry
                                  const relatedPieces =
                                    allPiecework?.filter(
                                      (p) =>
                                        p.employeeId === entry.employeeId &&
                                        p.taskId === entry.taskId &&
                                        (() => {
                                          const pieceTime =
                                            p.timestamp instanceof Date
                                              ? p.timestamp
                                              : (p.timestamp as any)?.toDate
                                                ? (p.timestamp as any).toDate()
                                                : new Date(p.timestamp as any);
                                          if (entry.endTime) {
                                            const endTime =
                                              entry.endTime instanceof Date
                                                ? entry.endTime
                                                : (entry.endTime as any)?.toDate
                                                  ? (
                                                      entry.endTime as any
                                                    ).toDate()
                                                  : new Date(
                                                      entry.endTime as any,
                                                    );
                                            return (
                                              pieceTime.getTime() >=
                                                clockInTime.getTime() &&
                                              pieceTime.getTime() <=
                                                endTime.getTime()
                                            );
                                          } else {
                                            return (
                                              pieceTime.toDateString() ===
                                              clockInTime.toDateString()
                                            );
                                          }
                                        })(),
                                    ) || [];

                                  setEditTarget({ type: "time", entry: entry });
                                  setEditTimestamp(clockInTime);
                                  setEditEndTime(clockOutTime || undefined);
                                  setEditPiecesWorked(entry.piecesWorked || 0);
                                  setEditPaymentModality(initialModality);
                                  setEditRelatedPiecework(relatedPieces);

                                  // Initialize task selection
                                  setEditTaskId(entry.taskId);
                                  if (taskForEntry) {
                                    setEditClient(taskForEntry.clientId);
                                    setEditRanch(taskForEntry.ranch || "");
                                    setEditBlock(taskForEntry.block || "");
                                  }

                                  setEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setDeleteTarget({
                                    type: "time",
                                    id: entry.id,
                                  });
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      } else {
                        // Piecework record - only show if it's NOT already included in a TimeEntry
                        const piece = record.data;

                        // Check if this piecework is already shown within a time entry
                        const pieceTime =
                          piece.timestamp instanceof Date
                            ? piece.timestamp
                            : (piece.timestamp as any)?.toDate
                              ? (piece.timestamp as any).toDate()
                              : new Date(piece.timestamp as any);

                        const isIncludedInTimeEntry = allTimeEntries?.some(
                          (entry) => {
                            if (
                              entry.employeeId !== piece.employeeId ||
                              entry.taskId !== piece.taskId
                            ) {
                              return false;
                            }
                            const clockInTime =
                              entry.timestamp instanceof Date
                                ? entry.timestamp
                                : (entry.timestamp as any)?.toDate
                                  ? (entry.timestamp as any).toDate()
                                  : new Date(entry.timestamp as any);

                            if (entry.endTime) {
                              const clockOutTime =
                                entry.endTime instanceof Date
                                  ? entry.endTime
                                  : (entry.endTime as any)?.toDate
                                    ? (entry.endTime as any).toDate()
                                    : new Date(entry.endTime as any);
                              return (
                                pieceTime.getTime() >= clockInTime.getTime() &&
                                pieceTime.getTime() <= clockOutTime.getTime()
                              );
                            } else {
                              // Active entry - check if piece is from same day
                              return (
                                pieceTime.toDateString() ===
                                clockInTime.toDateString()
                              );
                            }
                          },
                        );

                        // Skip this piecework if it's already shown in a time entry
                        if (isIncludedInTimeEntry) {
                          return null;
                        }

                        // Handle multiple employees (comma-separated IDs)
                        const employeeIds = piece.employeeId.split(",");
                        const employeeNames =
                          employeeIds
                            .map(
                              (id) =>
                                activeEmployees?.find(
                                  (e) => e.id === id || e.qrCode === id,
                                )?.name,
                            )
                            .filter(Boolean)
                            .join(", ") || "Unknown Employee(s)";
                        const task = allTasks?.find(
                          (t) => t.id === piece.taskId,
                        );
                        const client = clients?.find(
                          (c) => c.id === task?.clientId,
                        );

                        return (
                          <div
                            key={`piece-${piece.id}`}
                            className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <p className="font-semibold">{employeeNames}</p>
                                {/* Record Type Badge */}
                                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                                  Piecework
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Package className="h-3 w-3" />
                                <p>
                                  {task?.name || "Unknown Task"}
                                  {task?.variety && ` (${task.variety})`}
                                </p>
                              </div>
                              {client && (
                                <div className="text-xs text-muted-foreground">
                                  Client: {client.name}
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-sm">
                                <CalendarIcon className="h-3 w-3 text-purple-600" />
                                <p className="text-muted-foreground">
                                  {format(pieceTime, "PPp")}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                  <p className="text-muted-foreground">
                                    Quantity:{" "}
                                    {typeof piece.pieceCount === "number"
                                      ? piece.pieceCount.toFixed(2)
                                      : piece.pieceCount}
                                  </p>
                                </div>
                                {piece.pieceQrCode &&
                                  piece.pieceQrCode !== "manual_entry" && (
                                    <div className="text-xs text-muted-foreground">
                                      Bin: {piece.pieceQrCode}
                                    </div>
                                  )}
                                {piece.pieceQrCode === "manual_entry" && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    Manual Entry
                                  </span>
                                )}
                              </div>
                              {piece.qcNote && (
                                <div className="text-xs text-muted-foreground italic">
                                  Note: {piece.qcNote}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const taskForPiece = allTasks?.find(
                                    (t) => t.id === piece.taskId,
                                  );

                                  setEditTarget({
                                    type: "piecework",
                                    entry: piece,
                                  });
                                  setEditTimestamp(pieceTime);
                                  setEditPieceCount(piece.pieceCount || 1);

                                  // Inicializar selección de tarea COMPLETA
                                  setEditTaskId(piece.taskId);
                                  if (taskForPiece) {
                                    setEditClient(taskForPiece.clientId);
                                    setEditRanch(taskForPiece.ranch || "");
                                    setEditBlock(taskForPiece.block || ""); // <- Esto ya estaba
                                  }

                                  setEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setDeleteTarget({
                                    type: "piecework",
                                    id: piece.id,
                                  });
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="test">
          <SoundTestTab
            audioContext={audioContext}
            username={username}
            onSettingsSaved={() => {
              // Reload sound settings when saved
              console.log(
                "onSettingsSaved callback triggered, username:",
                username,
              );
              if (username) {
                const settings =
                  SoundSettingsService.getSoundSettings(username);
                console.log("Reloading settings from localStorage:", settings);
                setSoundSettings(settings);
              }
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this{" "}
              {deleteTarget?.type === "time" ? "time entry" : "piecework"}{" "}
              record from the database and it will not appear in any reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteTarget(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog
        open={deleteAllConfirmOpen}
        onOpenChange={(open) => {
          setDeleteAllConfirmOpen(open);
          if (!open) {
            setDeleteAllPassword("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {filteredMergedRecords.length ===
              (allTimeEntries?.length || 0) + (allPiecework?.length || 0)
                ? "All"
                : "Filtered"}{" "}
              Movements?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const hasFilters =
                  historyStartDate || historyEndDate || historyNameFilter;
                const totalRecords = filteredMergedRecords.length;
                const totalTimeEntries = filteredMergedRecords.filter(
                  (r) => r.type === "time",
                ).length;
                const totalPiecework = filteredMergedRecords.filter(
                  (r) => r.type === "piecework",
                ).length;

                return (
                  <>
                    <p className="mb-2">
                      This action cannot be undone. This will permanently delete{" "}
                      <strong>{totalRecords} record(s)</strong> (
                      {totalTimeEntries} time{" "}
                      {totalTimeEntries === 1 ? "entry" : "entries"} and{" "}
                      {totalPiecework} piecework record
                      {totalPiecework === 1 ? "" : "s"}) from the database.
                      These records will not appear in any reports.
                    </p>
                    {!hasFilters && (
                      <p className="mt-2 text-red-600 font-semibold">
                        ⚠️ WARNING: You are about to delete ALL records without
                        any filters applied!
                      </p>
                    )}
                    {hasFilters && (
                      <p className="mt-2 text-blue-600 font-semibold">
                        ℹ️ Note: Only records matching your current filters will
                        be deleted.
                      </p>
                    )}
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!historyStartDate && !historyEndDate && !historyNameFilter && (
            <div className="py-4">
              <Label htmlFor="delete-password" className="text-sm font-medium">
                Enter Password to Confirm (Required for deleting all records)
              </Label>
              <Input
                id="delete-password"
                type="password"
                placeholder="Enter password"
                value={deleteAllPassword}
                onChange={(e) => setDeleteAllPassword(e.target.value)}
                className="mt-2"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteAllConfirmOpen(false);
                setDeleteAllPassword("");
              }}
              disabled={isDeletingAll}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllMovements}
              disabled={isDeletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAll && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit{" "}
              {editTarget?.type === "time" ? "Time Entry" : "Piecework Record"}
            </DialogTitle>
            <DialogDescription>
              {editTarget?.type === "time"
                ? "Update the client, task, timestamps and payment details for this time entry."
                : "Update the client, task, timestamp and quantity for this piecework record."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-timestamp">
                {editTarget?.type === "time" ? "Clock-In Time" : "Timestamp"}
              </Label>
              <DateTimePicker
                date={editTimestamp}
                setDate={setEditTimestamp}
                label=""
                placeholder="Select date and time"
              />
            </div>

            {/* Task Selection Fields */}
            <div className="space-y-4 p-4 border rounded-md bg-muted/30">
              <div className="space-y-2">
                <Label htmlFor="edit-client">Client</Label>
                <Select
                  value={editClient || ""}
                  onValueChange={(value) =>
                    setEditClient(value === CLEAR_SELECTION_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger id="edit-client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR_SELECTION_VALUE}>
                      -- Clear selection --
                    </SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ranch">Ranch</Label>
                <Select
                  value={editRanch || ""}
                  onValueChange={(value) =>
                    setEditRanch(value === CLEAR_SELECTION_VALUE ? "" : value)
                  }
                  disabled={!editClient || editRanches.length === 0}
                >
                  <SelectTrigger id="edit-ranch">
                    <SelectValue placeholder="Select a ranch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR_SELECTION_VALUE}>
                      -- Clear selection --
                    </SelectItem>
                    {editRanches.map((ranch) => (
                      <SelectItem key={ranch} value={ranch}>
                        {ranch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-block">Block</Label>
                <Select
                  value={editBlock || ""}
                  onValueChange={(value) =>
                    setEditBlock(value === CLEAR_SELECTION_VALUE ? "" : value)
                  }
                  disabled={!editRanch || editBlocks.length === 0}
                >
                  <SelectTrigger id="edit-block">
                    <SelectValue placeholder="Select a block" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR_SELECTION_VALUE}>
                      -- Clear selection --
                    </SelectItem>
                    {editBlocks.map((block) => (
                      <SelectItem key={block} value={block}>
                        {block}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-task">Task</Label>
                <Select
                  value={editTaskId || ""}
                  onValueChange={(value) =>
                    setEditTaskId(value === CLEAR_SELECTION_VALUE ? "" : value)
                  }
                  disabled={editFilteredTasks.length === 0}
                >
                  <SelectTrigger id="edit-task">
                    <SelectValue placeholder="Select a task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLEAR_SELECTION_VALUE}>
                      -- Clear selection --
                    </SelectItem>
                    {editFilteredTasks?.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name} ({task.variety})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editTarget?.type === "time" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-endtime">
                    Clock-Out Time (optional)
                  </Label>
                  <DateTimePicker
                    date={editEndTime}
                    setDate={setEditEndTime}
                    label=""
                    placeholder="Select date and time or leave empty"
                  />
                </div>

                {/* Show all pieces with individual editable fields - only for piecework tasks */}
                {editPaymentModality === "Piecework" && (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <p className="font-medium text-sm">Pieces Worked:</p>

                    {/* Show piecesWorked field - always show for time entries */}
                    <div className="space-y-2">
                      <Label htmlFor="edit-pieces-main">
                        {editEndTime
                          ? format(editEndTime, "PPp")
                          : "Clock-out time"}
                      </Label>
                      <Input
                        id="edit-pieces-main"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter number of pieces"
                        value={
                          editPiecesWorked === 0 ? "" : String(editPiecesWorked)
                        } // <- Si es 0, mostrar vacío
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            setEditPiecesWorked(""); // <- Guardar como string vacío
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              setEditPiecesWorked(numValue);
                            }
                          }
                        }}
                      />
                    </div>

                    {/* Show related piecework fields */}
                    {editRelatedPiecework.map((piece, index) => {
                      const pieceTime =
                        piece.timestamp instanceof Date
                          ? piece.timestamp
                          : (piece.timestamp as any)?.toDate
                            ? (piece.timestamp as any).toDate()
                            : new Date(piece.timestamp as any);
                      return (
                        <div key={piece.id} className="space-y-2">
                          <Label htmlFor={`edit-piece-${index}`}>
                            {format(pieceTime, "PPp")}
                          </Label>
                          <Input
                            id={`edit-piece-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Enter number of pieces"
                            value={
                              piece.pieceCount === 0
                                ? ""
                                : String(piece.pieceCount)
                            } // <- Si es 0, mostrar vacío
                            onChange={(e) => {
                              const value = e.target.value;
                              const updated = [...editRelatedPiecework];

                              if (value === "") {
                                updated[index] = { ...piece, pieceCount: "" }; // <- Guardar como string vacío
                              } else {
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue)) {
                                  updated[index] = {
                                    ...piece,
                                    pieceCount: numValue,
                                  };
                                }
                              }
                              setEditRelatedPiecework(updated);
                            }}
                          />
                        </div>
                      );
                    })}

                    {/* También para piecework individual */}
                    {editTarget?.type === "piecework" && (
                      <div className="space-y-2">
                        <Label htmlFor="edit-piece-count">
                          Quantity (can include decimals)
                        </Label>
                        <Input
                          id="edit-piece-count"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Enter quantity"
                          value={
                            editPieceCount === 1 || editPieceCount === 0
                              ? ""
                              : String(editPieceCount)
                          } // <- Si es valor por defecto, mostrar vacío
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              setEditPieceCount(""); // <- Guardar como string vacío
                            } else {
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue)) {
                                setEditPieceCount(numValue);
                              }
                            }
                          }}
                        />
                      </div>
                    )}

                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Pieces:{" "}
                        {(() => {
                          // Cálculo seguro del total manejando strings vacíos
                          const mainPieces =
                            editPiecesWorked === "" || editPiecesWorked === 0
                              ? 0
                              : typeof editPiecesWorked === "string"
                                ? parseFloat(editPiecesWorked) || 0
                                : editPiecesWorked || 0;

                          const relatedPieces = editRelatedPiecework.reduce(
                            (sum, p) => {
                              if (p.pieceCount === "" || p.pieceCount === 0)
                                return sum;
                              return (
                                sum +
                                (typeof p.pieceCount === "number"
                                  ? p.pieceCount
                                  : parseFloat(String(p.pieceCount)) || 0)
                              );
                            },
                            0,
                          );

                          return (mainPieces + relatedPieces).toFixed(2);
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="edit-modality">Payment Modality</Label>
                  <Select
                    value={editPaymentModality}
                    onValueChange={(value: "Hourly" | "Piecework") =>
                      setEditPaymentModality(value)
                    }
                  >
                    <SelectTrigger id="edit-modality">
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hourly">Hourly</SelectItem>
                      <SelectItem value="Piecework">Piecework</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {editTarget?.type === "piecework" && (
              <div className="space-y-2">
                <Label htmlFor="edit-piece-count">
                  Quantity (can include decimals)
                </Label>
                <Input
                  id="edit-piece-count"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter quantity"
                  value={editPieceCount}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Permitir cualquier entrada, incluso vacía
                    setEditPieceCount(value);
                  }}
                  // Remover onBlur que forzaba reset a 1
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditTarget(null);
                setEditTimestamp(undefined);
                setEditEndTime(undefined);
                setEditPiecesWorked(0);
                setEditPaymentModality("Hourly");
                setEditPieceCount(1);
                setEditTaskId("");
                setEditClient("");
                setEditRanch("");
                setEditBlock("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={
                editTarget?.type === "time"
                  ? handleEditTimeEntry
                  : handleEditPiecework
              }
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TimeTrackingPage;
