'use client'

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

import type { Employee } from "@/lib/types"
import { useCollection } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useFirestore } from "@/firebase"
import { useMemo } from "react"
import { cn } from "@/lib/utils"

export default function EmployeesPage() {
  const firestore = useFirestore()
  const employeesQuery = useMemo(() => {
      if (!firestore) return null
      return query(collection(firestore, "employees"), orderBy("name"))
    }, [firestore])
  const { data: employees, loading } = useCollection<Employee>(employeesQuery)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Employees</CardTitle>
          <CardDescription>Manage your supervisors and workers.</CardDescription>
        </div>
        <Button size="sm" className="gap-1">
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
              <TableHead>QR Code ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center">Loading...</TableCell>
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
                      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300": employee.status === 'Active',
                      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300": employee.status === 'Inactive',
                    })}
                  >
                    {employee.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">{employee.qrCode}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
