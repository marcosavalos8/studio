"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
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
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
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

  // Bulk clock in
  const [isBulkClockingIn, setIsBulkClockingIn] = useState(false);
  const [selectedBulkInTask, setSelectedBulkInTask] = useState<string>("");
  const [selectedBulkInEmployees, setSelectedBulkInEmployees] = useState<
    Set<string>
  >(new Set());

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

  // Debounce state
  const [recentScans, setRecentScans] = useState<
    { scanData: string; mode: ScanMode; timestamp: number }[]
  >([]);
  const DEBOUNCE_MS = 3000; // 3 seconds

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
    async (employee: Employee, taskId: string) => {
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
          batch.update(doc.ref, { endTime: new Date() });
        });

        const newTimeEntryRef = doc(collection(firestore, "time_entries"));
        const newTimeEntry: Omit<TimeEntry, "id"> = {
          employeeId: employee.id,
          taskId: taskId,
          timestamp: new Date(),
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
    async (employee: Employee, taskId: string) => {
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
          const batch = writeBatch(firestore);
          const updatedData = { endTime: new Date() };
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
          requestResourceData: { endTime: new Date() },
        });
        errorEmitter.emit("permission-error", permissionError);
      }
    },
    [firestore, toast, playSound]
  );

  const recordPiecework = useCallback(
    async (employeeIds: string[], taskId: string, binQr: string) => {
      if (!firestore) return;

      const newPiecework: Omit<Piecework, "id"> = {
        employeeId: employeeIds.join(","),
        taskId: taskId,
        timestamp: new Date(),
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
          await clockInEmployee(scannedEmployee, selectedTask);
        } else if (scanMode === "clock-out") {
          await clockOutEmployee(scannedEmployee, selectedTask);
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
          await recordPiecework(employeeQrCodes, selectedTask, scannedData);
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
      await clockInEmployee(manualSelectedEmployee, selectedTask);
    } else if (manualLogType === "clock-out") {
      await clockOutEmployee(manualSelectedEmployee, selectedTask);
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
        timestamp: new Date(),
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
      await recordPiecework(employeeQrCodes, selectedTask, "manual_entry");
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

      const updatedData = { endTime: new Date() };
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
          data: { endTime: new Date() },
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

      // Sub-query for currently active entries of the selected employees
      const activeEntriesQuery = query(
        collection(firestore, "time_entries"),
        where("employeeId", "in", Array.from(selectedBulkInEmployees)),
        where("endTime", "==", null)
      );
      const activeEntriesSnap = await getDocs(activeEntriesQuery);

      // Clock out any active sessions for the selected employees
      activeEntriesSnap.forEach((doc) => {
        batch.update(doc.ref, { endTime: new Date() });
      });

      // Clock in all selected employees for the new task
      selectedBulkInEmployees.forEach((employeeId) => {
        const newTimeEntryRef = doc(collection(firestore, "time_entries"));
        const newTimeEntry: Omit<TimeEntry, "id"> = {
          employeeId: employeeId,
          taskId: selectedBulkInTask,
          timestamp: new Date(),
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
        <TabsList className="grid w-full grid-cols-2">
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
        </TabsList>
        <TabsContent value="qr-scanner">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">QR Code Scanner</CardTitle>
              <CardDescription className="text-sm">
                Select task and mode. Actions are processed automatically upon
                valid scan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4">
              <SelectionFields />

              <div className="space-y-3 md:space-y-4 rounded-lg border bg-card text-card-foreground shadow-sm p-3 md:p-4">
                <Label className="font-semibold">Scan Mode</Label>
                <RadioGroup
                  value={scanMode}
                  onValueChange={(value: string) => setScanMode(value as ScanMode)}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                >
                  <Label
                    htmlFor="mode-clock-in"
                    className="flex flex-1 items-center gap-2 md:gap-3 rounded-md border p-2 md:p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value="clock-in" id="mode-clock-in" />
                    <div className="flex items-center gap-1 md:gap-2">
                      <LogIn className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                      <p className="font-medium text-sm md:text-base">Clock In</p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="mode-clock-out"
                    className="flex flex-1 items-center gap-2 md:gap-3 rounded-md border p-2 md:p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
                  >
                    <RadioGroupItem value="clock-out" id="mode-clock-out" />
                    <div className="flex items-center gap-1 md:gap-2">
                      <LogOut className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
                      <p className="font-medium text-sm md:text-base">Clock Out</p>
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
                    onValueChange={(v) =>
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

              <div className="space-y-2">
                <Label htmlFor="log-type">Log Type</Label>
                <Select
                  value={manualLogType}
                  onValueChange={(v) => setManualLogType(v as ManualLogType)}
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
                        onCheckedChange={(checked) => {
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
                          onCheckedChange={(checked) => {
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(TimeTrackingPage);
