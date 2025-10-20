"use client";

import * as React from "react";
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
import { PlusCircle, Printer, QrCode, MoreHorizontal } from "lucide-react";

import type { Employee } from "@/lib/types";

import { useFirestore } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy } from "firebase/firestore";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { EditEmployeeDialog } from "./edit-employee-dialog";
import { DeleteEmployeeDialog } from "./delete-employee-dialog";
import Link from "next/link";

export default function EmployeesPage() {
  const firestore = useFirestore();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );

  const employeesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "employees"), orderBy("name"));
  }, [firestore]);
  const { data: employees, isLoading } =
    useCollection<Employee>(employeesQuery);

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setEditDialogOpen(true);
  };

  const handleDelete = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <div>
            <CardTitle>Employees</CardTitle>
            <CardDescription>
              Manage your supervisors and workers.
            </CardDescription>
          </div>
          <Button
            size="sm"
            className="gap-1 w-full sm:w-auto"
            onClick={() => setAddDialogOpen(true)}
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Add Employee</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Role</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">QR Code</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {employees &&
                employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{employee.name}</span>
                        <span className="sm:hidden text-xs text-muted-foreground">
                          {employee.role}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={
                          employee.role === "Supervisor"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge
                        variant="outline"
                        className={cn({
                          "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200":
                            employee.status === "Active",
                          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200":
                            employee.status === "Inactive",
                        })}
                      >
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                      <span>{employee.qrCode}</span>
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
                          <DropdownMenuItem
                            onClick={() => handleEdit(employee)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Link
                              href={`/employees/print-badge/${employee.id}`}
                              target="_blank"
                              passHref
                            >
                              Print Badge
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => handleDelete(employee)}
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
        </CardContent>
      </Card>
      <AddEmployeeDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
      {selectedEmployee && (
        <>
          <EditEmployeeDialog
            isOpen={isEditDialogOpen}
            onOpenChange={setEditDialogOpen}
            employee={selectedEmployee}
          />
          <DeleteEmployeeDialog
            isOpen={isDeleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            employee={selectedEmployee}
          />
        </>
      )}
    </>
  );
}
