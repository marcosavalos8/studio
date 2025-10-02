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
import type { Task, TimeEntry, Piecework, Employee } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'

const QrScanner = dynamic(() => import('./qr-scanner').then(mod => mod.QrScannerComponent), {
  ssr: false,
  loading: () => <Skeleton className="w-full aspect-video bg-muted rounded-md" />,
})


type ScanMode = 'clock-in' | 'clock-out' | 'piece';

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

  const [selectedTask, setSelectedTask] = useState<string>('');
  const [selectedRanch, setSelectedRanch] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  
  const [manualEmployeeSearch, setManualEmployeeSearch] = useState('');
  const [manualSelectedEmployee, setManualSelectedEmployee] = useState<Employee | null>(null);


  const tasksQuery = useMemoFirebase(() => {
    if (!firestore) return null
    return query(collection(firestore, "tasks"), where("status", "==", "Active"));
  }, [firestore])
  const { data: tasks } = useCollection<Task>(tasksQuery);
  
  const employeesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "employees"), where("status", "==", "Active"));
  }, [firestore]);
  const { data: activeEmployees } = useCollection<Employee>(employeesQuery);

  const ranches = useMemo(() => tasks ? [...new Set(tasks.map(t => t.ranch).filter(Boolean))] : [], [tasks]);
  const blocks = useMemo(() => {
    if (!selectedRanch || !tasks) return [];
    return [...new Set(tasks.filter(t => t.ranch === selectedRanch).map(t => t.block).filter(Boolean))];
  }, [tasks, selectedRanch]);

  const currentTask = useMemo(() => tasks?.find(t => t.id === selectedTask), [tasks, selectedTask])

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
          toast({ variant: "destructive", title: "Task not selected", description: "Please select a task, ranch, and block before scanning." });
          return;
      }

      playBeep();
      jsConfetti?.addConfetti({ confettiNumber: 30, confettiColors: ['#f59e0b', '#10b981', '#3b82f6'] });

      // Assuming employee QR codes are their document IDs
      const isEmployeeScan = !!activeEmployees?.find(e => e.id === scannedData);


      if (scanMode === 'piece') {
        if (isEmployeeScan) {
          const employeeId = scannedData;
          if (scannedEmployees.includes(employeeId)) {
            playBeep(false);
            toast({ variant: "destructive", title: "Duplicate Employee Scan", description: `Employee already scanned for this piece.` });
          } else {
            setScannedEmployees(prev => isSharedPiece ? [...prev, employeeId] : [employeeId]);
            const employeeName = activeEmployees?.find(e => e.id === employeeId)?.name || employeeId;
            toast({ title: "Employee Scanned", description: employeeName });
          }
        } else { // It's a bin scan
          setScannedBin(scannedData);
          toast({ title: "Bin Scanned", description: scannedData });
        }
      } else { // Clock-in or Clock-out
        if (isEmployeeScan) {
          const employeeId = scannedData;
           if (scannedEmployees.includes(employeeId)) {
            playBeep(false);
            toast({ variant: "destructive", title: "Duplicate Scan", description: `Employee already scanned for ${scanMode}.` });
          } else {
            setScannedEmployees(prev => [...prev, employeeId]);
            const employeeName = activeEmployees?.find(e => e.id === employeeId)?.name || employeeId;
            toast({ title: `Employee Ready for ${scanMode}`, description: employeeName });
          }
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
    
    try {
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
                const docRef = doc(collection(firestore, 'time_entries'));
                batch.set(docRef, newTimeEntry);
            });
            await batch.commit();
            toast({ title: "Clock In Successful", description: `Clocked in ${scannedEmployees.length} employee(s).` });

        } else if (scanMode === 'clock-out') {
            const q = query(
                collection(firestore, 'time_entries'),
                where('employeeId', 'in', scannedEmployees),
                where('taskId', '==', selectedTask),
                where('endTime', '==', null)
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                 toast({ variant: 'destructive', title: "Clock Out Failed", description: "No active clock-in found for the selected employees and task." });
            } else {
                const batch = writeBatch(firestore);
                querySnapshot.forEach(doc => {
                    batch.update(doc.ref, { endTime: serverTimestamp() });
                });
                await batch.commit();
                toast({ title: "Clock Out Successful", description: `Clocked out ${querySnapshot.size} employee(s).` });
            }
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
            await addDoc(collection(firestore, 'piecework'), newPiecework);
            toast({ title: "Piecework Recorded", description: `Bin ${scannedBin} recorded for ${scannedEmployees.length} employee(s).` });
        }
        
        // Reset after successful submission
        setScannedEmployees([]);
        setScannedBin(null);

    } catch (error: any) {
        console.error("Submission Error:", error);
        toast({ variant: 'destructive', title: "Submission Failed", description: error.message || "An unexpected error occurred." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleBulkClockOut = async () => {
    if (!firestore || !selectedBulkTask) {
        toast({ variant: "destructive", title: "Error", description: "Please select a task." });
        return;
    }

    setIsBulkClockingOut(true);
    try {
        const timeLogsRef = collection(firestore, 'time_entries');
        const q = query(
            timeLogsRef,
            where('taskId', '==', selectedBulkTask),
            where('endTime', '==', null)
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            toast({ title: "No one to clock out", description: "No employees are currently clocked in for this task." });
            setIsBulkClockingOut(false);
            return;
        }

        const batch = writeBatch(firestore);
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, { endTime: serverTimestamp() });
        });

        await batch.commit();

        toast({
            title: "Bulk Clock Out Successful",
            description: `Successfully clocked out ${querySnapshot.size} employee(s) from the task.`,
        });

    } catch (error) {
        console.error("Error during bulk clock out:", error);
        toast({ variant: "destructive", title: "Error", description: "An error occurred during bulk clock out." });
    } finally {
        setIsBulkClockingOut(false);
    }
  };


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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-select">Task</Label>
                    <Select value={selectedTask} onValueChange={setSelectedTask}>
                        <SelectTrigger id="task-select">
                            <SelectValue placeholder="Select a task" />
                        </SelectTrigger>
                        <SelectContent>
                            {tasks?.map(task => (
                                <SelectItem key={task.id} value={task.id}>{task.name} ({task.variety})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ranch-select">Ranch</Label>
                    <Select value={selectedRanch} onValueChange={setSelectedRanch}>
                        <SelectTrigger id="ranch-select">
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
                    <Label htmlFor="block-select">Block</Label>
                    <Select value={selectedBlock} onValueChange={setSelectedBlock} disabled={!selectedRanch}>
                        <SelectTrigger id="block-select">
                            <SelectValue placeholder="Select a block" />
                        </SelectTrigger>
                        <SelectContent>
                            {blocks.map(block => (
                                <SelectItem key={block} value={block}>{block}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
              </div>

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
                Manually log time, breaks, or piecework if QR codes are unavailable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="log-type">Log Type</Label>
                <Select>
                  <SelectTrigger id="log-type">
                    <SelectValue placeholder="Select log type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clock-in">Clock In</SelectItem>
                    <SelectItem value="clock-out">Clock Out</SelectItem>
                    <SelectItem value="start-break">Start Break</SelectItem>
                    <SelectItem value="end-break">End Break</SelectItem>
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
                        {manualEmployeeSearch && filteredManualEmployees.length > 0 && (
                            <div className="border rounded-md max-h-48 overflow-y-auto">
                                {filteredManualEmployees.map(employee => (
                                    <Button 
                                        key={employee.id} 
                                        variant="ghost" 
                                        className="w-full justify-start"
                                        onClick={() => {
                                            setManualSelectedEmployee(employee);
                                            setManualEmployeeSearch('');
                                        }}
                                    >
                                        {employee.name}
                                    </Button>
                                ))}
                            </div>
                        )}
                         {manualEmployeeSearch && filteredManualEmployees.length === 0 && (
                            <p className="p-4 text-sm text-muted-foreground">No employees found.</p>
                         )}
                    </>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-id">Bin / Task ID</Label>
                <Input id="task-id" placeholder="Enter Bin or Task QR Code ID" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (for piecework)</Label>
                <Input id="quantity" type="number" placeholder="Enter number of pieces" />
              </div>
               <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" placeholder="Add any relevant notes (e.g., QC issues)" />
              </div>
              <Button className="w-full">Submit Log</Button>
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
                            {tasks?.map(task => (
                                <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Button 
                    className="w-full" 
                    onClick={handleBulkClockOut}
                    disabled={isBulkClockingOut || !selectedBulkTask}
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
