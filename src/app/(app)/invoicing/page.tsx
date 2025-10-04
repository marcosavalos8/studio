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
import type { Client } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { useMemo } from 'react';
import { withAuth } from '@/components/withAuth'

export type DetailedInvoiceData = {
  client: Client;
  date: {
    from: string;
    to: string;
  };
  laborCost: number;
  minimumWageTopUp: number;
  paidRestBreaks: number;
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


  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate Invoice</CardTitle>
          <CardDescription>
            Select a client and date range to generate a detailed invoice for billing. This invoice includes all labor costs calculated according to WA state law.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingClients && (
            <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
          )}
          {clients && <InvoicingForm clients={clients} />}
        </CardContent>
      </Card>
    </div>
  )
}

export default withAuth(InvoicingPage);
