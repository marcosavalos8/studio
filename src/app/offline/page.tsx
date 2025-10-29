'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Check online status
    const checkOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    checkOnlineStatus();

    // Listen for online/offline events
    window.addEventListener('online', checkOnlineStatus);
    window.addEventListener('offline', checkOnlineStatus);

    return () => {
      window.removeEventListener('online', checkOnlineStatus);
      window.removeEventListener('offline', checkOnlineStatus);
    };
  }, []);

  // Automatically redirect when back online
  useEffect(() => {
    if (isOnline) {
      // Try to go back to the previous page
      router.back();
    }
  }, [isOnline, router]);

  const handleRetry = () => {
    if (navigator.onLine) {
      router.back();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-orange-100 p-4">
              <WifiOff className="h-12 w-12 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">You're Offline</CardTitle>
          <CardDescription className="text-base mt-2">
            This page hasn't been loaded while online yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>What you can do:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Go back to a page you've visited before</li>
              <li>Connect to the internet and try again</li>
              <li>Visit all important pages while online to cache them for offline use</li>
            </ul>
          </div>

          <div className="pt-4 space-y-2">
            <Button 
              onClick={handleRetry} 
              className="w-full"
              variant={isOnline ? "default" : "outline"}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isOnline ? 'Back Online - Click to Retry' : 'Try Again'}
            </Button>
            
            <Button 
              onClick={() => router.push('/dashboard')} 
              variant="ghost"
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>

          {isOnline && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              ✓ You're back online! Click "Back Online - Click to Retry" to continue.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
