'use client';

import { useEffect, useState } from 'react';

/**
 * Component that pre-caches important app pages on mount.
 * This ensures all pages are available offline even if not visited yet.
 */
export function PagePrecacher() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');

  useEffect(() => {
    // Only run once
    if (status !== 'idle') return;

    // List of all important pages to pre-cache
    const pagesToCache = [
      '/dashboard',
      '/clients',
      '/employees',
      '/tasks',
      '/time-tracking',
      '/payroll',
      '/invoicing',
    ];

    const precachePages = async () => {
      setStatus('loading');
      
      try {
        // Use fetch with cache: 'reload' to ensure pages are cached by the service worker
        const fetchPromises = pagesToCache.map(async (path) => {
          try {
            // Fetch the page - this will trigger the service worker to cache it
            await fetch(path, {
              method: 'GET',
              cache: 'reload', // Force network request to populate cache
            });
            console.log(`Pre-cached: ${path}`);
          } catch (error) {
            console.warn(`Failed to pre-cache ${path}:`, error);
          }
        });

        // Wait for all pages to be fetched
        await Promise.all(fetchPromises);
        
        setStatus('loaded');
        console.log('All pages pre-cached successfully');
      } catch (error) {
        console.error('Error pre-caching pages:', error);
        setStatus('loaded'); // Mark as loaded even on error to prevent retries
      }
    };

    // Start pre-caching after a short delay to not block initial render
    const timeoutId = setTimeout(() => {
      precachePages();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [status]);

  // This component doesn't render anything
  return null;
}
