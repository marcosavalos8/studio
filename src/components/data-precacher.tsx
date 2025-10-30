'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore';

/**
 * Converts a Firestore document to a plain object, handling Timestamp conversion
 */
function serializeFirestoreDoc(doc: any) {
  const docData = doc.data();
  const serializedData: any = { id: doc.id };
  
  for (const [key, value] of Object.entries(docData)) {
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      // Firestore Timestamp - convert to our custom format for deserialization
      serializedData[key] = { __type: 'Timestamp', value: value.toDate().toISOString() };
    } else if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
      // Alternative Timestamp format
      const date = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
      serializedData[key] = { __type: 'Timestamp', value: date.toISOString() };
    } else {
      serializedData[key] = value;
    }
  }
  
  return serializedData;
}

/**
 * Component that pre-fetches all important Firestore collections on mount.
 * This ensures all data is cached and available offline.
 * 
 * Features:
 * - Initial pre-fetch on app load (after 2s delay)
 * - Automatic refresh every 5 minutes to keep data current
 * - Works in background without affecting UI
 */
export function DataPrecacher() {
  const firestore = useFirestore();
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');

  useEffect(() => {
    if (!firestore) return;

    const prefetchCollections = async () => {
      if (status === 'idle') {
        setStatus('loading');
      }
      
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
            // Convert Firestore documents to plain objects, handling Timestamps
            const data = snapshot.docs.map(doc => serializeFirestoreDoc(doc));
            
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
        
        if (status !== 'loaded') {
          setStatus('loaded');
        }
        console.log('All data pre-fetched successfully - app is ready for offline use');
      } catch (error) {
        console.error('Error pre-fetching data:', error);
        if (status !== 'loaded') {
          setStatus('loaded');
        }
      }
    };

    // Initial fetch after a short delay to not block initial render
    const initialTimeout = setTimeout(() => {
      prefetchCollections();
    }, 2000); // 2 second delay to let the page load first

    // Set up interval to refresh data every 5 minutes
    // This ensures data stays fresh even if connection is lost temporarily
    const refreshInterval = setInterval(() => {
      console.log('Refreshing cached data (5-minute interval)...');
      prefetchCollections();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(refreshInterval);
    };
  }, [firestore]); // Removed status dependency to allow continuous refresh

  // This component doesn't render anything
  return null;
}
