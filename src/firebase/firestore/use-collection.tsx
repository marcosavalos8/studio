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

interface CacheEntry<T> {
  data: WithId<T>[];
  timestamp: number;
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
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries and implements offline caching.
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted targetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidance. Also make sure that its dependencies are stable
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
  const isOnlineRef = useRef(typeof window !== "undefined" ? navigator.onLine : true);
  const cacheKeyRef = useRef<string | null>(null);

  // Generate cache key from query path
  useEffect(() => {
    if (!targetRefOrQuery) {
      cacheKeyRef.current = null;
      return;
    }

    try {
      const path: string =
        targetRefOrQuery.type === "collection"
          ? (targetRefOrQuery as CollectionReference).path
          : (targetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();
      cacheKeyRef.current = path;
    } catch (e) {
      cacheKeyRef.current = null;
    }
  }, [targetRefOrQuery]);

  // Load from cache on mount if available
  useEffect(() => {
    if (typeof window === "undefined" || !cacheKeyRef.current) return;

    const cached = sessionStorage.getItem(`firestore_cache_${cacheKeyRef.current}`);
    if (cached) {
      try {
        const cacheEntry: CacheEntry<T> = JSON.parse(cached);
        // Only set cached data if we don't already have data
        setData((prevData) => {
          if (prevData === null) {
            return cacheEntry.data;
          }
          return prevData;
        });
      } catch (e) {
        console.warn(`Failed to parse cache for ${cacheKeyRef.current}:`, e);
      }
    }
  }, []);

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
      return;
    }

    setIsLoading(true);
    setError(null);

    // Directly use targetRefOrQuery as it's assumed to be the final query
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

        // Save to cache
        if (typeof window !== "undefined" && cacheKeyRef.current) {
          const cacheEntry: CacheEntry<T> = {
            data: results,
            timestamp: Date.now(),
          };
          try {
            sessionStorage.setItem(
              `firestore_cache_${cacheKeyRef.current}`,
              JSON.stringify(cacheEntry)
            );
          } catch (e) {
            console.warn(`Failed to cache data for ${cacheKeyRef.current}:`, e);
          }
        }
      },
      (error: FirestoreError) => {
        // This logic extracts the path from either a ref or a query
        const path: string =
          targetRefOrQuery.type === "collection"
            ? (targetRefOrQuery as CollectionReference).path
            : (
                targetRefOrQuery as unknown as InternalQuery
              )._query.path.canonicalString();

        const contextualError = new FirestorePermissionError({
          operation: "list",
          path,
        });

        // Only clear data and show error if we don't have cached data
        if (!data || data.length === 0) {
          setError(contextualError);
          setData(null);
        } else {
          // We have cached data (either from previous fetch or from cache),
          // so keep it and just stop loading
          setError(null);
        }
        setIsLoading(false);

        // trigger global error propagation only if offline and no cached data
        if (!data || data.length === 0) {
          errorEmitter.emit("permission-error", contextualError);
        }
      }
    );

    return () => unsubscribe();
  }, [targetRefOrQuery]); // Re-run if the target query/reference changes.

  return { data, isLoading, error };
}
