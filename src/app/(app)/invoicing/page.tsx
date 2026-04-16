"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoicingForm } from "./invoicing-form";
import { InvoiceManagement } from "./invoice-management";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Client } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { withAuth } from "@/components/withAuth";

export type DailyBreakdown = {
  [date: string]: {
    tasks: {
      [taskName: string]: {
        taskName: string;
        hours: number;
        pieces: number;
        cost: number;
        clientRate: number;
        clientRateType: "hourly" | "piece";
      };
    };
    total: number;
  };
};

export type DetailedInvoiceData = {
  client: Client;
  date: {
    from: string;
    to: string;
  };
  invoiceNumber: string;
  invoiceDate: string;
  dailyBreakdown: DailyBreakdown;
  laborCost: number;
  minimumWageTopUp: number;
  paidRestBreaks: number;
  overtimePremium?: number;
  overtimeHours?: number;
  subtotal: number;
  commission: number;
  total: number;
  employeeDetails?: Array<{
    employeeName: string;
    employeeId: string;
    totalHours: number;
    totalPieces: number;
    paidRestBreaks: number;
    minimumWageTopUp: number;
    overtimePremium?: number;
    dailyWork: Array<{
      date: string;
      tasks: Array<{
        taskName: string;
        hours: number;
        pieces: number;
      }>;
    }>;
    tasksSummary: Array<{
      taskName: string;
      quantity: number;
      rate: number;
      rateType: "hourly" | "piece";
      cost: number;
    }>;
  }>;
};

function InvoicingPage() {
  const firestore = useFirestore();
  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "clients"), orderBy("name"));
  }, [firestore]);
  const { data: clients, isLoading: loadingClients } =
    useCollection<Client>(clientsQuery);

  return (
    <div className="grid gap-3 md:gap-4">
      <Tabs defaultValue="generate">
        <TabsList className="mb-4">
          <TabsTrigger value="generate">Generar Invoice</TabsTrigger>
          <TabsTrigger value="management">Gestión de Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Generate Invoice</CardTitle>
              <CardDescription className="text-sm">
                Select a client and date range to generate a detailed invoice for
                billing. This invoice includes all labor costs calculated according
                to WA state law.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClients && (
                <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {clients && <InvoicingForm clients={clients} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="management">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Gestión de Invoices</CardTitle>
              <CardDescription className="text-sm">
                Administra los invoices generados: márcalos como pagados, envíalos
                por correo y lleva un registro del tiempo transcurrido.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceManagement />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(InvoicingPage, { askEveryVisit: true });

