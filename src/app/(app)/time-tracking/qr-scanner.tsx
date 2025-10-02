'use client'

import React, { useState, useEffect } from 'react'
import QrScanner from 'react-qr-scanner'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert"
import { VideoOff } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type QrScannerComponentProps = {
    onScanResult: (result: string) => void;
}

export function QrScannerComponent({ onScanResult }: QrScannerComponentProps) {
    const [error, setError] = useState<string | null>(null)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    const handleScan = (result: any) => {
        if (result && result.text) {
            onScanResult(result.text)
        }
    }

    const handleError = (err: any) => {
        console.error(err)
        if (err.name === 'NotAllowedError') {
            setError('Camera access was denied. Please enable it in your browser settings.')
        } else if (err.name === 'NotFoundError') {
            setError('No camera found. Please ensure a camera is connected and enabled.')
        } else {
            setError('An unexpected error occurred with the camera.')
        }
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

    if (!isClient) {
        return <Skeleton className="w-full aspect-video bg-muted rounded-md flex items-center justify-center"><VideoOff className="h-10 w-10 text-muted-foreground" /></Skeleton>
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