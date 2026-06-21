import {
  collection,
  query,
  where,
  Timestamp,
  getDocs,
  type Firestore,
} from "firebase/firestore";
import { format } from "date-fns";
import type { Client, Task, TimeEntry, Piecework } from "@/lib/types";

export interface PayrollRangeData {
  clients: Client[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  piecework: Piecework[];
}

/**
 * Fetches the clients, tasks and (date-filtered) time entries + piecework for a
 * given range. Mirrors the queries the existing Payroll form runs, extracted so
 * the new Payroll Management view can reuse them without duplicating logic and
 * without touching the existing Payroll flow.
 */
export async function fetchPayrollRangeData(
  firestore: Firestore,
  from: Date,
  to: Date,
): Promise<PayrollRangeData> {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  const [tasksSnap, clientsSnap, timeEntriesSnap, pieceworkSnap] =
    await Promise.all([
      getDocs(collection(firestore, "tasks")),
      getDocs(collection(firestore, "clients")),
      getDocs(
        query(
          collection(firestore, "time_entries"),
          where("timestamp", ">=", Timestamp.fromDate(start)),
          where("timestamp", "<=", Timestamp.fromDate(end)),
        ),
      ),
      getDocs(
        query(
          collection(firestore, "piecework"),
          where("timestamp", ">=", Timestamp.fromDate(start)),
          where("timestamp", "<=", Timestamp.fromDate(end)),
        ),
      ),
    ]);

  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task);
  const clients = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as Client,
  );

  const timeEntries = timeEntriesSnap.docs.map((d) => {
    const data = d.data();
    const ts = (data.timestamp as Timestamp)?.toDate();
    return {
      ...data,
      id: d.id,
      timestamp: ts ? format(ts, "yyyy-MM-dd'T'HH:mm:ss") : null,
    } as unknown as TimeEntry;
  });

  const piecework = pieceworkSnap.docs.map((d) => {
    const data = d.data();
    const ts = (data.timestamp as Timestamp)?.toDate();
    return {
      ...data,
      id: d.id,
      timestamp: ts ? format(ts, "yyyy-MM-dd'T'HH:mm:ss") : null,
    } as unknown as Piecework;
  });

  return { clients, tasks, timeEntries, piecework };
}
