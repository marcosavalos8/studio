'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InvoicingForm } from "./invoicing-form"
import { useCollection } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { useFirestore } from "@/firebase"
import { useMemo } from "react"
import type { Client, Task } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

export default function InvoicingPage() {
  const firestore = useFirestore()
  const clientsQuery = useMemo(() => {
    if (!firestore) return null
    return query(collection(firestore, "clients"), orderBy("name"))
  }, [firestore])
  const { data: clients, loading: loadingClients } = useCollection<Client>(clientsQuery)

  const tasksQuery = useMemo(() => {
    if (!firestore) return null
    return query(collection(firestore, "tasks"))
  }, [firestore])
  const { data: tasks, loading: loadingTasks } = useCollection<Task>(tasksQuery)

  const loading = loadingClients || loadingTasks

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate Invoice</CardTitle>
          <CardDescription>
            Select a client and date range to generate a detailed invoice for billing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="space-y-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-10 w-1/3" />
            </div>
          )}
          {clients && tasks && <InvoicingForm clients={clients} tasks={tasks} />}
        </CardContent>
      </Card>
    </div>
  )
}
