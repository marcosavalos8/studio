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
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { EditEmployeeDialog } from "./edit-employee-dialog";
import { DeleteEmployeeDialog } from "./delete-employee-dialog";
import Link from "next/link";

interface EmployeeWithCalculatedHours extends Employee {
  calculatedSickHours?: number;
  calculatedTotalHours?: number;
}

export default function EmployeesPage() {
  const firestore = useFirestore();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [employeesWithHours, setEmployeesWithHours] = useState<EmployeeWithCalculatedHours[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const employeesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "employees"), orderBy("name"));
  }, [firestore]);
  const { data: employees, isLoading } =
    useCollection<Employee>(employeesQuery);

  // Calculate sick hours from historical time entries
  useEffect(() => {
    async function calculateSickHours() {
      if (!firestore || !employees || employees.length === 0) {
        return;
      }

      setIsCalculating(true);

      try {
        const employeesWithCalculated: EmployeeWithCalculatedHours[] = await Promise.all(
          employees.map(async (employee) => {
            // Fetch all completed time entries for this employee
            const timeEntriesQuery = query(
              collection(firestore, "time_entries"),
              where("employeeId", "==", employee.id)
            );
            
            const timeEntriesSnapshot = await getDocs(timeEntriesQuery);
            
            let totalHoursWorked = 0;
            let totalHoursUsedSickHours = 0;

            timeEntriesSnapshot.forEach((doc) => {
              const entry = doc.data();
              
              // Skip if entry is not completed (no endTime)
              if (!entry.endTime) {
                return;
              }

              // Skip if it's a break or sick leave
              if (entry.isBreak || entry.isSickLeave) {
                return;
              }

              // Convert timestamps to dates
              const startTime = entry.timestamp?.toDate?.() || new Date(entry.timestamp);
              const endTime = entry.endTime?.toDate?.() || new Date(entry.endTime);

              // Calculate hours worked in this entry
              const hoursWorked = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
              
              if (hoursWorked > 0) {
                totalHoursWorked += hoursWorked;

                // Track hours where sick hours were used for payment
                if (entry.useSickHoursForPayment) {
                  totalHoursUsedSickHours += hoursWorked;
                }
              }
            });

            // Calculate sick hours balance
            const sickHoursAccrued = totalHoursWorked / 40;
            const calculatedSickHours = sickHoursAccrued - totalHoursUsedSickHours;

            return {
              ...employee,
              calculatedSickHours,
              calculatedTotalHours: totalHoursWorked,
            };
          })
        );

        setEmployeesWithHours(employeesWithCalculated);
      } catch (error) {
        console.error("Error calculating sick hours:", error);
        // Fallback to original employees data
        setEmployeesWithHours(employees.map(emp => ({ ...emp })));
      } finally {
        setIsCalculating(false);
      }
    }

    calculateSickHours();
  }, [employees, firestore]);

  // Use calculated hours if available, otherwise use stored values
  const displayEmployees = employeesWithHours.length > 0 ? employeesWithHours : employees || [];


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
                <TableHead className="hidden lg:table-cell">Sick Hours</TableHead>
                <TableHead className="hidden lg:table-cell">Total Hours</TableHead>
                <TableHead className="hidden xl:table-cell">QR Code</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoading || isCalculating) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    {isLoading ? "Loading employees..." : "Calculating sick hours..."}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isCalculating && displayEmployees &&
                displayEmployees.map((employee) => (
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
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="secondary" className="font-mono">
                        {employee.calculatedSickHours !== undefined
                          ? `${employee.calculatedSickHours.toFixed(2)} hrs`
                          : employee.sickHoursBalance !== undefined
                          ? `${employee.sickHoursBalance.toFixed(2)} hrs`
                          : "0.00 hrs"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="font-mono">
                        {employee.calculatedTotalHours !== undefined
                          ? `${employee.calculatedTotalHours.toFixed(2)} hrs`
                          : employee.totalHoursWorked !== undefined
                          ? `${employee.totalHoursWorked.toFixed(2)} hrs`
                          : "0.00 hrs"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell font-mono flex items-center gap-2">
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
