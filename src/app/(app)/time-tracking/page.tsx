'use client'

import React, { useState, useRef, useEffect } from 'react'
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
import { QrCode, ClipboardEdit } from "lucide-react"

export default function TimeTrackingPage() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };

    getCameraPermission();
  }, [toast]);

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
                Scan QR codes for employees and tasks to log time and piecework.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted />
              </div>
              {hasCameraPermission === false && (
                <Alert variant="destructive">
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                    Please allow camera access to use this feature.
                  </AlertDescription>
                </Alert>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Last Scanned</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No QR code scanned yet.</p>
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
