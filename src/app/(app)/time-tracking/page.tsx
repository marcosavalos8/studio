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
  Calendar,
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
import type { Task, TimeEntry, Piecework, Employee, Client } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { withAuth } from "@/components/withAuth";

const QrScanner = dynamic(
  () => import("./qr-scanner").then((mod) => mod.QrScannerComponent),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="w-full aspect-video bg-muted rounded-md flex items-center justify-center">
        <VideoOff className="h-10 w-10 text-muted-foreground" />
      </Skeleton>
    ),
  }
);

type ScanMode = "clock-in" | "clock-out" | "piece";
type ManualLogType =
  | "clock-in"
  | "clock-out"
  | "start-break"
  | "end-break"
  | "piecework";
type PieceEntryMode = "scan" | "manual";
type SoundType = "clock-in" | "clock-out" | "piece";

function TimeTrackingPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [scanMode, setScanMode] = useState<ScanMode>("clock-in");
  const [isSharedPiece, setIsSharedPiece] = useState(false);
  const [pieceEntryMode, setPieceEntryMode] = useState<PieceEntryMode>("scan");

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
    undefined
  );

  // Bulk clock in
  const [isBulkClockingIn, setIsBulkClockingIn] = useState(false);
  const [selectedBulkInTask, setSelectedBulkInTask] = useState<string>("");
  const [selectedBulkInEmployees, setSelectedBulkInEmployees] = useState<
    Set<string>
  >(new Set());
  const [useBulkClockInManualDateTime, setUseBulkClockInManualDateTime] =
    useState(false);
  const [bulkClockInDate, setBulkClockInDate] = useState<Date | undefined>(
    undefined
  );

  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedRanch, setSelectedRanch] = useState<string>("");
  const [selectedBlock, setSelectedBlock] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<string>("");

  // Manual Entry State
  const [manualLogType, setManualLogType] = useState<ManualLogType>("clock-in");
  const [manualEmployeeSearch, setManualEmployeeSearch] = useState("");
  const [manualSelectedEmployee, setManualSelectedEmployee] =
    useState<Employee | null>(null);
  const [manualPieceQuantity, setManualPieceQuantity] = useState<
    number | string
  >(1);
  const [manualNotes, setManualNotes] = useState("");
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Manual Date/Time Selection State
  const [useManualDateTime, setUseManualDateTime] = useState(false);
  const [manualClockInDate, setManualClockInDate] = useState<Date | undefined>(
    undefined
  );
  const [manualClockOutDate, setManualClockOutDate] = useState<
    Date | undefined
  >(undefined);
  const [manualPieceworkDate, setManualPieceworkDate] = useState<
    Date | undefined
  >(undefined);

  // History filtering state
  const [historyStartDate, setHistoryStartDate] = useState<Date | undefined>(
    undefined
  );
  const [historyEndDate, setHistoryEndDate] = useState<Date | undefined>(
    undefined
  );

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "time" | "piecework";
    id: string;
  } | null>(null);

  // Delete all confirmation state
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    type: "time" | "piecework";
    entry: TimeEntry | Piecework;
  } | null>(null);
  const [editTimestamp, setEditTimestamp] = useState<Date | undefined>(
    undefined
  );
  const [editEndTime, setEditEndTime] = useState<Date | undefined>(undefined);
  const [editPiecesWorked, setEditPiecesWorked] = useState<number | string>(0);
  const [editPaymentModality, setEditPaymentModality] = useState<"Hourly" | "Piecework">("Hourly");

  // Debounce state
  const [recentScans, setRecentScans] = useState<
    { scanData: string; mode: ScanMode; timestamp: number }[]
  >([]);
  const DEBOUNCE_MS = 3000; // 3 seconds

  // Sick leave state
  const [sickHoursToUse, setSickHoursToUse] = useState<number | string>(0);
  const [sickLeaveDate, setSickLeaveDate] = useState<string>("");
  const [sickLeaveNotes, setSickLeaveNotes] = useState("");
  const [isLoggingSickLeave, setIsLoggingSickLeave] = useState(false);

  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "clients"), where("name", "!=", ""));
  }, [firestore]);
  const { data: clients } = useCollection<Client>(clientsQuery);

  const tasksQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "tasks"),
      where("status", "==", "Active")
    );
  }, [firestore]);
  const { data: allTasks } = useCollection<Task>(tasksQuery);

  const employeesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "employees"),
      where("status", "==", "Active")
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

  // Query for active time entries (for history tab)
  const activeTimeEntriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "time_entries"),
      where("endTime", "==", null)
    );
  }, [firestore]);
  const { data: activeTimeEntriesRaw } = useCollection<TimeEntry>(
    activeTimeEntriesQuery
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
          .filter(Boolean)
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

  const filteredManualEmployees = useMemo(() => {
    if (!activeEmployees) return [];
    if (!manualEmployeeSearch) return [];
    return activeEmployees.filter((emp) =>
      emp.name.toLowerCase().includes(manualEmployeeSearch.toLowerCase())
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

  const playSound = useCallback(
    (type: SoundType) => {
      if (!audioContext) return;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.3,
        audioContext.currentTime + 0.01
      );

      switch (type) {
        case "clock-in":
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          break;
        case "clock-out":
          oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
          break;
        case "piece":
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          break;
      }
      oscillator.type = "sine";

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(
        0.00001,
        audioContext.currentTime + 0.15
      );
    },
    [audioContext]
  );

  // Reset selections when client changes
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

  // Reset scans when mode changes
  useEffect(() => {
    setScannedSharedEmployees([]);
  }, [scanMode, isSharedPiece, selectedTask, pieceEntryMode]);

  // Reset manual employee selection when searching
  useEffect(() => {
    if (manualEmployeeSearch === "") {
      setManualSelectedEmployee(null);
    }
  }, [manualEmployeeSearch]);

  const clockInEmployee = useCallback(
    async (employee: Employee, taskId: string, customTimestamp?: Date) => {
      if (!firestore) return;
      const batch = writeBatch(firestore);

      const activeEntriesQuery = query(
        collection(firestore, "time_entries"),
        where("employeeId", "==", employee.id),
        where("endTime", "==", null)
      );

      try {
        const activeEntriesSnap = await getDocs(activeEntriesQuery);
        activeEntriesSnap.forEach((doc) => {
          batch.update(doc.ref, { endTime: customTimestamp || new Date() });
        });

        const newTimeEntryRef = doc(collection(firestore, "time_entries"));
        const newTimeEntry: Omit<TimeEntry, "id"> = {
          employeeId: employee.id,
          taskId: taskId,
          timestamp: customTimestamp || new Date(),
          endTime: null,
          isBreak: false,
        };
        batch.set(newTimeEntryRef, newTimeEntry);

        await batch.commit();
        playSound("clock-in");
        toast({
          title: "Clock In Successful",
          description: `Clocked in ${employee.name}.`,
        });
      } catch (serverError) {
        const permissionError = new FirestorePermissionError({
          path: "time_entries",
          operation: "write",
          requestResourceData: { message: `Clock-in for ${employee.name}` },
        });
        errorEmitter.emit("permission-error", permissionError);
      }
    },
    [firestore, toast, playSound]
  );

  const clockOutEmployee = useCallback(
    async (employee: Employee, taskId: string, customTimestamp?: Date) => {
      if (!firestore) return;

      const q = query(
        collection(firestore, "time_entries"),
        where("employeeId", "==", employee.id),
        where("endTime", "==", null) // Only clock out active entries
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
          const clockOutTime = customTimestamp || new Date();
          
          // Validate that clock-out is not before clock-in
          let hasInvalidClockOut = false;
          querySnapshot.forEach((docSnap) => {
            const entry = docSnap.data() as TimeEntry;
            const clockInTime = entry.timestamp instanceof Date
              ? entry.timestamp
              : (entry.timestamp as any)?.toDate?.()
              ? (entry.timestamp as any).toDate()
              : new Date(entry.timestamp as any);
            
            if (clockOutTime < clockInTime) {
              hasInvalidClockOut = true;
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
          await batch.commit();
          playSound("clock-out");
          toast({
            title: "Clock Out Successful",
            description: `Clocked out ${employee.name}.`,
          });
        }
      } catch (serverError) {
        const permissionError = new FirestorePermissionError({
          path: "time_entries",
          operation: "update",
          requestResourceData: { endTime: customTimestamp || new Date() },
        });
        errorEmitter.emit("permission-error", permissionError);
      }
    },
    [firestore, toast, playSound]
  );

  const recordPiecework = useCallback(
    async (
      employeeIds: string[],
      taskId: string,
      binQr: string,
      customTimestamp?: Date
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
              activeEmployees?.find((e) => e.qrCode === id)?.name || "Unknown"
          )
          .join(", ");
        toast({
          title: "Piecework Recorded",
          description: `1 piece recorded for ${employeeNames}.`,
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
    [firestore, toast, activeEmployees, playSound]
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
      const now = Date.now();

      const isDebounced = recentScans.some(
        (scan) =>
          now - scan.timestamp < DEBOUNCE_MS &&
          scan.scanData === scannedData &&
          scan.mode === scanMode
      );

      if (isDebounced) {
        return; // Silently ignore debounced scans
      }

      setRecentScans((prev) => [
        ...prev.filter((s) => now - s.timestamp < DEBOUNCE_MS),
        { scanData: scannedData, mode: scanMode, timestamp: now },
      ]);

      const scannedEmployee = activeEmployees?.find(
        (e) => e.qrCode === scannedData
      );

      if (scannedEmployee) {
        if (scanMode === "clock-in") {
          const timestamp = useManualDateTime ? manualClockInDate : undefined;
          await clockInEmployee(scannedEmployee, selectedTask, timestamp);
        } else if (scanMode === "clock-out") {
          const timestamp = useManualDateTime ? manualClockOutDate : undefined;
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
            timestamp
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
    ]
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

    if (manualLogType === "clock-in") {
      const timestamp = useManualDateTime ? manualClockInDate : undefined;
      await clockInEmployee(manualSelectedEmployee, selectedTask, timestamp);
    } else if (manualLogType === "clock-out") {
      const timestamp = useManualDateTime ? manualClockOutDate : undefined;
      await clockOutEmployee(manualSelectedEmployee, selectedTask, timestamp);
    } else if (manualLogType === "piecework") {
      const pieceCount =
        typeof manualPieceQuantity === "number"
          ? manualPieceQuantity
          : parseInt(String(manualPieceQuantity), 10);
      if (isNaN(pieceCount) || pieceCount <= 0) {
        toast({
          variant: "destructive",
          title: "Invalid Quantity",
          description: "Please enter a valid number of pieces.",
        });
        setIsManualSubmitting(false);
        return;
      }

      const newPiecework: Omit<Piecework, "id"> = {
        employeeId: manualSelectedEmployee.id,
        taskId: selectedTask,
        timestamp:
          useManualDateTime && manualPieceworkDate
            ? manualPieceworkDate
            : new Date(),
        pieceCount: pieceCount,
        pieceQrCode: "manual_entry",
        qcNote: manualNotes,
      };
      try {
        await addDoc(collection(firestore, "piecework"), newPiecework);
        playSound("piece");
        toast({
          title: "Piecework Recorded",
          description: `${pieceCount} piece(s) recorded for ${manualSelectedEmployee.name}.`,
        });
      } catch (serverError) {
        const permissionError = new FirestorePermissionError({
          path: "piecework",
          operation: "create",
          requestResourceData: newPiecework,
        });
        errorEmitter.emit("permission-error", permissionError);
      }
    }

    setManualSelectedEmployee(null);
    setManualEmployeeSearch("");
    setManualPieceQuantity(1);
    setManualNotes("");
    setIsManualSubmitting(false);
  };

  const handleManualPieceSubmit = async () => {
    if (!firestore || !selectedTask || scannedSharedEmployees.length === 0) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a task and scan at least one employee.",
      });
      return;
    }
    const pieceCount =
      typeof manualPieceQuantity === "number"
        ? manualPieceQuantity
        : parseInt(String(manualPieceQuantity), 10);
    if (isNaN(pieceCount) || pieceCount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Quantity",
        description: "Please enter a valid number of pieces.",
      });
      return;
    }

    setIsManualSubmitting(true);
    const employeeQrCodes = scannedSharedEmployees
      .map((id) => activeEmployees?.find((e) => e.id === id)?.qrCode)
      .filter(Boolean) as string[];
    if (employeeQrCodes.length > 0) {
      const timestamp = useManualDateTime ? manualPieceworkDate : undefined;
      await recordPiecework(
        employeeQrCodes,
        selectedTask,
        "manual_entry",
        timestamp
      );
    }
    setScannedSharedEmployees([]);
    setManualPieceQuantity(1);
    setIsManualSubmitting(false);
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
      where("endTime", "==", null)
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
          ? bulkClockOutDate
          : new Date();
      const updatedData = { endTime: timestamp };
      const batch = writeBatch(firestore);
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, updatedData);
      });

      await batch.commit();
      toast({
        title: "Bulk Clock Out Successful",
        description: `Successfully clocked out ${querySnapshot.size} employee(s) from the task.`,
      });
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: "time_entries", // Simplification
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
          ? bulkClockInDate
          : new Date();

      // For clock out of active sessions, use current time or 1 second before clock-in time
      // This prevents zero-duration entries
      const clockOutTimestamp =
        useBulkClockInManualDateTime && bulkClockInDate
          ? new Date(bulkClockInDate.getTime() - 1000) // 1 second before clock-in
          : new Date();

      // Sub-query for currently active entries of the selected employees
      const activeEntriesQuery = query(
        collection(firestore, "time_entries"),
        where("employeeId", "in", Array.from(selectedBulkInEmployees)),
        where("endTime", "==", null)
      );
      const activeEntriesSnap = await getDocs(activeEntriesQuery);

      // Clock out any active sessions for the selected employees
      activeEntriesSnap.forEach((doc) => {
        batch.update(doc.ref, { endTime: clockOutTimestamp });
      });

      // Clock in all selected employees for the new task
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

      await batch.commit();
      toast({
        title: "Bulk Clock In Successful",
        description: `Successfully clocked in ${selectedBulkInEmployees.size} employee(s).`,
      });
      setSelectedBulkInEmployees(new Set()); // Clear selection after success
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: "time_entries", // Simplification for batch write
        operation: "write",
        requestResourceData: {
          message: `Bulk clock in for ${selectedBulkInEmployees.size} employees`,
        },
      });
      errorEmitter.emit("permission-error", permissionError);
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
        description: "Time entry has been successfully deleted.",
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
        description: "Piecework record has been successfully deleted.",
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
      };

      if (editEndTime) {
        updateData.endTime = editEndTime;
      }

      // Only include piecesWorked if it's a valid number and greater than 0
      const pieces = typeof editPiecesWorked === 'number' ? editPiecesWorked : parseInt(String(editPiecesWorked), 10);
      if (!isNaN(pieces) && pieces > 0) {
        updateData.piecesWorked = pieces;
      }

      await updateDoc(
        doc(firestore, "time_entries", editTarget.entry.id),
        updateData
      );
      toast({
        title: "Entry Updated",
        description: "Time entry has been successfully updated.",
      });
      setEditDialogOpen(false);
      setEditTarget(null);
      setEditTimestamp(undefined);
      setEditEndTime(undefined);
      setEditPiecesWorked(0);
      setEditPaymentModality("Hourly");
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

    try {
      await updateDoc(doc(firestore, "piecework", editTarget.entry.id), {
        timestamp: editTimestamp,
      });
      toast({
        title: "Piecework Updated",
        description: "Piecework record has been successfully updated.",
      });
      setEditDialogOpen(false);
      setEditTarget(null);
      setEditTimestamp(undefined);
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

    setIsDeletingAll(true);

    try {
      const batch = writeBatch(firestore);
      let deleteCount = 0;

      // Delete all time entries in the current filter
      if (allTimeEntries && allTimeEntries.length > 0) {
        allTimeEntries.forEach((entry) => {
          const entryRef = doc(firestore, "time_entries", entry.id);
          batch.delete(entryRef);
          deleteCount++;
        });
      }

      // Delete all piecework records in the current filter
      if (allPiecework && allPiecework.length > 0) {
        allPiecework.forEach((piece) => {
          const pieceRef = doc(firestore, "piecework", piece.id);
          batch.delete(pieceRef);
          deleteCount++;
        });
      }

      if (deleteCount > 0) {
        await batch.commit();
        toast({
          title: "All Movements Deleted",
          description: `Successfully deleted ${deleteCount} record(s).`,
        });
      } else {
        toast({
          title: "No Records to Delete",
          description: "There are no movements in the current filter.",
        });
      }

      setDeleteAllConfirmOpen(false);
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

    const hours = typeof sickHoursToUse === 'number' ? sickHoursToUse : parseFloat(String(sickHoursToUse));
    
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
        description: `Employee only has ${availableHours.toFixed(2)} sick hours available.`,
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
      const [year, month, day] = sickLeaveDate.split('-').map(Number);
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
          description: "Please create an active task before logging sick leave.",
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
        description: `${hours} sick hours logged for ${manualSelectedEmployee.name}. New balance: ${newBalance.toFixed(2)} hrs`,
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

  const SelectionFields = ({ isManual = false }: { isManual?: boolean }) => (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
        isManual ? "p-4 border rounded-md" : ""
      }`}
    >
      <div className="space-y-2">
        <Label htmlFor={`client-select-${isManual}`}>Client</Label>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger id={`client-select-${isManual}`}>
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
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
          value={selectedRanch}
          onValueChange={setSelectedRanch}
          disabled={!selectedClient || ranches.length === 0}
        >
          <SelectTrigger id={`ranch-select-${isManual}`}>
            <SelectValue placeholder="Select a ranch" />
          </SelectTrigger>
          <SelectContent>
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
          value={selectedBlock}
          onValueChange={setSelectedBlock}
          disabled={!selectedRanch || blocks.length === 0}
        >
          <SelectTrigger id={`block-select-${isManual}`}>
            <SelectValue placeholder="Select a block" />
          </SelectTrigger>
          <SelectContent>
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
          value={selectedTask}
          onValueChange={setSelectedTask}
          disabled={filteredTasks.length === 0}
        >
          <SelectTrigger id={`task-select-${isManual}`}>
            <SelectValue placeholder="Select a task" />
          </SelectTrigger>
          <SelectContent>
            {filteredTasks?.map((task) => (
              <SelectItem key={task.id} value={task.id}>
                {task.name} ({task.variety})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs defaultValue="qr-scanner">
        <TabsList className="grid w-full grid-cols-3">
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
          <TabsTrigger value="history" className="text-xs sm:text-sm">
            <History className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">History</span>
            <span className="sm:hidden">History</span>
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
              </div>

              <div className="space-y-3 md:space-y-4 rounded-lg border bg-card text-card-foreground shadow-sm p-3 md:p-4">
                <Label className="font-semibold">Scan Mode</Label>
                <RadioGroup
                  value={scanMode}
                  onValueChange={(value: string) =>
                    setScanMode(value as ScanMode)
                  }
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
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
                    <RadioGroupItem value="clock-out" id="mode-clock-out" />
                    <div className="flex items-center gap-1 md:gap-2">
                      <LogOut className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
                      <p className="font-medium text-sm md:text-base">
                        Clock Out
                      </p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="mode-piece"
                    className="flex flex-1 items-center gap-3 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5 sm:col-span-2 lg:col-span-1"
                  >
                    <RadioGroupItem value="piece" id="mode-piece" />
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      <p className="font-medium">Piecework</p>
                    </div>
                  </Label>
                </RadioGroup>
              </div>

              {scanMode === "piece" && (
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="shared-piece-switch"
                      checked={isSharedPiece}
                      onCheckedChange={setIsSharedPiece}
                    />
                    <Label htmlFor="shared-piece-switch">
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
                      <RadioGroupItem value="scan" id="piece-scan" />
                      <Label htmlFor="piece-scan">Scan Bins</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="piece-manual" />
                      <Label htmlFor="piece-manual">Manual Count</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {pieceEntryMode === "scan" ? (
                <QrScanner onScanResult={handleScanResult} />
              ) : (
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity (Pieces/Bins)</Label>
                    <Input
                      id="quantity"
                      type="number"
                      placeholder="Enter number of pieces"
                      value={manualPieceQuantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        setManualPieceQuantity(
                          value === "" ? "" : parseInt(value, 10)
                        );
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (isNaN(value) || value <= 0) {
                          setManualPieceQuantity(1);
                        }
                      }}
                      min="1"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleManualPieceSubmit}
                    disabled={
                      isManualSubmitting || scannedSharedEmployees.length === 0
                    }
                  >
                    {isManualSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit Pieces
                  </Button>
                </div>
              )}

              {scanMode === "piece" && scannedSharedEmployees.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users />
                        Scanned Employees ({scannedSharedEmployees.length})
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
                          activeEmployees?.find((e) => e.id === id)?.name || id;
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
                    <p className="text-muted-foreground text-sm mt-4">
                      {isSharedPiece
                        ? `Ready: Scan another employee or ${
                            pieceEntryMode === "scan" ? "a bin" : "submit count"
                          }.`
                        : `Ready: ${
                            pieceEntryMode === "scan"
                              ? "Scan a bin"
                              : "submit count"
                          }.`}
                    </p>
                  </CardContent>
                </Card>
              )}
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
              </div>

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
                    <SelectItem value="piecework">Record Piecework</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

              {manualLogType === "piecework" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity (Pieces/Bins)</Label>
                    <Input
                      id="quantity"
                      type="number"
                      placeholder="Enter number of pieces"
                      value={manualPieceQuantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        setManualPieceQuantity(
                          value === "" ? "" : parseInt(value, 10)
                        );
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (isNaN(value) || value <= 0) {
                          setManualPieceQuantity(1);
                        }
                      }}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any relevant notes (e.g., QC issues)"
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                    />
                  </div>
                </>
              )}
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
              <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
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
              </div>

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
                              new Set(activeEmployees.map((e) => e.id))
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
              <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-task-select">Task</Label>
                <Select
                  value={selectedBulkTask}
                  onValueChange={setSelectedBulkTask}
                >
                  <SelectTrigger id="bulk-task-select">
                    <SelectValue placeholder="Select a task to bulk clock out" />
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
                Record time off using accumulated sick hours. Sick hours will be deducted from employee balance.
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
                          {employee.name} - {employee.sickHoursBalance?.toFixed(2) || "0.00"} sick hrs available
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
                      {manualSelectedEmployee.sickHoursBalance?.toFixed(2) || "0.00"} hrs
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
                  onChange={(e) => setSickHoursToUse(e.target.value === "" ? 0 : parseFloat(e.target.value))}
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
                {((allTimeEntries && allTimeEntries.length > 0) ||
                  (allPiecework && allPiecework.length > 0)) && (
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
                          const [year, month, day] = e.target.value.split('-').map(Number);
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
                          const [year, month, day] = e.target.value.split('-').map(Number);
                          setHistoryEndDate(new Date(year, month - 1, day));
                        } else {
                          setHistoryEndDate(undefined);
                        }
                      }}
                    />
                  </div>
                </div>
                {(historyStartDate || historyEndDate) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHistoryStartDate(undefined);
                      setHistoryEndDate(undefined);
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Time Entries Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-blue-600" />
                  Clock-In/Clock-Out Records
                </h3>
                {!allTimeEntries || allTimeEntries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p>No time entries found.</p>
                    {(historyStartDate || historyEndDate) && (
                      <p className="text-sm mt-2">
                        Try adjusting your date filter.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allTimeEntries.map((entry) => {
                      const employee = activeEmployees?.find(
                        (e) => e.id === entry.employeeId
                      );
                      const task = allTasks?.find((t) => t.id === entry.taskId);
                      const client = clients?.find(
                        (c) => c.id === task?.clientId
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
                          key={entry.id}
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
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditTarget({ type: "time", entry: entry });
                                setEditTimestamp(clockInTime);
                                setEditEndTime(clockOutTime || undefined);
                                setEditPiecesWorked(entry.piecesWorked || 0);
                                setEditPaymentModality(entry.paymentModality || "Hourly");
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDeleteTarget({ type: "time", id: entry.id });
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Piecework Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  Piecework Records
                </h3>
                {!allPiecework || allPiecework.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p>No piecework records found.</p>
                    {(historyStartDate || historyEndDate) && (
                      <p className="text-sm mt-2">
                        Try adjusting your date filter.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allPiecework.map((piece) => {
                      // Handle multiple employees (comma-separated IDs)
                      const employeeIds = piece.employeeId.split(",");
                      const employeeNames =
                        employeeIds
                          .map(
                            (id) =>
                              activeEmployees?.find(
                                (e) => e.id === id || e.qrCode === id
                              )?.name
                          )
                          .filter(Boolean)
                          .join(", ") || "Unknown Employee(s)";
                      const task = allTasks?.find((t) => t.id === piece.taskId);
                      const client = clients?.find(
                        (c) => c.id === task?.clientId
                      );
                      const pieceTime =
                        piece.timestamp instanceof Date
                          ? piece.timestamp
                          : (piece.timestamp as any)?.toDate
                          ? (piece.timestamp as any).toDate()
                          : new Date(piece.timestamp as any);

                      return (
                        <div
                          key={piece.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <p className="font-semibold">{employeeNames}</p>
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
                              <Calendar className="h-3 w-3 text-purple-600" />
                              <p className="text-muted-foreground">
                                {format(pieceTime, "PPp")}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-600" />
                                <p className="text-muted-foreground">
                                  Quantity: {piece.pieceCount}
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
                                setEditTarget({
                                  type: "piecework",
                                  entry: piece,
                                });
                                setEditTimestamp(pieceTime);
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
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
        onOpenChange={setDeleteAllConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Movements?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <strong>
                {(allTimeEntries?.length || 0) + (allPiecework?.length || 0)}{" "}
                record(s)
              </strong>{" "}
              ({allTimeEntries?.length || 0} time entries and{" "}
              {allPiecework?.length || 0} piecework records) from the database.
              These records will not appear in any reports.
              {(historyStartDate || historyEndDate) && (
                <span className="block mt-2 text-yellow-600 font-semibold">
                  Note: Only records matching your current date filter will be
                  deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteAllConfirmOpen(false)}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit{" "}
              {editTarget?.type === "time" ? "Time Entry" : "Piecework Record"}
            </DialogTitle>
            <DialogDescription>
              Update the timestamp{editTarget?.type === "time" ? "s" : ""} for
              this{" "}
              {editTarget?.type === "time" ? "time entry" : "piecework record"}.
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
            {editTarget?.type === "time" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-endtime">Clock-Out Time (optional)</Label>
                  <DateTimePicker
                    date={editEndTime}
                    setDate={setEditEndTime}
                    label=""
                    placeholder="Select date and time or leave empty"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pieces">Pieces Worked (optional)</Label>
                  <Input
                    id="edit-pieces"
                    type="number"
                    min="0"
                    placeholder="Enter number of pieces"
                    value={editPiecesWorked}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditPiecesWorked(value === "" ? 0 : parseInt(value, 10));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-modality">Payment Modality</Label>
                  <Select
                    value={editPaymentModality}
                    onValueChange={(value: "Hourly" | "Piecework") => setEditPaymentModality(value)}
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
