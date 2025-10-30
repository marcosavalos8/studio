"use client";

import { useState, useEffect } from "react";
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean; // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    };
  };
}

/**
 * Cache entry structure for sessionStorage
 */
interface CacheEntry<T> {
  data: WithId<T>[];
  timestamp: number;
}

/**
 * Safely serializes data for caching, handling Firestore Timestamps and other special types
 */
function serializeForCache(data: any[]): string {
  try {
    // Use JSON.stringify with a replacer function to handle special types
    return JSON.stringify(data, (key, value) => {
      // Handle Firestore Timestamp objects
      if (value && typeof value === 'object') {
        if ('toDate' in value && typeof value.toDate === 'function') {
          return value.toDate().toISOString();
        }
        if ('seconds' in value && 'nanoseconds' in value) {
          const date = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
          return date.toISOString();
        }
      }
      return value;
    });
  } catch (err) {
    console.warn("Failed to serialize data:", err);
    return JSON.stringify({ data: [], timestamp: Date.now() });
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries with automatic caching for offline support.
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted targetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
  targetRefOrQuery:
    | CollectionReference<DocumentData>
    | Query<DocumentData>
    | null
    | undefined
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!targetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Extract the path for cache key
    const path: string =
      targetRefOrQuery.type === "collection"
        ? (targetRefOrQuery as CollectionReference).path
        : (targetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();

    const cacheKey = `firestore_cache_${path.replace(/\//g, "_")}`;

    // Load from cache first if available
    if (typeof window !== "undefined") {
      try {
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
          const cacheEntry: CacheEntry<T> = JSON.parse(cachedData);
          setData(cacheEntry.data);
        }
      } catch (err) {
        console.warn("Failed to load cache:", err);
      }
    }

    setIsLoading(true);
    setError(null);

    // Subscribe to Firestore updates
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

        // Update cache on successful fetch
        if (typeof window !== "undefined") {
          try {
            const cacheEntry: CacheEntry<T> = {
              data: results,
              timestamp: Date.now(),
            };
            const serialized = serializeForCache([cacheEntry]);
            const parsed = JSON.parse(serialized);
            sessionStorage.setItem(cacheKey, JSON.stringify(parsed[0]));
          } catch (err) {
            console.warn("Failed to update cache:", err);
          }
        }
      },
      (error: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: "list",
          path,
        });

        setError(contextualError);
        
        // Don't clear data if we have cached data - keep it for offline use
        // Only set data to null if we truly have no data
        setData((currentData) => {
          // If we have current data (from cache or previous fetch), keep it
          if (currentData && currentData.length > 0) {
            return currentData;
          }
          // Otherwise, return null
          return null;
        });
        
        setIsLoading(false);

        // trigger global error propagation
        errorEmitter.emit("permission-error", contextualError);
      }
    );

    return () => unsubscribe();
  }, [targetRefOrQuery]); // Re-run if the target query/reference changes.

  return { data, isLoading, error };
}
