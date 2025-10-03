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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { PlusCircle, MoreHorizontal } from "lucide-react"

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import type { Client } from "@/lib/types"
import { AddClientDialog } from "./add-client-dialog"
import { EditClientDialog } from "./edit-client-dialog"
import { DeleteClientDialog } from "./delete-client-dialog"

export default function ClientsPage() {
  const firestore = useFirestore()
  const [isAddDialogOpen, setAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore) return null
    return query(collection(firestore, "clients"), orderBy("name"))
  }, [firestore])
  const { data: clients, isLoading } = useCollection<Client>(clientsQuery)

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setEditDialogOpen(true)
  }

  const handleDelete = (client: Client) => {
    setSelectedClient(client)
    setDeleteDialogOpen(true)
  }


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
                <TableHead>Contact Email</TableHead>
                <TableHead>Billing Address</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {isLoading && (
                  <TableRow>
                      <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                  </TableRow>
              )}
              {clients && clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.email || '-'}</TableCell>
                  <TableCell>{client.billingAddress}</TableCell>
                  <TableCell>{client.paymentTerms}</TableCell>
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
                        <DropdownMenuItem onClick={() => handleEdit(client)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          onClick={() => handleDelete(client)}
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
      <AddClientDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
      {selectedClient && (
        <>
          <EditClientDialog 
            isOpen={isEditDialogOpen} 
            onOpenChange={setEditDialogOpen} 
            client={selectedClient} 
          />
          <DeleteClientDialog 
            isOpen={isDeleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            client={selectedClient}
          />
        </>
      )}
    </>
  )
}
