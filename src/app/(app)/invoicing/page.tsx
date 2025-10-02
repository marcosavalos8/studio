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
import type { Client } from "@/lib/types"

export default function InvoicingPage() {
  const firestore = useFirestore()
  const clientsQuery = useMemo(() => {
    if (!firestore) return null
    return query(collection(firestore, "clients"), orderBy("name"))
  }, [firestore])
  const { data: clients, loading } = useCollection<Client>(clientsQuery)

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
          {loading && <p>Loading clients...</p>}
          {clients && <InvoicingForm clients={clients} />}
        </CardContent>
      </Card>
    </div>
  )
}
