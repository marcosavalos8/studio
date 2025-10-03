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
    
    const { tasksByClient, clientOrder } = useMemo(() => {
      if (!tasks || !clients) return { tasksByClient: {}, clientOrder: [] };
    
      const clientMap = new Map(clients.map(c => [c.id, c]));
      const groupedTasks: Record<string, { client: Client | null; tasks: Task[] }> = {};
      const unassignedClientId = 'unassigned';
    
      for (const task of tasks) {
        const client = clientMap.get(task.clientId);
        const clientId = client ? task.clientId : unassignedClientId;
    
        if (!groupedTasks[clientId]) {
          groupedTasks[clientId] = {
            client: client || null,
            tasks: [],
          };
        }
        groupedTasks[clientId].tasks.push(task);
      }
    
      // Create a sorted list of client IDs to render in order
      const clientOrder = clients
        .map(c => c.id)
        .filter(id => groupedTasks[id]);
      
      if (groupedTasks[unassignedClientId]) {
        clientOrder.push(unassignedClientId);
      }
    
      return { tasksByClient: groupedTasks, clientOrder };
    }, [tasks, clients]);


    const handleEdit = (task: Task) => {
        setSelectedTask(task)
        setEditDialogOpen(true)
    }

    const handleDelete = (task: Task) => {
        setSelectedTask(task)
        setDeleteDialogOpen(true)
    }

    const loading = loadingTasks || loadingClients;

    const TaskTable = ({ tasks }: { tasks: Task[] }) => (
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
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.name} <span className="text-muted-foreground">({task.variety || 'N/A'})</span></TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{task.ranch || '-'}</span>
                  <span className="text-muted-foreground">{task.block || '-'}</span>
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
    );

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
                  <Accordion type="multiple" defaultValue={clientOrder} className="w-full">
                    {clientOrder.map(clientId => {
                      const group = tasksByClient[clientId];
                      if (!group || group.tasks.length === 0) return null;
                      
                      const triggerTitle = group.client ? group.client.name : "Tasks without an assigned Client";
                      const triggerClass = group.client ? "text-lg font-semibold" : "text-lg font-semibold text-amber-600";
                      
                      return (
                        <AccordionItem value={clientId} key={clientId}>
                          <AccordionTrigger className={triggerClass}>{triggerTitle}</AccordionTrigger>
                          <AccordionContent>
                            <TaskTable tasks={group.tasks} />
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
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
