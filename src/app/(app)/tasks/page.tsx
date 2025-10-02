'use client'

import React, { useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle } from "lucide-react"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import type { Task, Client } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AddTaskDialog } from "./add-task-dialog"

export default function TasksPage() {
    const firestore = useFirestore()
    const [isAddDialogOpen, setAddDialogOpen] = useState(false)

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore) return null
        return query(collection(firestore, "tasks"), orderBy("name"))
    }, [firestore])
    const { data: tasks, isLoading: loadingTasks } = useCollection<Task>(tasksQuery)

    const clientsQuery = useMemoFirebase(() => {
      if (!firestore) return null
      return query(collection(firestore, "clients"), orderBy("name"))
    }, [firestore])
    const { data: clients, isLoading: loadingClients } = useCollection<Client>(clientsQuery)

    return (
        <>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                <CardTitle>Tasks & Projects</CardTitle>
                <CardDescription>Manage all work tasks and projects.</CardDescription>
                </div>
                <Button size="sm" className="gap-1" onClick={() => setAddDialogOpen(true)} disabled={loadingClients}>
                <PlusCircle className="h-4 w-4" />
                Add Task
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Task Name</TableHead>
                    <TableHead>Variety</TableHead>
                    <TableHead>Ranch</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Employee Pay Type</TableHead>
                    <TableHead className="text-right">Employee Rate</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loadingTasks && (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                        </TableRow>
                    )}
                    {tasks && tasks.map((task) => (
                    <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.name}</TableCell>
                        <TableCell>{task.variety}</TableCell>
                        <TableCell>{task.ranch}</TableCell>
                        <TableCell>{task.block}</TableCell>
                        <TableCell>{task.client}</TableCell>
                        <TableCell>
                        <Badge
                            className={cn({
                            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300": task.status === 'Active',
                            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300": task.status === 'Inactive',
                            "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300": task.status === 'Completed',
                            })}
                            variant="outline"
                        >
                            {task.status}
                        </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{task.employeePayType}</TableCell>
                        <TableCell className="text-right">
                          ${task.employeeRate.toFixed(2)}/{task.employeePayType === 'hourly' ? 'hr' : 'piece'}
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
            </Card>
            {clients && <AddTaskDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} clients={clients} />}
        </>
    )
}
