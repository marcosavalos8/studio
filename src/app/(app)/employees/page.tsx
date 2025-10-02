'use client'

import * as React from "react"
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
import { PlusCircle, Printer, QrCode } from "lucide-react"

import type { Employee } from "@/lib/types"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { AddEmployeeDialog } from "./add-employee-dialog"
import Link from "next/link"

export default function EmployeesPage() {
  const firestore = useFirestore()
  const [isAddDialogOpen, setAddDialogOpen] = useState(false)

  const employeesQuery = useMemoFirebase(() => {
      if (!firestore) return null
      return query(collection(firestore, "employees"), orderBy("name"))
    }, [firestore])
  const { data: employees, isLoading } = useCollection<Employee>(employeesQuery)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Manage your supervisors and workers.</CardDescription>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setAddDialogOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Add Employee
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                  <TableRow>
                      <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                  </TableRow>
              )}
              {employees && employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>
                    <Badge variant={employee.role === 'Supervisor' ? "default" : "secondary"}>
                      {employee.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn({
                        "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200": employee.status === 'Active',
                        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200": employee.status === 'Inactive',
                      })}
                    >
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                    <span>{employee.qrCode}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/employees/print-badge/${employee.id}`} target="_blank" passHref>
                        <Button variant="outline" size="sm" asChild>
                           <div>
                                <Printer className="mr-2 h-4 w-4"/>
                                Print Badge
                           </div>
                        </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddEmployeeDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  )
}
