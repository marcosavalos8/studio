'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"
import { VideoOff, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import jsQR from "jsqr";

type QrScannerComponentProps = {
    onScanResult: (result: string) => void;
}

export function QrScannerComponent({ onScanResult }: QrScannerComponentProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [isClient, setIsClient] = useState(false);
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    const onScan = useCallback((result: string) => {
        onScanResult(result);
    }, [onScanResult]);


    useEffect(() => {
        if (!isClient) return;

        const getCameraPermission = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
            } catch (err) {
                console.error("Camera access error:", err);
                setHasCameraPermission(false);
                if ((err as Error).name === 'NotAllowedError') {
                    setError('Camera access was denied. Please enable it in your browser settings.');
                } else {
                    setError('Could not access the camera. Please ensure it is not in use by another application.');
                }
            }
        };

        getCameraPermission();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isClient]);

    useEffect(() => {
        if (!hasCameraPermission || !videoRef.current) return;

        let animationFrameId: number;
        
        const scan = () => {
            animationFrameId = requestAnimationFrame(scan);
            
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                if (canvas) {
                    const context = canvas.getContext('2d', { willReadFrequently: true });
                    if (context) {
                        canvas.height = video.videoHeight;
                        canvas.width = video.videoWidth;
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                        
                        const code = jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: 'dontInvert',
                        });

                        if (code && code.data) {
                           onScan(code.data);
                        }
                    }
                }
            }
        };

        scan();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [hasCameraPermission, onScan]);
    
    if (!isClient) {
      return <Skeleton className="w-full aspect-video bg-muted rounded-md flex items-center justify-center"><VideoOff className="h-10 w-10 text-muted-foreground" /></Skeleton>
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <VideoOff className="h-4 w-4" />
                <AlertTitle>Camera Error</AlertTitle>
                <AlertDescription>
                    {error} You may need to refresh the page after granting permission.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden relative">
           <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
           <canvas ref={canvasRef} style={{ display: 'none' }} />
           <div className="absolute inset-0 border-4 border-primary/50 rounded-md pointer-events-none" />
           {hasCameraPermission === false && (
                <Alert variant="destructive" className="absolute">
                    <VideoOff className="h-4 w-4" />
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                        Please grant camera permission to use the scanner.
                    </AlertDescription>
                </Alert>
           )}
           {hasCameraPermission === null && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                    <p className="text-white mt-2">Initializing camera...</p>
                 </div>
           )}
        </div>
    )
}
