'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Component that pre-caches important app pages on mount.
 * This ensures all pages are available offline even if not visited yet.
 */
export function PagePrecacher() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');

  useEffect(() => {
    // Only run once
    if (status !== 'idle') return;

    // List of all important pages to pre-cache
    const pagesToCache = [
      '/',
      '/login',
      '/dashboard',
      '/clients',
      '/employees',
      '/tasks',
      '/time-tracking',
      '/payroll',
      '/invoicing',
      '/offline',
    ];

    const precachePages = async () => {
      setStatus('loading');
      
      try {
        // Use Next.js router prefetch to preload pages
        // This is more reliable than fetch for Next.js pages
        pagesToCache.forEach((path) => {
          try {
            router.prefetch(path);
            console.log(`Prefetching: ${path}`);
          } catch (error) {
            console.warn(`Failed to prefetch ${path}:`, error);
          }
        });

        // Also try to fetch pages for service worker caching
        const fetchPromises = pagesToCache.map(async (path) => {
          try {
            // Fetch the page - this will trigger the service worker to cache it
            const response = await fetch(path, {
              method: 'GET',
              credentials: 'same-origin',
            });
            
            if (response.ok) {
              console.log(`Cached: ${path}`);
            } else {
              console.warn(`Failed to cache ${path}: ${response.status}`);
            }
          } catch (error) {
            console.warn(`Failed to cache ${path}:`, error);
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
  }, [status, router]);

  // This component doesn't render anything
  return null;
}
