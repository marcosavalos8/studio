'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { QrCode, ClipboardEdit, Users, User, CheckCircle, Package, LogIn, LogOut, Loader2, VideoOff } from "lucide-react"
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import JSConfetti from 'js-confetti'
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase'
import { collection, query, where, getDocs, writeBatch, serverTimestamp, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore'
import type { Task, TimeEntry, Piecework, Employee, Client } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { FirestorePermissionError } from '@/firebase/errors'
import { errorEmitter } from '@/firebase/error-emitter'

const QrScanner = dynamic(() => import('./qr-scanner').then(mod => mod.QrScannerComponent), {
  ssr: false,
  loading: () => <Skeleton className="w-full aspect-video bg-muted rounded-md flex items-center justify-center"><VideoOff className="h-10 w-10 text-muted-foreground" /></Skeleton>,
})


type ScanMode = 'clock-in' | 'clock-out' | 'piece';
type ManualLogType = 'clock-in' | 'clock-out' | 'start-break' | 'end-break' | 'piecework';


export default function TimeTrackingPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  
  const [scanMode, setScanMode] = useState<ScanMode>('clock-in');
  const [isSharedPiece, setIsSharedPiece] = useState(false);
  
  const [scannedEmployees, setScannedEmployees] = useState<string[]>([]);
  const [scannedBin, setScannedBin] = useState<string | null>(null);

  const [jsConfetti, setJsConfetti] = useState<JSConfetti | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedBulkTask, setSelectedBulkTask] = useState<string>('');
  const [isBulkClockingOut, setIsBulkClockingOut] = useState(false);

  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedRanch, setSelectedRanch] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<string>('');
  
  // Manual Entry State
  const [manualLogType, setManualLogType] = useState<ManualLogType>('clock-in');
  const [manualEmployeeSearch, setManualEmployeeSearch] = useState('');
  const [manualSelectedEmployee, setManualSelectedEmployee] = useState<Employee | null>(null);
  const [manualPieceQuantity, setManualPieceQuantity] = useState(1);
  const [manualNotes, setManualNotes] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Debounce state
  const [recentScans, setRecentScans] = useState<{ employeeId: string; taskId: string; timestamp: number }[]>([]);
  const DEBOUNCE_MS = 30000; // 30 seconds

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore) return null
    return query(collection(firestore, "clients"), where("name", "!=", ""));
  }, [firestore]);
  const { data: clients } = useCollection<Client>(clientsQuery);
  
  const tasksQuery = useMemoFirebase(() => {
    if (!firestore) return null
    return query(collection(firestore, "tasks"), where("status", "==", "Active"));
  }, [firestore])
  const { data: allTasks } = useCollection<Task>(tasksQuery);
  
  const employeesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "employees"), where("status", "==", "Active"));
  }, [firestore]);
  const { data: activeEmployees } = useCollection<Employee>(employeesQuery);

  const tasksForClient = useMemo(() => {
    if (!allTasks || !selectedClient) return [];
    const clientData = clients?.find(c => c.id === selectedClient);
    if (!clientData) return [];
    return allTasks.filter(t => t.client === clientData.name);
  }, [allTasks, selectedClient, clients]);

  const ranches = useMemo(() => tasksForClient ? [...new Set(tasksForClient.map(t => t.ranch).filter(Boolean))] : [], [tasksForClient]);
  
  const blocks = useMemo(() => {
    if (!selectedRanch || !tasksForClient) return [];
    return [...new Set(tasksForClient.filter(t => t.ranch === selectedRanch).map(t => t.block).filter(Boolean))];
  }, [tasksForClient, selectedRanch]);
  
  const filteredTasks = useMemo(() => {
    if (!tasksForClient) return [];
    let filtered = tasksForClient;
    if (selectedRanch) {
      filtered = filtered.filter(t => t.ranch === selectedRanch);
    }
    if (selectedBlock) {
      filtered = filtered.filter(t => t.block === selectedBlock);
    }
    return filtered;
  }, [tasksForClient, selectedRanch, selectedBlock]);


  const currentTask = useMemo(() => allTasks?.find(t => t.id === selectedTask), [allTasks, selectedTask])

  const filteredManualEmployees = useMemo(() => {
    if (!activeEmployees) return [];
    if (!manualEmployeeSearch) return [];
    return activeEmployees.filter(emp => emp.name.toLowerCase().includes(manualEmployeeSearch.toLowerCase()));
  }, [activeEmployees, manualEmployeeSearch]);


  useEffect(() => {
    setJsConfetti(new JSConfetti());
    const initAudio = () => {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            setAudioContext(context);
            document.removeEventListener('click', initAudio);
        } catch (e) {
            console.error("Could not create audio context", e);
        }
    };
    document.addEventListener('click', initAudio);

    return () => {
        document.removeEventListener('click', initAudio);
        audioContext?.close();
    }
  }, []);

  // Reset selections when client changes
  useEffect(() => {
    setSelectedRanch('');
    setSelectedBlock('');
    setSelectedTask('');
  }, [selectedClient])

  useEffect(() => {
    setSelectedBlock('');
    setSelectedTask('');
  }, [selectedRanch]);

  useEffect(() => {
    setSelectedTask('');
  }, [selectedBlock]);


  // Reset scans when mode changes
  useEffect(() => {
    setScannedEmployees([]);
    setScannedBin(null);
  }, [scanMode, isSharedPiece, selectedTask]);
  
  // Reset manual employee selection when searching
  useEffect(() => {
    if(manualEmployeeSearch === '') {
        setManualSelectedEmployee(null);
    }
  }, [manualEmployeeSearch])

  const playBeep = (success = true) => {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = success ? 'sine' : 'sawtooth';
    oscillator.frequency.setValueAtTime(success ? 880 : 440, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }

  const handleScanResult = (scannedData: string) => {
      if (!selectedTask) {
          playBeep(false);
          toast({ variant: "destructive", title: "Task not selected", description: "Please select a client, ranch, block, and task before scanning." });
          return;
      }

      // Assuming employee QR codes are their document IDs
      const isEmployeeScan = !!activeEmployees?.find(e => e.id === scannedData);
      
      const now = Date.now();
      // Clean up old scans from the debounce buffer
      setRecentScans(prev => prev.filter(scan => now - scan.timestamp < DEBOUNCE_MS));

      if (isEmployeeScan) {
          const employeeId = scannedData;
          const isDuplicate = recentScans.some(
              scan => scan.employeeId === employeeId && scan.taskId === selectedTask
          );

          if (isDuplicate) {
              playBeep(false);
              toast({ variant: "destructive", title: "Duplicate Scan", description: "This employee was recently scanned for the same task." });
              return;
          }
          
          setRecentScans(prev => [...prev, { employeeId, taskId: selectedTask, timestamp: now }]);
      }


      playBeep();
      jsConfetti?.addConfetti({ confettiNumber: 30, confettiColors: ['#f59e0b', '#10b981', '#3b82f6'] });


      if (scanMode === 'piece') {
        if (isEmployeeScan) {
          const employeeId = scannedData;
            setScannedEmployees(prev => isSharedPiece ? [...prev, employeeId] : [employeeId]);
            const employeeName = activeEmployees?.find(e => e.id === employeeId)?.name || employeeId;
            toast({ title: "Employee Scanned", description: employeeName });
        } else { // It's a bin scan
          setScannedBin(scannedData);
          toast({ title: "Bin Scanned", description: scannedData });
        }
      } else { // Clock-in or Clock-out
        if (isEmployeeScan) {
          const employeeId = scannedData;
          if (!scannedEmployees.includes(employeeId)) {
            setScannedEmployees(prev => [...prev, employeeId]);
          }
          const employeeName = activeEmployees?.find(e => e.id === employeeId)?.name || employeeId;
          toast({ title: `Employee Ready for ${scanMode}`, description: employeeName });
        } else {
            playBeep(false);
            toast({ variant: "destructive", title: "Invalid Scan", description: "Expected an employee QR code."});
        }
      }
  }

  const handleSubmit = async () => {
    if (!firestore || !selectedTask || scannedEmployees.length === 0) {
        toast({ variant: "destructive", title: "Missing Information", description: "Task and at least one employee must be scanned." });
        return;
    }
    
    setIsSubmitting(true);
    const timeEntryCollection = collection(firestore, 'time_entries');
    const pieceworkCollection = collection(firestore, 'piecework');
    const updatedData = { endTime: new Date() };

    if (scanMode === 'clock-in') {
        const batch = writeBatch(firestore);
        scannedEmployees.forEach(employeeId => {
            const newTimeEntry: Omit<TimeEntry, 'id'> = {
                employeeId: employeeId,
                taskId: selectedTask,
                timestamp: new Date(),
                endTime: null,
                isBreak: false,
            };
            const docRef = doc(timeEntryCollection);
            batch.set(docRef, newTimeEntry);
        });
        batch.commit()
            .then(() => {
                toast({ title: "Clock In Successful", description: `Clocked in ${scannedEmployees.length} employee(s).` });
                setScannedEmployees([]);
                setScannedBin(null);
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: 'time_entries',
                    operation: 'create',
                    requestResourceData: { "message": `Batch write for ${scannedEmployees.length} employees`},
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => setIsSubmitting(false));

    } else if (scanMode === 'clock-out') {
        const q = query(
            timeEntryCollection,
            where('employeeId', 'in', scannedEmployees),
            where('taskId', '==', selectedTask),
            where('endTime', '==', null)
        );
        getDocs(q).then(querySnapshot => {
            if (querySnapshot.empty) {
                 toast({ variant: 'destructive', title: "Clock Out Failed", description: "No active clock-in found for the selected employees and task." });
                 setIsSubmitting(false);
            } else {
                const batch = writeBatch(firestore);
                querySnapshot.forEach(doc => {
                    batch.update(doc.ref, updatedData);
                });
                batch.commit()
                    .then(() => {
                        toast({ title: "Clock Out Successful", description: `Clocked out ${querySnapshot.size} employee(s).` });
                        setScannedEmployees([]);
                        setScannedBin(null);
                    })
                    .catch(async (serverError) => {
                        const permissionError = new FirestorePermissionError({
                            path: 'time_entries', 
                            operation: 'update',
                            requestResourceData: updatedData,
                        });
                        errorEmitter.emit('permission-error', permissionError);
                    })
                    .finally(() => setIsSubmitting(false));
            }
        });
    } else if (scanMode === 'piece') {
        if (!scannedBin) {
            toast({ variant: 'destructive', title: "Bin not scanned", description: "Please scan a bin QR code." });
            setIsSubmitting(false);
            return;
        }
        const newPiecework: Omit<Piecework, 'id'> = {
            employeeId: scannedEmployees.join(','), // For shared, join IDs
            taskId: selectedTask,
            timestamp: new Date(),
            pieceCount: 1, // Assume 1 bin per scan
            pieceQrCode: scannedBin,
        };
        addDoc(pieceworkCollection, newPiecework)
            .then(() => {
                toast({ title: "Piecework Recorded", description: `Bin ${scannedBin} recorded for ${scannedEmployees.length} employee(s).` });
                setScannedEmployees([]);
                setScannedBin(null);
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: pieceworkCollection.path,
                    operation: 'create',
                    requestResourceData: newPiecework,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => setIsSubmitting(false));
    }
  }

  const handleManualSubmit = async () => {
     if (!firestore || !selectedTask || !manualSelectedEmployee) {
        toast({ variant: "destructive", title: "Missing Information", description: "Please complete all fields." });
        return;
    }

    setIsManualSubmitting(true);
    const employeeId = manualSelectedEmployee.id;
    
    if (manualLogType === 'clock-in') {
        const newTimeEntry: Omit<TimeEntry, 'id'> = {
            employeeId: employeeId,
            taskId: selectedTask,
            timestamp: new Date(),
            endTime: null,
            isBreak: false,
        };
        addDoc(collection(firestore, 'time_entries'), newTimeEntry)
            .then(() => {
                toast({ title: "Clock In Successful", description: `Clocked in ${manualSelectedEmployee.name}.` });
                setManualSelectedEmployee(null);
                setManualEmployeeSearch('');
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: 'time_entries',
                    operation: 'create',
                    requestResourceData: newTimeEntry,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => setIsManualSubmitting(false));

    } else if (manualLogType === 'clock-out') {
         const q = query(
            collection(firestore, 'time_entries'),
            where('employeeId', '==', employeeId),
            where('taskId', '==', selectedTask),
            where('endTime', '==', null)
        );
        getDocs(q).then(querySnapshot => {
            if(querySnapshot.empty){
                toast({ variant: 'destructive', title: "Clock Out Failed", description: "No active clock-in found for this employee and task." });
                setIsManualSubmitting(false);
            } else {
                const updatedData = { endTime: new Date() };
                const docSnap = querySnapshot.docs[0];
                updateDoc(docSnap.ref, updatedData)
                .then(() => {
                    toast({ title: "Clock Out Successful", description: `Clocked out ${manualSelectedEmployee.name}.` });
                    setManualSelectedEmployee(null);
                    setManualEmployeeSearch('');
                })
                .catch(async (serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: docSnap.ref.path, 
                        operation: 'update',
                        requestResourceData: updatedData,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                })
                .finally(() => setIsManualSubmitting(false));
            }
        });

    } else if (manualLogType === 'piecework') {
        const newPiecework: Omit<Piecework, 'id'> = {
            employeeId: employeeId,
            taskId: selectedTask,
            timestamp: new Date(),
            pieceCount: manualPieceQuantity,
            pieceQrCode: 'manual_entry',
            qcNote: manualNotes,
        };
        addDoc(collection(firestore, 'piecework'), newPiecework)
            .then(() => {
                toast({ title: "Piecework Recorded", description: `${manualPieceQuantity} piece(s) recorded for ${manualSelectedEmployee.name}.` });
                setManualSelectedEmployee(null);
                setManualEmployeeSearch('');
                setManualPieceQuantity(1);
                setManualNotes('');
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: 'piecework',
                    operation: 'create',
                    requestResourceData: newPiecework,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => setIsManualSubmitting(false));
    }
  };


  const handleBulkClockOut = async () => {
    if (!firestore || !selectedBulkTask) {
        toast({ variant: "destructive", title: "Error", description: "Please select a task." });
        return;
    }

    setIsBulkClockingOut(true);
    const timeLogsRef = collection(firestore, 'time_entries');
    const q = query(
        timeLogsRef,
        where('taskId', '==', selectedBulkTask),
        where('endTime', '==', null)
    );

    getDocs(q).then(querySnapshot => {
        if (querySnapshot.empty) {
            toast({ title: "No one to clock out", description: "No employees are currently clocked in for this task." });
            setIsBulkClockingOut(false);
            return;
        }
        
        const updatedData = { endTime: new Date() };
        const batch = writeBatch(firestore);
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, updatedData);
        });

        batch.commit()
            .then(() => {
                toast({
                    title: "Bulk Clock Out Successful",
                    description: `Successfully clocked out ${querySnapshot.size} employee(s) from the task.`,
                });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: 'time_entries', // Simplification
                    operation: 'update',
                    requestResourceData: updatedData,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => setIsBulkClockingOut(false));
    });
  };

  const SelectionFields = ({ isManual = false }: { isManual?: boolean }) => (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isManual ? 'p-4 border rounded-md' : ''}`}>
        <div className="space-y-2">
          <Label htmlFor={`client-select-${isManual}`}>Client</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger id={`client-select-${isManual}`}>
                  <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                  {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`ranch-select-${isManual}`}>Ranch</Label>
          <Select value={selectedRanch} onValueChange={setSelectedRanch} disabled={!selectedClient || ranches.length === 0}>
              <SelectTrigger id={`ranch-select-${isManual}`}>
                  <SelectValue placeholder="Select a ranch" />
              </SelectTrigger>
              <SelectContent>
                  {ranches.map(ranch => (
                      <SelectItem key={ranch} value={ranch}>{ranch}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
         <div className="space-y-2">
          <Label htmlFor={`block-select-${isManual}`}>Block</Label>
          <Select value={selectedBlock} onValueChange={setSelectedBlock} disabled={!selectedRanch || blocks.length === 0}>
              <SelectTrigger id={`block-select-${isManual}`}>
                  <SelectValue placeholder="Select a block" />
              </SelectTrigger>
              <SelectContent>
                  {blocks.map(block => (
                      <SelectItem key={block} value={block}>{block}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`task-select-${isManual}`}>Task</Label>
          <Select value={selectedTask} onValueChange={setSelectedTask} disabled={filteredTasks.length === 0}>
              <SelectTrigger id={`task-select-${isManual}`}>
                  <SelectValue placeholder="Select a task" />
              </SelectTrigger>
              <SelectContent>
                  {filteredTasks?.map(task => (
                      <SelectItem key={task.id} value={task.id}>{task.name} ({task.variety})</SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
    </div>
  )


  return (
    <div className="max-w-4xl mx-auto">
      <Tabs defaultValue="qr-scanner">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="qr-scanner">
            <QrCode className="mr-2 h-4 w-4" />
            QR Scanner
          </TabsTrigger>
          <TabsTrigger value="manual-entry">
            <ClipboardEdit className="mr-2 h-4 w-4" />
            Manual Entry
          </TabsTrigger>
        </TabsList>
        <TabsContent value="qr-scanner">
          <Card>
            <CardHeader>
              <CardTitle>QR Code Scanner</CardTitle>
              <CardDescription>
                Select the task details and scan mode, then scan QR codes to log time and piecework.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SelectionFields />

               <div className="space-y-4 rounded-lg border bg-card text-card-foreground shadow-sm p-4">
                <Label className="font-semibold">Scan Mode</Label>
                 <RadioGroup
                    value={scanMode}
                    onValueChange={(value) => setScanMode(value as ScanMode)}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    <Label htmlFor="mode-clock-in" className="flex flex-1 items-center gap-3 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5">
                      <RadioGroupItem value="clock-in" id="mode-clock-in" />
                      <div className="flex items-center gap-2">
                        <LogIn className="h-5 w-5 text-green-600"/>
                        <p className="font-medium">Clock In</p>
                      </div>
                    </Label>
                    <Label htmlFor="mode-clock-out" className="flex flex-1 items-center gap-3 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5">
                      <RadioGroupItem value="clock-out" id="mode-clock-out" />
                      <div className="flex items-center gap-2">
                        <LogOut className="h-5 w-5 text-red-600"/>
                        <p className="font-medium">Clock Out</p>
                      </div>
                    </Label>
                    <Label htmlFor="mode-piece" className="flex flex-1 items-center gap-3 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5 sm:col-span-2 lg:col-span-1">
                      <RadioGroupItem value="piece" id="mode-piece" />
                      <div className="flex items-center gap-2">
                         <Package className="h-5 w-5 text-blue-600"/>
                        <p className="font-medium">Piecework</p>
                      </div>
                    </Label>
                 </RadioGroup>

                 {scanMode === 'piece' && (
                  <div className="flex items-center space-x-2 pt-4 border-t mt-4">
                    <Switch
                      id="shared-piece-switch"
                      checked={isSharedPiece}
                      onCheckedChange={setIsSharedPiece}
                    />
                    <Label htmlFor="shared-piece-switch" className="flex items-center gap-2">
                      {isSharedPiece ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      {isSharedPiece ? 'Shared Piece (Multiple Employees)' : 'Single Employee'}
                    </Label>
                  </div>
                 )}
               </div>

              <QrScanner onScanResult={handleScanResult} />
              
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {scanMode === 'piece' && (isSharedPiece ? <Users/> : <User/>)}
                        {scanMode !== 'piece' && <User/>}
                        Scanned Employees
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scannedEmployees.length > 0 ? (
                        <ul className="space-y-2">
                        {scannedEmployees.map((id) => {
                            const name = activeEmployees?.find(e => e.id === id)?.name || id;
                            return (
                                <li key={id} className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-5 w-5" />
                                    <p className="font-mono text-sm">{name}</p>
                                </li>
                            )
                        })}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground">No employees scanned yet.</p>
                    )}
                  </CardContent>
                </Card>
                 {scanMode === 'piece' && (
                    <Card>
                        <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Package/>Scanned Bin</CardTitle>
                        </CardHeader>
                        <CardContent>
                        {scannedBin ? (
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle className="h-5 w-5" />
                                <p className="font-mono text-sm">{scannedBin}</p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No bin scanned yet.</p>
                        )}
                        </CardContent>
                    </Card>
                 )}
              </div>
              <Button onClick={handleSubmit} disabled={isSubmitting || scannedEmployees.length === 0 || (scanMode === 'piece' && !scannedBin)} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Submit {scanMode === 'clock-in' ? 'Clock In(s)' : scanMode === 'clock-out' ? 'Clock Out(s)' : 'Piecework'}
              </Button>
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
                <Select value={manualLogType} onValueChange={(v) => setManualLogType(v as ManualLogType)}>
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
                        <User className="h-4 w-4"/>
                        <span>{manualSelectedEmployee.name}</span>
                        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => {
                            setManualSelectedEmployee(null)
                            setManualEmployeeSearch('')
                        }}>Change</Button>
                    </div>
                ) : (
                    <>
                        <Input 
                            id="employee-search" 
                            placeholder="Search for an active employee..."
                            value={manualEmployeeSearch}
                            onChange={(e) => setManualEmployeeSearch(e.target.value)}
                        />
                        {manualEmployeeSearch && filteredManualEmployees && filteredManualEmployees.length > 0 && (
                            <div className="border rounded-md max-h-48 overflow-y-auto">
                                {filteredManualEmployees.map(employee => (
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
                         {manualEmployeeSearch && filteredManualEmployees && filteredManualEmployees.length === 0 && (
                            <p className="p-4 text-sm text-muted-foreground">No employees found.</p>
                         )}
                    </>
                )}
              </div>
              
              {manualLogType === 'piecework' && (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity (Pieces/Bins)</Label>
                        <Input 
                            id="quantity" 
                            type="number" 
                            placeholder="Enter number of pieces" 
                            value={manualPieceQuantity}
                            onChange={(e) => setManualPieceQuantity(parseInt(e.target.value, 10) || 1)}
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
              <Button className="w-full" onClick={handleManualSubmit} disabled={isManualSubmitting || !manualSelectedEmployee || !selectedTask}>
                {isManualSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Submit Log
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
                    <Select value={selectedBulkTask} onValueChange={setSelectedBulkTask}>
                        <SelectTrigger id="bulk-task-select">
                            <SelectValue placeholder="Select a task to bulk clock out" />
                        </SelectTrigger>
                        <SelectContent>
                            {allTasks?.filter(t => t.status === 'Active').map(task => (
                                <SelectItem key={task.id} value={task.id}>{task.name} ({task.client})</SelectItem>
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
                    {isBulkClockingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Clock Out All
                </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
