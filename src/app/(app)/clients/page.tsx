'use client'

import React, { useState } from "react"
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
import { PlusCircle } from "lucide-react"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import type { Client } from "@/lib/types"
import { AddClientDialog } from "./add-client-dialog"

export default function ClientsPage() {
  const firestore = useFirestore()
  const [isAddDialogOpen, setAddDialogOpen] = useState(false)

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore) return null
    return query(collection(firestore, "clients"), orderBy("name"))
  }, [firestore])
  const { data: clients, isLoading } = useCollection<Client>(clientsQuery)

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Clients</CardTitle>
            <CardDescription>Manage your company's clients.</CardDescription>
          </div>
          <Button size="sm" className="gap-1" onClick={() => setAddDialogOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Add Client
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Billing Address</TableHead>
                <TableHead>Payment Terms</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {isLoading && (
                  <TableRow>
                      <TableCell colSpan={3} className="text-center">Loading...</TableCell>
                  </TableRow>
              )}
              {clients && clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.billingAddress}</TableCell>
                  <TableCell>{client.paymentTerms}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AddClientDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
    </>
  )
}
