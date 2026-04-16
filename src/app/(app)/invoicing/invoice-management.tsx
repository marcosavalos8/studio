"use client";

import * as React from "react";
import { useFirestore } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import {
  collection,
  query,
  orderBy,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import type { SavedInvoice } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  Mail,
  Loader2,
  FileText,
} from "lucide-react";

function toDate(val: SavedInvoice["createdAt"]): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

function RelativeTime({ date }: { date: Date | null }) {
  const [label, setLabel] = React.useState<string>("-");

  React.useEffect(() => {
    if (!date) {
      setLabel("-");
      return;
    }
    setLabel(formatRelativeTime(date));
    const interval = setInterval(() => setLabel(formatRelativeTime(date)), 60_000);
    return () => clearInterval(interval);
  }, [date]);

  if (!date) return <span className="text-muted-foreground">-</span>;
  return <span title={date.toLocaleString()}>{label}</span>;
}

export function InvoiceManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loadingActions, setLoadingActions] = React.useState<Record<string, boolean>>({});

  const invoicesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "invoices"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: invoices, isLoading } = useCollection<SavedInvoice>(invoicesQuery);

  const setActionLoading = (id: string, loading: boolean) =>
    setLoadingActions((prev) => ({ ...prev, [id]: loading }));

  const handleMarkPaid = async (invoice: SavedInvoice) => {
    if (!firestore || !invoice.id) return;
    setActionLoading(invoice.id, true);
    try {
      await updateDoc(doc(firestore, "invoices", invoice.id), {
        status: "paid",
        paidAt: Timestamp.now(),
      });
      toast({ title: "Invoice marcado como pagado", description: `Invoice #${invoice.invoiceNumber} actualizado.` });
    } catch (err) {
      console.error("Error marking invoice as paid:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el invoice." });
    } finally {
      setActionLoading(invoice.id, false);
    }
  };

  const handleSendEmail = async (invoice: SavedInvoice) => {
    if (!invoice.id) return;
    if (!invoice.clientEmail) {
      toast({
        variant: "destructive",
        title: "Sin correo",
        description: "Este cliente no tiene correo electrónico registrado.",
      });
      return;
    }
    setActionLoading(`email-${invoice.id}`, true);
    try {
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          dateFrom: invoice.dateFrom,
          dateTo: invoice.dateTo,
          total: invoice.total,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al enviar el correo");
      }

      // Update sentAt in Firestore
      if (firestore) {
        await updateDoc(doc(firestore, "invoices", invoice.id), {
          sentAt: Timestamp.now(),
        });
      }

      toast({ title: "Correo enviado", description: `Invoice #${invoice.invoiceNumber} enviado a ${invoice.clientEmail}.` });
    } catch (err) {
      console.error("Error sending invoice email:", err);
      toast({
        variant: "destructive",
        title: "Error al enviar",
        description: err instanceof Error ? err.message : "No se pudo enviar el correo.",
      });
    } finally {
      setActionLoading(`email-${invoice.id}`, false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <FileText className="h-12 w-12 opacity-30" />
        <p className="text-sm">No hay invoices generados aún.</p>
        <p className="text-xs">Genera un invoice en la pestaña "Generar Invoice".</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Invoice #</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="whitespace-nowrap">Período</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="whitespace-nowrap">Creado</TableHead>
            <TableHead className="whitespace-nowrap">Enviado</TableHead>
            <TableHead className="whitespace-nowrap">Pagado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const createdAt = toDate(invoice.createdAt);
            const sentAt = toDate(invoice.sentAt ?? null);
            const paidAt = toDate(invoice.paidAt ?? null);
            const isActing = loadingActions[invoice.id ?? ""] || loadingActions[`email-${invoice.id}`];
            const isPaid = invoice.status === "paid";

            return (
              <TableRow key={invoice.id}>
                <TableCell className="font-mono font-medium whitespace-nowrap">
                  #{invoice.invoiceNumber}
                </TableCell>
                <TableCell className="whitespace-nowrap">{invoice.clientName}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {invoice.dateFrom} – {invoice.dateTo}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  ${invoice.total?.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Badge variant={isPaid ? "default" : "secondary"}>
                    {isPaid ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Pagado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Pendiente
                      </span>
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  <RelativeTime date={createdAt} />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  <RelativeTime date={sentAt} />
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  <RelativeTime date={paidAt} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {!isPaid && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkPaid(invoice)}
                        disabled={isActing}
                        className="whitespace-nowrap"
                      >
                        {loadingActions[invoice.id ?? ""] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        Marcar pagado
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendEmail(invoice)}
                      disabled={isActing || !invoice.clientEmail}
                      title={!invoice.clientEmail ? "El cliente no tiene email registrado" : `Enviar a ${invoice.clientEmail}`}
                    >
                      {loadingActions[`email-${invoice.id}`] ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3 mr-1" />
                      )}
                      Enviar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
