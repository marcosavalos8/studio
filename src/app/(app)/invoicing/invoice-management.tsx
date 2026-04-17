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
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import type { SavedInvoice } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlarmClock,
  Mail,
  Loader2,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function toDate(val: SavedInvoice["createdAt"]): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

/** Parse "MM/dd/yyyy" → Date at midnight local time */
function parseInvoiceDate(dateStr: string): Date | null {
  const parts = dateStr?.split("/");
  if (!parts || parts.length !== 3) return null;
  const [month, day, year] = parts.map(Number);
  if (!month || !day || !year) return null;
  return new Date(year, month - 1, day);
}

/** Compute the due date from invoiceDate string + payment terms */
function computeDueDate(invoice: SavedInvoice): Date | null {
  const base = parseInvoiceDate(invoice.invoiceDate);
  if (!base) return null;
  const paymentTerms =
    invoice.invoiceClientData?.paymentTerms ?? "";
  const match = paymentTerms.match(/\d+/);
  const days = match ? parseInt(match[0], 10) : 30;
  const due = new Date(base);
  due.setDate(due.getDate() + days);
  return due;
}

/** Returns the number of whole days from today midnight to dueDateMidnight (negative = overdue) */
function daysUntilDue(dueDate: Date): number {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
}

type DynamicStatus = "paid" | "pending" | "due_soon" | "due_today" | "overdue";

function computeStatus(invoice: SavedInvoice): DynamicStatus {
  if (invoice.status === "paid") return "paid";
  const dueDate = computeDueDate(invoice);
  if (!dueDate) return "pending";
  const days = daysUntilDue(dueDate);
  if (days >= 7) return "pending";
  if (days >= 1) return "due_soon";
  if (days === 0) return "due_today";
  return "overdue";
}

/** Late fees: 1% per month (per-diem) from due date to today */
function computeLateFees(invoice: SavedInvoice): number {
  if (invoice.status === "paid") return 0;
  const dueDate = computeDueDate(invoice);
  if (!dueDate) return 0;
  const days = daysUntilDue(dueDate);
  if (days >= 0) return 0; // not overdue yet
  const daysOverdue = Math.abs(days);
  return invoice.subtotal * (daysOverdue / 30) * 0.01;
}

function StatusBadge({ status }: { status: DynamicStatus }) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-green-600 text-white hover:bg-green-700 whitespace-nowrap">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      );
    case "due_soon":
      return (
        <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 whitespace-nowrap">
          <AlarmClock className="h-3 w-3 mr-1" /> Due Soon
        </Badge>
      );
    case "due_today":
      return (
        <Badge className="bg-orange-500 text-white hover:bg-orange-600 whitespace-nowrap">
          <AlertCircle className="h-3 w-3 mr-1" /> Due Today
        </Badge>
      );
    case "overdue":
      return (
        <Badge className="bg-red-600 text-white hover:bg-red-700 whitespace-nowrap">
          <AlertCircle className="h-3 w-3 mr-1" /> Overdue
        </Badge>
      );
  }
}

function AgingCell({ invoice, status }: { invoice: SavedInvoice; status: DynamicStatus }) {
  if (status === "paid") return <span className="text-muted-foreground text-xs">—</span>;
  const dueDate = computeDueDate(invoice);
  if (!dueDate) return <span className="text-muted-foreground text-xs">—</span>;
  const days = daysUntilDue(dueDate);
  if (days > 0) {
    return <span className="text-sm text-blue-600">{days}d left</span>;
  }
  if (days === 0) {
    return <span className="text-sm font-semibold text-orange-500">Due today</span>;
  }
  return <span className="text-sm font-semibold text-red-600">{Math.abs(days)}d overdue</span>;
}

function formatDateTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

// ─── types ────────────────────────────────────────────────────────────────────

type SortField = "invoiceNumber" | "clientName" | "dateFrom" | "subtotal" | "status" | "createdAt" | "dueDate";
type SortDir = "asc" | "desc";

// ─── SortableHead ─────────────────────────────────────────────────────────────

