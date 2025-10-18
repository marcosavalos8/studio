"use client";

import React, { useMemo, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useFirestore } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import {
  collection,
  query,
  where,
  Timestamp,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import type { TimeEntry, Employee, Task, Client } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  employeeName: string;
  employeeInitials: string;
  taskName: string;
  clientName: string;
  clockInTime: Date;
}

export function LiveActivity() {
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(true);
  const [activityData, setActivityData] = useState<ActivityItem[]>([]);

  const activeTimeEntriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "time_entries"),
      where("endTime", "==", null)
    );
  }, [firestore]);
  const { data: activeTimeEntries, isLoading: loadingEntries } =
    useCollection<TimeEntry>(activeTimeEntriesQuery);

  useEffect(() => {
    const fetchRelatedData = async () => {
      if (loadingEntries || !firestore) return;
      if (!activeTimeEntries) {
        setActivityData([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const employeeMap = new Map<string, Employee>();
      const taskMap = new Map<string, Task>();
      const clientMap = new Map<string, Client>();

      const promises = activeTimeEntries.map(async (entry) => {
        let employee = employeeMap.get(entry.employeeId);
        if (!employee) {
          const empDoc = await getDoc(
            doc(firestore, "employees", entry.employeeId)
          );
          if (empDoc.exists()) {
            employee = { id: empDoc.id, ...empDoc.data() } as Employee;
            employeeMap.set(entry.employeeId, employee);
          }
        }

        let task = taskMap.get(entry.taskId);
        if (!task) {
          const taskDoc = await getDoc(doc(firestore, "tasks", entry.taskId));
          if (taskDoc.exists()) {
            task = { id: taskDoc.id, ...taskDoc.data() } as Task;
            taskMap.set(entry.taskId, task);
          }
        }

        let client: Client | undefined;
        if (task) {
          client = clientMap.get(task.clientId);
          if (!client) {
            const clientDoc = await getDoc(
              doc(firestore, "clients", task.clientId)
            );
            if (clientDoc.exists()) {
              client = { id: clientDoc.id, ...clientDoc.data() } as Client;
              clientMap.set(task.clientId, client);
            }
          }
        }

        if (!employee || !task || !client) {
          return null;
        }

        const clockInTime = (entry.timestamp as unknown as Timestamp).toDate();

        return {
          id: entry.id,
          employeeName: employee.name,
          employeeInitials:
            employee.name
              .split(" ")
              .map((n) => n[0])
              .join("") || "??",
          taskName: task.name,
          clientName: client.name,
          clockInTime: clockInTime,
        };
      });

      const results = (await Promise.all(promises)).filter(
        (item): item is ActivityItem => item !== null
      );
      results.sort((a, b) => b.clockInTime.getTime() - a.clockInTime.getTime());
      setActivityData(results);
      setIsLoading(false);
    };

    fetchRelatedData();
  }, [activeTimeEntries, firestore, loadingEntries]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Employee Activity</CardTitle>
        <CardDescription>
          A real-time view of who is currently clocked in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Task</TableHead>
              <TableHead className="text-right">Clocked In</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  Loading live activity...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && activityData.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No employees are currently clocked in.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              activityData.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="hidden h-9 w-9 sm:flex">
                        <AvatarFallback>
                          {activity.employeeInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid gap-0.5">
                        <p className="font-medium">{activity.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.clientName}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{activity.taskName}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(activity.clockInTime, {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
