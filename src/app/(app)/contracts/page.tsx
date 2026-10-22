"use client";

import { RequireAdmin } from "@/components/require-admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirestore } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy } from "firebase/firestore";
import type { Client } from "@/lib/types";
import { useMemo } from "react";
import { GenerateContractForm } from "./generate-contract-form";
import { ContractManagement } from "./contract-management";

function ContractsPage() {
  const firestore = useFirestore();
  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "clients"), orderBy("name"));
  }, [firestore]);
  const { data: clients, isLoading: loadingClients } = useCollection<Client>(clientsQuery);

  return (
    <div className="grid gap-3 md:gap-4">
      <Tabs defaultValue="generate">
        <TabsList className="mb-4">
          <TabsTrigger value="generate">Generate Contract</TabsTrigger>
          <TabsTrigger value="management">Contract Management</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Generate Contract</CardTitle>
              <CardDescription className="text-sm">
                Select a client to create a new service contract for them, preloaded with their
                current billing information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClients && (
                <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {clients && <GenerateContractForm clients={clients} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="management">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Contract Management</CardTitle>
              <CardDescription className="text-sm">
                Every contract across every client: search, filter by status, view, edit, or
                mark one as completed or terminated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContractManagement clients={clients ?? []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProtectedContractsPage() {
  return (
    <RequireAdmin>
      <ContractsPage />
    </RequireAdmin>
  );
}
