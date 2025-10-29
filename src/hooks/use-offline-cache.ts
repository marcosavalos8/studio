"use client";

import { useState, useEffect, useRef } from "react";
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from "firebase/firestore";

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useOfflineCache hook.
 * @template T Type of the document data.
 */
export interface UseOfflineCacheResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean; // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  isCached: boolean; // True if data is from cache.
}

interface CacheEntry<T> {
  data: WithId<T>[];
  timestamp: number;
}

/**
 * Enhanced hook that wraps Firestore queries with offline caching.
 * When online: fetches from Firestore and updates cache
 * When offline: serves data from cache
 * 
 * Cache is stored in sessionStorage for the duration of the browser session.
 * 
 * @template T Optional type for document data.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query.
 * @param {string} cacheKey - Unique key for caching this query's data.
 * @returns {UseOfflineCacheResult<T>} Object with data, isLoading, error, isCached.
 */
export function useOfflineCache<T = any>(
  targetRefOrQuery:
    | CollectionReference<DocumentData>
    | Query<DocumentData>
    | null
    | undefined,
  cacheKey: string
): UseOfflineCacheResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [isCached, setIsCached] = useState<boolean>(false);
  const isOnlineRef = useRef(typeof window !== "undefined" ? navigator.onLine : true);

  // Load from cache on mount if available
  useEffect(() => {
    if (typeof window === "undefined" || !cacheKey) return;

    const cached = sessionStorage.getItem(`firestore_cache_${cacheKey}`);
    if (cached) {
      try {
        const cacheEntry: CacheEntry<T> = JSON.parse(cached);
        setData(cacheEntry.data);
        setIsCached(true);
        setIsLoading(false);
      } catch (e) {
        console.warn(`Failed to parse cache for ${cacheKey}:`, e);
      }
    }
  }, [cacheKey]);

  // Track online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      isOnlineRef.current = true;
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!targetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      setIsCached(false);
      return;
    }

    // If offline and we have cached data, don't try to fetch
    if (!isOnlineRef.current && isCached && data) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      targetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        
        setData(results);
        setError(null);
        setIsLoading(false);
        setIsCached(false);

        // Save to cache
        if (typeof window !== "undefined" && cacheKey) {
          const cacheEntry: CacheEntry<T> = {
            data: results,
            timestamp: Date.now(),
          };
          try {
            sessionStorage.setItem(
              `firestore_cache_${cacheKey}`,
              JSON.stringify(cacheEntry)
            );
          } catch (e) {
            console.warn(`Failed to cache data for ${cacheKey}:`, e);
          }
        }
      },
      (error: FirestoreError) => {
        // Only set error if we don't have cached data
        if (!data || data.length === 0) {
          setError(error);
          setData(null);
          setIsLoading(false);
        } else {
          // We have cached data, so just mark as not loading and keep cached data
          setIsLoading(false);
          setIsCached(true);
        }
      }
    );

    return () => unsubscribe();
  }, [targetRefOrQuery, cacheKey]); // Don't include data or isCached in deps

  return { data, isLoading, error, isCached };
}
