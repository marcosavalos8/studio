'use client'

import React, { useState, useEffect, useRef } from 'react'
import QrScanner from 'react-qr-scanner';
import { useToast } from "@/hooks/use-toast"
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"

type QrScannerComponentProps = {
    onScanResult: (result: string) => void;
}

export function QrScannerComponent({ onScanResult }: QrScannerComponentProps) {
    const { toast } = useToast();
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const getCameraPermission = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
            }
        };

        getCameraPermission();
    }, []);

    const handleScan = (result: any) => {
        if (result && result.text) {
            onScanResult(result.text);
        }
    }

    const handleError = (error: any) => {
        console.error(error);
        if (error.name === 'NotAllowedError' || error.name === 'NotFoundError' || error.name === 'NotReadableError') {
            setHasCameraPermission(false);
        }
    }
    
    if (hasCameraPermission === false) {
        return (
            <Alert variant="destructive">
                <AlertTitle>Camera Access Denied</AlertTitle>
                <AlertDescription>
                    Please allow camera access in your browser settings to use the scanner. You may need to refresh the page after granting permission.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
            <QrScanner
                onScan={handleScan}
                onError={handleError}
                constraints={{
                    video: { facingMode: 'environment' }
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
        </div>
    )
}
