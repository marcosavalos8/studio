'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';

/**
 * Component that pre-fetches all important Firestore collections on mount.
 * This ensures all data is cached and available offline.
 * 
 * The component loads data silently in the background without affecting UI.
 */
export function DataPrecacher() {
  const firestore = useFirestore();
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');

  useEffect(() => {
    // Only run once
    if (status !== 'idle' || !firestore) return;

    const prefetchCollections = async () => {
      setStatus('loading');
      
      try {
        // List of all important collections to pre-fetch
        const collections = [
          'clients',
          'tasks',
          'employees',
          'time_entries',
          'piecework',
          'payroll',
        ];

        console.log('Starting data pre-fetch for offline support...');

        // Fetch all collections in parallel
        const fetchPromises = collections.map(async (collectionName) => {
          try {
            const collectionRef = collection(firestore, collectionName);
            const snapshot = await getDocs(collectionRef);
            
            // Store in sessionStorage cache
            const cacheKey = `firestore_cache_${collectionName}`;
            const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            const cacheEntry = {
              data,
              timestamp: Date.now(),
            };
            
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
                console.log(`Pre-fetched and cached: ${collectionName} (${data.length} items)`);
              } catch (err) {
                console.warn(`Failed to cache ${collectionName}:`, err);
              }
            }
          } catch (error) {
            console.warn(`Failed to pre-fetch ${collectionName}:`, error);
          }
        });

        // Wait for all collections to be fetched
        await Promise.all(fetchPromises);
        
        setStatus('loaded');
        console.log('All data pre-fetched successfully - app is ready for offline use');
      } catch (error) {
        console.error('Error pre-fetching data:', error);
        setStatus('loaded'); // Mark as loaded even on error to prevent retries
      }
    };

    // Start pre-fetching after a short delay to not block initial render
    const timeoutId = setTimeout(() => {
      prefetchCollections();
    }, 2000); // 2 second delay to let the page load first

    return () => clearTimeout(timeoutId);
  }, [status, firestore]);

  // This component doesn't render anything
  return null;
}
