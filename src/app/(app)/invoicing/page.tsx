'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InvoicingForm } from "./invoicing-form"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import type { Client, Task } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { useMemo } from 'react';
import { withAuth } from '@/components/withAuth'

export type DailyInvoiceItem = {
    date: string;
    items: {
        description: string;
        unit: 'hours' | 'pieces';
        quantity: number;
        rate: number;
        total: number;
    }[];
    dailyTotal: number;
};

export type DetailedInvoiceData = {
  client: Client;
  date: {
    from: string;
    to: string;
  };
  dailyItems: DailyInvoiceItem[];
  subtotal: number;
  commission: number;
  total: number;
};


function InvoicingPage() {
  const firestore = useFirestore()
  const clientsQuery = useMemo(() => {
    if (!firestore) return null
    return query(collection(firestore, "clients"), orderBy("name"))
  }, [firestore])
  const { data: clients, isLoading: loadingClients } = useCollection<Client>(clientsQuery)

  const tasksQuery = useMemo(() => {
    if (!firestore) return null
    return query(collection(firestore, "tasks"))
  }, [firestore])
  const { data: tasks, isLoading: loadingTasks } = useCollection<Task>(tasksQuery)

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
            <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
          )}
          {clients && tasks && <InvoicingForm clients={clients} tasks={tasks} />}
        </CardContent>
      </Card>
    </div>
  )
}

export default withAuth(InvoicingPage);
