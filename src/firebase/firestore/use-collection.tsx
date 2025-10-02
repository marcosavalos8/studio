import { useEffect, useState } from 'react';
import {
  onSnapshot,
  query,
  collection,
  type DocumentData,
  type Query,
  type FirestoreError,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

export function useCollection<T>(path: string): {
  data: (T & { id: string })[] | null;
  loading: boolean;
  error: FirestoreError | null;
};
export function useCollection<T>(
  query: Query<DocumentData> | null
): {
  data: (T & { id: string })[] | null;
  loading: boolean;
  error: FirestoreError | null;
};
export function useCollection<T>(
  pathOrQuery: string | Query<DocumentData> | null
): {
  data: (T & { id: string })[] | null;
  loading: boolean;
  error: FirestoreError | null;
} {
  const firestore = useFirestore();
  const [data, setData] = useState<(T & { id: string })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!firestore || !pathOrQuery) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q =
      typeof pathOrQuery === 'string'
        ? query(collection(firestore, pathOrQuery))
        : pathOrQuery;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as T & { id: string })
        );
        setData(docs);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, pathOrQuery]);

  return { data, loading, error };
}
