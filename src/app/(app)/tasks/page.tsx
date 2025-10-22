"use client";

import React, { useState, useMemo } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal } from "lucide-react";

import { useCollection } from "@/lib/api/client";
import type { Task, Client } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddTaskDialog } from "./add-task-dialog";
import { EditTaskDialog } from "./edit-task-dialog";
import { DeleteTaskDialog } from "./delete-task-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function TasksPage() {
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: tasks, isLoading: loadingTasks } =
    useCollection<Task>('/api/tasks', { params: { orderBy: 'name' } });

  const { data: clients, isLoading: loadingClients } =
    useCollection<Client>('/api/clients', { params: { orderBy: 'name' } });
    if (!firestore) return null;
    return query(collection(firestore, "clients"), orderBy("name"));
  }, [firestore]);
  const { data: clients, isLoading: loadingClients } =
    useCollection<Client>('/api/clients', { params: { orderBy: 'name' } });

  const { tasksByClient, clientOrder } = useMemo(() => {
    if (!tasks || !clients) return { tasksByClient: {}, clientOrder: [] };

    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const unassignedClientId = "unassigned";

    // Group tasks by clientId
    const groupedTasks = tasks.reduce((acc, task) => {
      const clientId =
        task.clientId && clientMap.has(task.clientId)
          ? task.clientId
          : unassignedClientId;
      if (!acc[clientId]) {
        acc[clientId] = {
          client: clientMap.get(clientId) || null,
          tasks: [],
        };
      }
      acc[clientId].tasks.push(task);
      return acc;
    }, {} as Record<string, { client: Client | null; tasks: Task[] }>);

    // Sort the client order based on the client names
    const clientOrder = Object.keys(groupedTasks).sort((a, b) => {
      if (a === unassignedClientId) return 1; // Always put unassigned last
      if (b === unassignedClientId) return -1;
      const clientA = groupedTasks[a].client;
      const clientB = groupedTasks[b].client;
      if (clientA && clientB) {
        return clientA.name.localeCompare(clientB.name);
      }
      return 0; // Should not happen if not unassigned
    });

    return { tasksByClient: groupedTasks, clientOrder };
  }, [tasks, clients]);

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setEditDialogOpen(true);
  };

  const handleDelete = (task: Task) => {
    setSelectedTask(task);
    setDeleteDialogOpen(true);
  };

  const loading = loadingTasks || loadingClients;

  const TaskTable = ({ tasks }: { tasks: Task[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task Name</TableHead>
          <TableHead className="hidden md:table-cell">Location</TableHead>
          <TableHead className="hidden lg:table-cell">Status</TableHead>
          <TableHead className="hidden lg:table-cell">Rate</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="font-medium">
              <div className="flex flex-col">
                <span>
                  {task.name}{" "}
                  <span className="text-muted-foreground">
                    ({task.variety || "N/A"})
                  </span>
                </span>
                <span className="md:hidden text-xs text-muted-foreground mt-1">
                  {task.ranch || "-"} - {task.block || "-"}
                </span>
                <span className="lg:hidden text-xs mt-1">
                  <Badge
                    className={cn("text-xs", {
                      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300":
                        task.status === "Active",
                      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300":
                        task.status === "Inactive",
                      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300":
                        task.status === "Completed",
                    })}
                    variant="outline"
                  >
                    {task.status}
                  </Badge>
                </span>
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <div className="flex flex-col">
                <span className="font-medium">{task.ranch || "-"}</span>
                <span className="text-muted-foreground">
                  {task.block || "-"}
                </span>
              </div>
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Badge
                className={cn({
                  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300":
                    task.status === "Active",
                  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300":
                    task.status === "Inactive",
                  "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300":
                    task.status === "Completed",
                })}
                variant="outline"
              >
                {task.status}
              </Badge>
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <div className="flex flex-col">
                {task.clientRateType === "piece" && task.piecePrice ? (
                  <>
                    <span className="font-medium">
                      ${task.piecePrice.toFixed(2)}/piece
                    </span>
                    <span className="text-muted-foreground capitalize">
                      Piecework
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">
                      ${task.clientRate.toFixed(2)}/hr
                    </span>
                    <span className="text-muted-foreground capitalize">
                      Hourly
                    </span>
                  </>
                )}
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
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <div>
            <CardTitle>Tasks & Projects</CardTitle>
            <CardDescription>
              Manage all work tasks and projects, organized by client.
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="gap-1 w-full sm:w-auto"
            onClick={() => setAddDialogOpen(true)}
            disabled={loadingClients}
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">{loading && <p>Loading tasks...</p>}
          {!loading && (
            <Accordion
              type="multiple"
              defaultValue={clientOrder}
              className="w-full"
            >
              {clientOrder.map((clientId) => {
                const group = tasksByClient[clientId];
                if (!group || group.tasks.length === 0) return null;

                const triggerTitle = group.client
                  ? group.client.name
                  : "Tasks without an assigned Client";
                const triggerClass = group.client
                  ? "text-lg font-semibold"
                  : "text-lg font-semibold text-amber-600";

                return (
                  <AccordionItem value={clientId} key={clientId}>
                    <AccordionTrigger className={triggerClass}>
                      {triggerTitle}
                    </AccordionTrigger>
                    <AccordionContent>
                      <TaskTable tasks={group.tasks} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
      {clients && (
        <AddTaskDialog
          isOpen={isAddDialogOpen}
          onOpenChange={setAddDialogOpen}
          clients={clients}
        />
      )}
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
  );
}
