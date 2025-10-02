import { useEffect, useState } from 'react';
import {
  onSnapshot,
  doc,
  type DocumentData,
  type DocumentReference,
  type FirestoreError,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

export function useDoc<T>(path: string): {
  data: (T & { id: string })[] | null;
  loading: boolean;
  error: FirestoreError | null;
};
export function useDoc<T>(
  docRef: DocumentReference<DocumentData> | null
): {
  data: (T & { id: string })[] | null;
  loading: boolean;
  error: FirestoreError | null;
};
export function useDoc<T>(
  pathOrDocRef: string | DocumentReference<DocumentData> | null
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
    if (!firestore || !pathOrDocRef) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const d =
      typeof pathOrDocRef === 'string'
        ? doc(firestore, pathOrDocRef)
        : pathOrDocRef;

    const unsubscribe = onSnapshot(
      d,
      (doc) => {
        if (doc.exists()) {
          setData([{ id: doc.id, ...doc.data() } as T & { id: string }]);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, pathOrDocRef]);

  return { data, loading, error };
}
