"use client";

import { RequireAdmin } from "@/components/require-admin";
import React, { useState, useMemo } from "react";
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
import { PlusCircle, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { useFirestore } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy } from "firebase/firestore";
import type { Client, Contract } from "@/lib/types";
import { AddClientDialog } from "./add-client-dialog";
import { EditClientDialog } from "./edit-client-dialog";
import { DeleteClientDialog } from "./delete-client-dialog";
import { ClientContractsDialog } from "./contracts/client-contracts-dialog";
import { FileText } from "lucide-react";

function ClientsPage() {
  const firestore = useFirestore();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isContractsSheetOpen, setContractsSheetOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "clients"), orderBy("name"));
  }, [firestore]);
  const { data: clients, isLoading } = useCollection<Client>(clientsQuery);

  // A single listener over the whole collection — not one query per client
  // row — grouped client-side into a per-client count for the "Contracts"
  // column. Contract volume for this business is modest, so this one read
  // beats maintaining a denormalized counter field on each client doc just
  // to avoid it.
  const contractsQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, "contracts");
  }, [firestore]);
  const { data: allContracts } = useCollection<Contract>(contractsQuery);

  const contractCountsByClient = useMemo(() => {
    const counts = new Map<string, { total: number; active: number }>();
    (allContracts ?? []).forEach((c) => {
      const entry = counts.get(c.clientId) ?? { total: 0, active: 0 };
      entry.total += 1;
      if (c.status === "Active") entry.active += 1;
      counts.set(c.clientId, entry);
    });
    return counts;
  }, [allContracts]);

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setEditDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const handleViewContracts = (client: Client) => {
    setSelectedClient(client);
    setContractsSheetOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
          <div>
            <CardTitle>Clients</CardTitle>
            <CardDescription>Manage your company's clients.</CardDescription>
          </div>
          <Button
            size="sm"
            className="gap-1 w-full sm:w-auto"
            onClick={() => setAddDialogOpen(true)}
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Add Client</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead className="hidden md:table-cell">Contract Type</TableHead>
                <TableHead className="hidden lg:table-cell">Min. Wage</TableHead>
                <TableHead className="hidden lg:table-cell">Min. Wage for Payroll</TableHead>
                <TableHead className="hidden lg:table-cell">Commission</TableHead>
                <TableHead className="hidden md:table-cell">Contracts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {clients &&
                clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{client.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {client.email || "-"}
                        </span>
                        <span className="md:hidden text-xs text-muted-foreground mt-1">
                          {client.contractType || "Standard"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewContracts(client);
                          }}
                          className="md:hidden mt-1 inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          {contractCountsByClient.get(client.id)?.total ?? 0} contract
                          {(contractCountsByClient.get(client.id)?.total ?? 0) === 1 ? "" : "s"}
                          {(contractCountsByClient.get(client.id)?.active ?? 0) > 0 && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                              {contractCountsByClient.get(client.id)?.active} active
                            </Badge>
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge
                        variant={
                          client.contractType === "H2A"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {client.contractType || "Standard"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      $
                      {client.minimumWage
                        ? client.minimumWage.toFixed(2)
                        : "N/A"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {client.minimumWageForPayroll
                        ? `$${client.minimumWageForPayroll.toFixed(2)}`
                        : "N/A"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {client.commissionRate
                        ? `${client.commissionRate}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <button
                        type="button"
                        onClick={() => handleViewContracts(client)}
                        className="inline-flex items-center gap-1.5 text-sm hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {contractCountsByClient.get(client.id)?.total ?? 0}
                        {(contractCountsByClient.get(client.id)?.active ?? 0) > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {contractCountsByClient.get(client.id)?.active} active
                          </Badge>
                        )}
                      </button>
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
                          <DropdownMenuItem onClick={() => handleEdit(client)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewContracts(client)}>
                            View Contracts
                            {(contractCountsByClient.get(client.id)?.total ?? 0) > 0
                              ? ` (${contractCountsByClient.get(client.id)?.total})`
                              : ""}
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
      <AddClientDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
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
          <ClientContractsDialog
            isOpen={isContractsSheetOpen}
            onOpenChange={setContractsSheetOpen}
            client={selectedClient}
          />
        </>
      )}
    </>
  );
}

export default function ProtectedClientsPage() {
  return (
    <RequireAdmin>
      <ClientsPage />
    </RequireAdmin>
  );
}
