"use client";

import * as React from "react";
import { format } from "date-fns";
import { collection, doc, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Loader2, MoreHorizontal, PlusCircle } from "lucide-react";
import { useFirestore } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useUser } from "@/firebase/auth/use-user";
import type { Client, Contract, ContractStatus } from "@/lib/types";
import { parseLocalDate } from "@/lib/utils";
import { ContractStatusBadge } from "./contract-status-badge";
import { ContractFormDialog } from "./contract-form-dialog";
import { ContractViewDialog } from "./contract-view-dialog";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

type ClientContractsDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  client: Client;
};

const STATUS_FILTERS: Array<ContractStatus | "All"> = [
  "All",
  "Draft",
  "Active",
  "Completed",
  "Terminated",
  "Expired",
];

function fmtDate(value?: string | null) {
  if (!value) return "—";
  try {
    return format(parseLocalDate(value), "MM/dd/yyyy");
  } catch {
    return value;
  }
}

export function ClientContractsDialog({ isOpen, onOpenChange, client }: ClientContractsDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { username } = useAuth();
  const { user } = useUser();

  const [statusFilter, setStatusFilter] = React.useState<ContractStatus | "All">("All");
  const [search, setSearch] = React.useState("");
  const [isFormOpen, setFormOpen] = React.useState(false);
  const [editingContract, setEditingContract] = React.useState<Contract | undefined>(undefined);
  const [viewingContract, setViewingContract] = React.useState<Contract | null>(null);
  const [closingContract, setClosingContract] = React.useState<{
    contract: Contract;
    status: "Completed" | "Terminated";
  } | null>(null);
  const [isClosing, setIsClosing] = React.useState(false);

  // Scoped to this one client only — never the whole contracts collection —
  // so opening a client's contract history never reads every other
  // client's contracts too.
  const contractsQuery = React.useMemo(() => {
    if (!firestore || !client.id) return null;
    return query(
      collection(firestore, "contracts"),
      where("clientId", "==", client.id),
    );
  }, [firestore, client.id]);
  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const sortedContracts = React.useMemo(() => {
    return [...(contracts ?? [])].sort(
      (a, b) => parseLocalDate(b.effectiveDate).getTime() - parseLocalDate(a.effectiveDate).getTime(),
    );
  }, [contracts]);

  const filteredContracts = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedContracts.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (!term) return true;
      return (
        c.contractNumber.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term)
      );
    });
  }, [sortedContracts, statusFilter, search]);

  const activeCount = (contracts ?? []).filter((c) => c.status === "Active").length;

  const handleNewContract = () => {
    setEditingContract(undefined);
    setFormOpen(true);
  };

  const handleEdit = (contract: Contract) => {
    setViewingContract(null);
    setEditingContract(contract);
    setFormOpen(true);
  };

  const confirmCloseContract = async () => {
    if (!firestore || !closingContract) return;
    setIsClosing(true);
    const { contract, status } = closingContract;
    try {
      const ref = doc(firestore, "contracts", contract.id);
      await updateDoc(ref, {
        status,
        // Only fill endDate if it isn't already set — never overwrite a
        // date the user deliberately entered.
        ...(contract.endDate
          ? {}
          : { endDate: format(new Date(), "yyyy-MM-dd") }),
        updatedAt: serverTimestamp(),
        updatedByUid: user?.uid ?? null,
        updatedByName: username ?? null,
      });
      toast({
        title: `Contract ${status.toLowerCase()}`,
        description: `${contract.contractNumber} is now ${status}.`,
      });
      setClosingContract(null);
    } catch {
      const permissionError = new FirestorePermissionError({
        path: `contracts/${contract.id}`,
        operation: "update",
      });
      errorEmitter.emit("permission-error", permissionError);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not update the contract status.",
      });
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{client.name} — Contracts</DialogTitle>
            <DialogDescription>
              {client.email || "No email on file"} · {client.billingAddress}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-4 text-sm">
              <div>
                <span className="font-semibold">{contracts?.length ?? 0}</span>{" "}
                <span className="text-muted-foreground">total</span>
              </div>
              <div>
                <span className="font-semibold">{activeCount}</span>{" "}
                <span className="text-muted-foreground">active</span>
              </div>
            </div>
            <Button size="sm" onClick={handleNewContract}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Contract
            </Button>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <Input
              placeholder="Search by folio or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[140px]"
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ContractStatus | "All")}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 space-y-2">
            {isLoading && (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            )}
            {!isLoading && filteredContracts.length === 0 && (
              <div className="py-10 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {contracts && contracts.length > 0
                    ? "No contracts match your filters."
                    : "No contracts yet for this client."}
                </p>
                {(!contracts || contracts.length === 0) && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleNewContract}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create the first contract
                  </Button>
                )}
              </div>
            )}
            {filteredContracts.map((contract) => (
              <div
                key={contract.id}
                className="rounded-lg border p-3 flex items-start justify-between gap-2"
              >
                <button
                  type="button"
                  className="text-left flex-1 min-w-0"
                  onClick={() => setViewingContract(contract)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{contract.contractNumber}</span>
                    <ContractStatusBadge status={contract.status} />
                  </div>
                  <div className="text-sm text-muted-foreground truncate">{contract.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fmtDate(contract.effectiveDate)} – {fmtDate(contract.endDate)}
                  </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 shrink-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewingContract(contract)}>
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(contract)}>Edit</DropdownMenuItem>
                    {contract.status === "Active" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            setClosingContract({ contract, status: "Completed" })
                          }
                        >
                          Mark Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          onClick={() =>
                            setClosingContract({ contract, status: "Terminated" })
                          }
                        >
                          Terminate
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ContractFormDialog
        isOpen={isFormOpen}
        onOpenChange={setFormOpen}
        client={client}
        contract={editingContract}
      />

      {viewingContract && (
        <ContractViewDialog
          isOpen={!!viewingContract}
          onOpenChange={(open) => !open && setViewingContract(null)}
          contract={viewingContract}
          onEdit={() => handleEdit(viewingContract)}
        />
      )}

      <AlertDialog
        open={!!closingContract}
        onOpenChange={(open) => !open && setClosingContract(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mark {closingContract?.contract.contractNumber} as {closingContract?.status}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The contract stays in the client's history either way — this only changes its
              status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosing}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isClosing} onClick={(e) => { e.preventDefault(); void confirmCloseContract(); }}>
              {isClosing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
