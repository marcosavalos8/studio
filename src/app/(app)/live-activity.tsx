'use client'

import React, { useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase'
import { collection, query, where, Timestamp } from 'firebase/firestore'
import type { TimeEntry, Employee, Task, Client } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
    id: string;
    employeeName: string;
    employeeInitials: string;
    taskName: string;
    clientName: string;
    clockInTime: Date;
}

export function LiveActivity() {
    const firestore = useFirestore()

    const activeTimeEntriesQuery = useMemoFirebase(() => {
        if (!firestore) return null
        return query(collection(firestore, 'time_entries'), where('endTime', '==', null))
    }, [firestore])
    const { data: activeTimeEntries, isLoading: loadingEntries } = useCollection<TimeEntry>(activeTimeEntriesQuery)

    const employeesQuery = useMemoFirebase(() => {
        if (!firestore) return null
        return collection(firestore, 'employees')
    }, [firestore])
    const { data: employees, isLoading: loadingEmployees } = useCollection<Employee>(employeesQuery)

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore) return null
        return collection(firestore, 'tasks')
    }, [firestore])
    const { data: tasks, isLoading: loadingTasks } = useCollection<Task>(tasksQuery)

    const clientsQuery = useMemoFirebase(() => {
      if (!firestore) return null
      return collection(firestore, 'clients')
    }, [firestore])
    const { data: clients, isLoading: loadingClients } = useCollection<Client>(clientsQuery)


    const isLoading = loadingEntries || loadingEmployees || loadingTasks || loadingClients;

    const activityData = useMemo<ActivityItem[]>(() => {
        if (!activeTimeEntries || !employees || !tasks || !clients) return []

        const employeeMap = new Map(employees.map(e => [e.id, e]));
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const clientMap = new Map(clients.map(c => [c.name, c]));

        return activeTimeEntries.map(entry => {
            const employee = employeeMap.get(entry.employeeId);
            const task = taskMap.get(entry.taskId);
            const client = task ? clientMap.get(task.client) : undefined;
            const clockInTime = (entry.timestamp as unknown as Timestamp).toDate();

            return {
                id: entry.id,
                employeeName: employee?.name || 'Unknown',
                employeeInitials: employee?.name.split(' ').map(n => n[0]).join('') || '??',
                taskName: task?.name || 'Unknown Task',
                clientName: client?.name || 'Unknown Client',
                clockInTime: clockInTime,
            };
        }).sort((a, b) => b.clockInTime.getTime() - a.clockInTime.getTime());

    }, [activeTimeEntries, employees, tasks, clients])

    return (
        <Card>
            <CardHeader>
                <CardTitle>Live Employee Activity</CardTitle>
                <CardDescription>A real-time view of who is currently clocked in.</CardDescription>
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
                        {!isLoading && activityData.map((activity) => (
                            <TableRow key={activity.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="hidden h-9 w-9 sm:flex">
                                            <AvatarFallback>{activity.employeeInitials}</AvatarFallback>
                                        </Avatar>
                                        <div className="grid gap-0.5">
                                            <p className="font-medium">{activity.employeeName}</p>
                                            <p className="text-xs text-muted-foreground">{activity.clientName}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{activity.taskName}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                    {formatDistanceToNow(activity.clockInTime, { addSuffix: true })}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
