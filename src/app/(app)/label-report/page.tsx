"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LabelReportForm } from "./label-report-form";
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

export type DetailedLabelReportData = {
  client: Client;
  date: {
    from: string;
    to: string;
  };
  dailyBreakdown: DailyBreakdown;
  laborCost: number;
  minimumWageTopUp: number;
  paidRestBreaks: number;
  overtimePremium?: number;
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

function LabelReportPage() {
  const firestore = useFirestore();
  const clientsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "clients"), orderBy("name"));
  }, [firestore]);
  const { data: clients, isLoading: loadingClients } =
    useCollection<Client>(clientsQuery);

  return (
    <div className="grid gap-3 md:gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Generate Label Report</CardTitle>
          <CardDescription className="text-sm">
            Select a client and date range to generate a label report showing
            worker details grouped by the selected date range.
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
          {clients && <LabelReportForm clients={clients} />}
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(LabelReportPage, { askEveryVisit: true });