function SortableHead({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === field;
  return (
    <TableHead
      className={`whitespace-nowrap cursor-pointer select-none ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </TableHead>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function InvoiceManagement() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // action loading per row
  const [loadingActions, setLoadingActions] = React.useState<Record<string, boolean>>({});

  // filters
  const [filterClient, setFilterClient] = React.useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = React.useState<string>("");
  const [filterDateTo, setFilterDateTo] = React.useState<string>("");
  const [filterInvoiceNumber, setFilterInvoiceNumber] = React.useState<string>("");

  // sorting
  const [sortField, setSortField] = React.useState<SortField>("createdAt");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  // selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = React.useState(false);

  // Fetch all invoices ordered by createdAt; client-side filter + sort applied below
  const invoicesQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "invoices"), orderBy("createdAt", "desc"));
  }, [firestore]);

  const { data: allInvoices, isLoading } = useCollection<SavedInvoice>(invoicesQuery);

  // ── derived: unique client list for filter dropdown ──
  const clientOptions = React.useMemo(() => {
    if (!allInvoices) return [];
    const names = Array.from(new Set(allInvoices.map((inv) => inv.clientName))).sort();
    return names;
  }, [allInvoices]);

  // ── derived: filtered + sorted invoices ──
  const invoices = React.useMemo(() => {
    if (!allInvoices) return [];
    let list = [...allInvoices];

    // filter by invoice number (partial match, case-insensitive, strips leading #)
    if (filterInvoiceNumber.trim()) {
      const needle = filterInvoiceNumber.trim().replace(/^#/, "").toLowerCase();
      list = list.filter((inv) => inv.invoiceNumber.toLowerCase().includes(needle));
    }

    // filter by client
    if (filterClient !== "all") {
      list = list.filter((inv) => inv.clientName === filterClient);
    }

    // filter by date range (show invoices whose period starts on or after filterDateFrom
    // and ends on or before filterDateTo)
    if (filterDateFrom) {
      list = list.filter((inv) => inv.dateFrom >= filterDateFrom);
    }
    if (filterDateTo) {
      list = list.filter((inv) => inv.dateTo <= filterDateTo);
    }

    // sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "invoiceNumber":
          cmp = a.invoiceNumber.localeCompare(b.invoiceNumber);
          break;
        case "clientName":
          cmp = a.clientName.localeCompare(b.clientName);
          break;
        case "dateFrom":
          cmp = a.dateFrom.localeCompare(b.dateFrom);
          break;
        case "subtotal":
          cmp = (a.subtotal ?? 0) - (b.subtotal ?? 0);
          break;
        case "status":
          cmp = computeStatus(a).localeCompare(computeStatus(b));
          break;
        case "createdAt": {
          const aDate = toDate(a.createdAt)?.getTime() ?? 0;
          const bDate = toDate(b.createdAt)?.getTime() ?? 0;
          cmp = aDate - bDate;
          break;
        }
        case "dueDate": {
          const aDue = computeDueDate(a)?.getTime() ?? 0;
          const bDue = computeDueDate(b)?.getTime() ?? 0;
          cmp = aDue - bDue;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [allInvoices, filterClient, filterDateFrom, filterDateTo, filterInvoiceNumber, sortField, sortDir]);

  // ── selection helpers ──
  const allVisibleIds = invoices.map((inv) => inv.id ?? "").filter(Boolean);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = allVisibleIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── sorting toggle ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const setActionLoading = (id: string, loading: boolean) =>
    setLoadingActions((prev) => ({ ...prev, [id]: loading }));

  // ── mark paid ──
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

  // ── send email ──
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
          minimumWageTopUp: invoice.minimumWageTopUp,
          paidRestBreaks: invoice.paidRestBreaks,
          overtimePremium: invoice.overtimePremium,
          overtimeHours: invoice.overtimeHours,
          subtotal: invoice.subtotal,
          commission: invoice.commission,
          dailyBreakdown: invoice.dailyBreakdown ?? null,
          invoiceClientData: invoice.invoiceClientData ?? null,
          employeeDetails: invoice.employeeDetails ?? [],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error al enviar el correo");
      }

      if (firestore) {
        await updateDoc(doc(firestore, "invoices", invoice.id), {
          sentAt: Timestamp.now(),
          emailSentCount: (invoice.emailSentCount ?? 0) + 1,
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

  // ── bulk delete ──
  const handleBulkDelete = async () => {
    if (!firestore || selectedIds.size === 0) return;
    setDeletingBulk(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => deleteDoc(doc(firestore, "invoices", id))));
      setSelectedIds(new Set());
      toast({ title: "Invoices eliminados", description: `${ids.length} invoice(s) eliminado(s).` });
    } catch (err) {
      console.error("Error deleting invoices:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron eliminar los invoices." });
    } finally {
      setDeletingBulk(false);
    }
  };

  // ── loading state ──
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const hasInvoices = allInvoices && allInvoices.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Invoice # filter */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Invoice #</span>
          <Input
            type="text"
            placeholder="Buscar #..."
            className="h-9 w-[130px]"
            value={filterInvoiceNumber}
            onChange={(e) => setFilterInvoiceNumber(e.target.value)}
          />
        </div>

        {/* Client filter */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-xs font-medium text-muted-foreground">Cliente</span>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos los clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clientOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Desde</span>
          <Input
            type="date"
            className="h-9 w-[150px]"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Hasta</span>
          <Input
            type="date"
            className="h-9 w-[150px]"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>

        {/* Clear filters */}
        {(filterClient !== "all" || filterDateFrom || filterDateTo || filterInvoiceNumber) && (
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onClick={() => {
              setFilterClient("all");
              setFilterDateFrom("");
              setFilterDateTo("");
              setFilterInvoiceNumber("");
            }}
          >
            Limpiar filtros
          </Button>
        )}

        {/* Bulk delete button — shown when items are selected */}
        {selectedIds.size > 0 && (
          <div className="ml-auto self-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deletingBulk}>
                  {deletingBulk ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Eliminar {selectedIds.size} seleccionado(s)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar invoices?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán {selectedIds.size} invoice(s) de forma permanente. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleBulkDelete}
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {!hasInvoices && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <FileText className="h-12 w-12 opacity-30" />
          <p className="text-sm">No hay invoices generados aún.</p>
          <p className="text-xs">Genera un invoice en la pestaña &quot;Generar Invoice&quot;.</p>
        </div>
      )}

      {hasInvoices && invoices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">No se encontraron invoices con los filtros seleccionados.</p>
        </div>
      )}

      {/* ── Table ── */}
      {invoices.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {/* Select-all checkbox */}
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <SortableHead field="invoiceNumber" label="Invoice #" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="clientName" label="Customer" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="dateFrom" label="Period" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="createdAt" label="Issue Date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="dueDate" label="Due Date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortableHead field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <TableHead className="whitespace-nowrap">Aging</TableHead>
                <SortableHead field="subtotal" label="Subtotal" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <TableHead className="whitespace-nowrap">Sending Date</TableHead>
                <TableHead className="whitespace-nowrap text-right">Late Fees</TableHead>
                <TableHead className="whitespace-nowrap text-right">Total Due</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const createdAt = toDate(invoice.createdAt);
                const sentAt = toDate(invoice.sentAt ?? null);
                const id = invoice.id ?? "";
                const isActing = loadingActions[id] || loadingActions[`email-${id}`];
                const isPaid = invoice.status === "paid";
                const isSelected = selectedIds.has(id);
                const dynamicStatus = computeStatus(invoice);
                const dueDate = computeDueDate(invoice);
                const lateFees = computeLateFees(invoice);
                const totalDue = (invoice.subtotal ?? 0) + lateFees;

                return (
                  <TableRow key={id} data-selected={isSelected || undefined} className={isSelected ? "bg-muted/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(id)}
                        aria-label={`Seleccionar invoice #${invoice.invoiceNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium whitespace-nowrap">
                      #{invoice.invoiceNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{invoice.clientName}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {invoice.dateFrom} – {invoice.dateTo}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateTime(createdAt)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(dueDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={dynamicStatus} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <AgingCell invoice={invoice} status={dynamicStatus} />
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      ${(invoice.subtotal ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {sentAt ? formatDateTime(sentAt) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {lateFees > 0 ? (
                        <span className="text-red-600 font-medium">${lateFees.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      ${totalDue.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendEmail(invoice)}
                          disabled={isActing || !invoice.clientEmail}
                          title={!invoice.clientEmail ? "El cliente no tiene email registrado" : `Enviar a ${invoice.clientEmail}`}
                        >
                          {loadingActions[`email-${id}`] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Mail className="h-3 w-3 mr-1" />
                          )}
                          Send
                        </Button>
                        {!isPaid && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(invoice)}
                            disabled={isActing}
                            className="whitespace-nowrap"
                          >
                            {loadingActions[id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Mark As Paid
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-2">
            {invoices.length} invoice(s) mostrado(s){selectedIds.size > 0 && ` · ${selectedIds.size} seleccionado(s)`}
          </p>
        </div>
      )}
    </div>
  );
}
