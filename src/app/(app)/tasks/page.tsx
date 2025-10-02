'use client'

import React, { useState, useMemo } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, MoreHorizontal } from "lucide-react"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import type { Task, Client } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AddTaskDialog } from "./add-task-dialog"
import { EditTaskDialog } from "./edit-task-dialog"
import { DeleteTaskDialog } from "./delete-task-dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function TasksPage() {
    const firestore = useFirestore()
    const [isAddDialogOpen, setAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setEditDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [selectedTask, setSelectedTask] = useState<Task | null>(null)


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
    
    const tasksByClient = useMemo(() => {
      if (!tasks || !clients) return {}
      return clients.reduce((acc, client) => {
        acc[client.name] = tasks.filter(task => task.client === client.name);
        return acc;
      }, {} as Record<string, Task[]>);
    }, [tasks, clients])


    const handleEdit = (task: Task) => {
        setSelectedTask(task)
        setEditDialogOpen(true)
    }

    const handleDelete = (task: Task) => {
        setSelectedTask(task)
        setDeleteDialogOpen(true)
    }

    const loading = loadingTasks || loadingClients;

    return (
        <>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                <CardTitle>Tasks & Projects</CardTitle>
                <CardDescription>Manage all work tasks and projects, organized by client.</CardDescription>
                </div>
                <Button size="sm" className="gap-1" onClick={() => setAddDialogOpen(true)} disabled={loadingClients}>
                <PlusCircle className="h-4 w-4" />
                Add Task
                </Button>
            </CardHeader>
            <CardContent>
                {loading && <p>Loading tasks...</p>}
                {!loading && (
                  <Accordion type="multiple" defaultValue={clients?.map(c => c.id)} className="w-full">
                    {clients?.map(client => (
                      tasksByClient[client.name]?.length > 0 && (
                        <AccordionItem value={client.id} key={client.id}>
                          <AccordionTrigger className="text-lg font-semibold">{client.name}</AccordionTrigger>
                          <AccordionContent>
                            <Table>
                              <TableHeader>
                                  <TableRow>
                                  <TableHead>Task Name</TableHead>
                                  <TableHead>Location</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Employee Pay</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {tasksByClient[client.name].map((task) => (
                                  <TableRow key={task.id}>
                                      <TableCell className="font-medium">{task.name} <span className="text-muted-foreground">({task.variety})</span></TableCell>
                                      <TableCell>
                                        <div className="flex flex-col">
                                          <span className="font-medium">{task.ranch}</span>
                                          <span className="text-muted-foreground">{task.block}</span>
                                        </div>
                                      </TableCell>
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
                                      <TableCell>
                                        <div className="flex flex-col">
                                           <span className="font-medium">${task.employeeRate.toFixed(2)}/{task.employeePayType === 'hourly' ? 'hr' : 'piece'}</span>
                                          <span className="text-muted-foreground capitalize">{task.employeePayType}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right">
                                          <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" className="h-8 w-8 p-0">
                                              <span className="sr-only">Open menu</span>
                                              <MoreHorizontal className="h-4 w-4" />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                              <DropdownMenuItem onClick={() => handleEdit(task)}>
                                              Edit
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                              onClick={() => handleDelete(task)}
                                              >
                                              Delete
                                              </DropdownMenuItem>
                                          </DropdownMenuContent>
                                          </DropdownMenu>
                                      </TableCell>
                                  </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    ))}
                  </Accordion>
                )}
            </CardContent>
            </Card>
            {clients && <AddTaskDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} clients={clients} />}
            {selectedTask && clients && (
                <>
                <EditTaskDialog
                    isOpen={isEditDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    task={selectedTask}
                    clients={clients}
                />
                <DeleteTaskDialog
                    isOpen={isDeleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                    task={selectedTask}
                />
                </>
            )}
        </>
    )
}
