'use client'

import React, { useState, useEffect, useRef } from 'react'
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { QrCode, ClipboardEdit, Users, User, CheckCircle } from "lucide-react"
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { QrScanner } from 'react-qr-scanner';
import JSConfetti from 'js-confetti'

type ScanMode = 'time' | 'piece';

export default function TimeTrackingPage() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(true);
  const [scanMode, setScanMode] = useState<ScanMode>('time');
  const [isSharedPiece, setIsSharedPiece] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const { toast } = useToast();
  const [jsConfetti, setJsConfetti] = useState<JSConfetti | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Initialize JSConfetti and AudioContext on the client-side
    setJsConfetti(new JSConfetti());
    // Create AudioContext after a user gesture (e.g., component mount)
    const initAudio = () => {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(context);
        document.removeEventListener('click', initAudio);
    };
    document.addEventListener('click', initAudio);

    return () => {
        document.removeEventListener('click', initAudio);
        audioContext?.close();
    }
  }, []);

  const playBeep = () => {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }

  const handleScan = (result: any) => {
    if (result) {
      const scannedData = result?.text;
      if (scannedData && scannedData !== lastScanned) {
        setLastScanned(scannedData);
        
        playBeep();
        jsConfetti?.addConfetti();

        toast({
          title: "Scan Successful",
          description: `QR Code scanned: ${scannedData}`,
        });
      }
    }
  }

  const handleError = (error: any) => {
    console.error(error);
    if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
        setHasCameraPermission(false);
    }
  }


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
                Select the mode and scan QR codes for employees and tasks to log time and piecework.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-4 rounded-lg border bg-card text-card-foreground shadow-sm p-4">
                <Label className="font-semibold">Scan Mode</Label>
                 <RadioGroup
                    defaultValue="time"
                    value={scanMode}
                    onValueChange={(value: ScanMode) => setScanMode(value)}
                    className="flex flex-col sm:flex-row gap-4"
                  >
                    <Label htmlFor="mode-time" className="flex flex-1 items-center gap-3 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5">
                      <RadioGroupItem value="time" id="mode-time" />
                      <div className="space-y-1">
                        <p className="font-medium">Time Clock</p>
                        <p className="text-sm text-muted-foreground">Scan for employee clock-in and clock-out.</p>
                      </div>
                    </Label>
                    <Label htmlFor="mode-piece" className="flex flex-1 items-center gap-3 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground has-[input:checked]:border-primary has-[input:checked]:bg-primary/5">
                      <RadioGroupItem value="piece" id="mode-piece" />
                      <div className="space-y-1">
                        <p className="font-medium">Piecework</p>
                        <p className="text-sm text-muted-foreground">Scan to record piecework for tasks.</p>
                      </div>
                    </Label>
                 </RadioGroup>

                 {scanMode === 'piece' && (
                  <div className="flex items-center space-x-2 pt-2">
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

              <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                <QrScanner
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{
                    video: { facingMode: 'environment' }
                  }}
                  styles={{
                    container: { width: '100%', paddingTop: 0 },
                    video: { width: '100%', height: '100%', objectFit: 'cover' }
                  }}
                />
              </div>
              {hasCameraPermission === false && (
                <Alert variant="destructive">
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Please allow camera access to use this feature. You may need to refresh the page after granting permission.
                  </AlertDescription>
                </Alert>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Last Scanned</CardTitle>
                </CardHeader>
                <CardContent>
                  {lastScanned ? (
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <p className="font-mono text-sm">{lastScanned}</p>
                    </div>
                  ) : (
                     <p className="text-muted-foreground">No QR code scanned yet.</p>
                  )}
                </CardContent>
              </Card>
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
                <Label htmlFor="employee-id">Employee ID</Label>
                <Input id="employee-id" placeholder="Enter Employee QR Code ID" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-id">Task / Lot ID</Label>
                <Input id="task-id" placeholder="Enter Task or Lot QR Code ID" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
