"use client";

import { useState, useEffect, useCallback } from "react";

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean; // True if loading.
  error: Error | null; // Error object, or null.
}

/**
 * React hook to fetch and poll a collection from the Next.js API
 * Replaces Firebase's useCollection with REST API calls
 *
 * @template T Optional type for document data.
 * @param {string | null} endpoint - The API endpoint to fetch from (e.g., '/api/employees')
 * @param {object} options - Optional configuration
 * @param {number} options.pollInterval - Polling interval in ms (default: 3000ms)
 * @param {Record<string, string>} options.params - Query parameters
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
  endpoint: string | null,
  options: {
    pollInterval?: number;
    params?: Record<string, string>;
  } = {}
): UseCollectionResult<T> {
  const { pollInterval = 3000, params = {} } = options;
  
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!endpoint) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Build query string from params
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const jsonData = await response.json();
      setData(jsonData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, JSON.stringify(params)]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling if endpoint exists
    if (endpoint && pollInterval > 0) {
      const intervalId = setInterval(fetchData, pollInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchData, endpoint, pollInterval]);

  return { data, isLoading, error };
}

/**
 * Interface for the return value of the useDocument hook.
 * @template T Type of the document data.
 */
export interface UseDocumentResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean; // True if loading.
  error: Error | null; // Error object, or null.
}

/**
 * React hook to fetch and poll a single document from the Next.js API
 * Replaces Firebase's useDocument with REST API calls
 *
 * @template T Optional type for document data.
 * @param {string | null} endpoint - The API endpoint to fetch from (e.g., '/api/employees/123')
 * @param {object} options - Optional configuration
 * @param {number} options.pollInterval - Polling interval in ms (default: 3000ms)
 * @returns {UseDocumentResult<T>} Object with data, isLoading, error.
 */
export function useDocument<T = any>(
  endpoint: string | null,
  options: {
    pollInterval?: number;
  } = {}
): UseDocumentResult<T> {
  const { pollInterval = 3000 } = options;
  
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!endpoint) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(endpoint);
      
      if (!response.ok) {
        if (response.status === 404) {
          setData(null);
          setError(null);
          setIsLoading(false);
          return;
        }
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      const jsonData = await response.json();
      setData(jsonData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling if endpoint exists
    if (endpoint && pollInterval > 0) {
      const intervalId = setInterval(fetchData, pollInterval);
      return () => clearInterval(intervalId);
    }
  }, [fetchData, endpoint, pollInterval]);

  return { data, isLoading: isLoading, error };
}

/**
 * API client functions for CRUD operations
 */
export const apiClient = {
  /**
   * Create a new document in a collection
   */
  async create<T>(endpoint: string, data: Omit<T, 'id'>): Promise<WithId<T>> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create document: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Update a document
   */
  async update<T>(endpoint: string, data: Partial<T>): Promise<WithId<T>> {
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update document: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Delete a document
   */
  async delete(endpoint: string): Promise<void> {
    const response = await fetch(endpoint, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response.statusText}`);
    }
  },

  /**
   * Fetch a collection
   */
  async getCollection<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<WithId<T>[]> {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    const url = `${endpoint}${queryString}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch collection: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Fetch a single document
   */
  async getDocument<T>(endpoint: string): Promise<WithId<T> | null> {
    const response = await fetch(endpoint);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }

    return response.json();
  },
};
