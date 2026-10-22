"use client";

import * as React from "react";
import { format } from "date-fns";
import { collection, doc, query, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Button } from "@/components/ui/button";
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
import { FileText, Loader2, MoreHorizontal } from "lucide-react";
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

type ContractManagementProps = {
  clients: Client[];
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

export function ContractManagement({ clients }: ContractManagementProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { username } = useAuth();
  const { user } = useUser();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ContractStatus | "All">("All");
  const [clientFilter, setClientFilter] = React.useState<string>("All");
  const [editingContract, setEditingContract] = React.useState<Contract | null>(null);
  const [viewingContract, setViewingContract] = React.useState<Contract | null>(null);
  const [closingContract, setClosingContract] = React.useState<{
    contract: Contract;
    status: "Completed" | "Terminated";
  } | null>(null);
  const [isClosing, setIsClosing] = React.useState(false);

  const contractsQuery = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, "contracts"));
  }, [firestore]);
  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const clientById = React.useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const sortedContracts = React.useMemo(() => {
    return [...(contracts ?? [])].sort(
      (a, b) => parseLocalDate(b.effectiveDate).getTime() - parseLocalDate(a.effectiveDate).getTime(),
    );
  }, [contracts]);

  const filteredContracts = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedContracts.filter((c) => {
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (clientFilter !== "All" && c.clientId !== clientFilter) return false;
      if (!term) return true;
      return (
        c.contractNumber.toLowerCase().includes(term) ||
        c.title.toLowerCase().includes(term) ||
        c.clientSnapshot.name.toLowerCase().includes(term)
      );
    });
  }, [sortedContracts, statusFilter, clientFilter, search]);

  // The contract's own clientId may point to a client that was since
  // deleted — fall back to a client shape built from the contract's own
  // snapshot so Edit still works (the snapshot is what gets shown/edited
  // anyway; only the live client's id matters structurally here).
  const resolveClient = (contract: Contract): Client => {
    const live = clientById.get(contract.clientId);
    if (live) return live;
    const snap = contract.clientSnapshot;
    return {
      id: contract.clientId,
      name: snap.name,
      billingAddress: snap.billingAddress,
      paymentTerms: snap.paymentTerms,
      email: snap.email,
      phone: snap.phone,
      commissionRate: snap.commissionRate,
      minimumWage: snap.minimumWage,
      minimumWageForPayroll: snap.minimumWageForPayroll,
      contractType: snap.contractType,
    };
  };

  const handleEdit = (contract: Contract) => {
    setViewingContract(null);
    setEditingContract(contract);
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
        ...(contract.endDate ? {} : { endDate: format(new Date(), "yyyy-MM-dd") }),
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
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        <Input
          placeholder="Search by folio, title, or client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px]"
        />
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Effective</TableHead>
              <TableHead className="hidden sm:table-cell">End</TableHead>
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
            {!isLoading && filteredContracts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {contracts && contracts.length > 0
                      ? "No contracts match your filters."
                      : "No contracts yet. Create one from the Generate Contract tab."}
                  </p>
                </TableCell>
              </TableRow>
            )}
            {filteredContracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    className="hover:underline text-left"
                    onClick={() => setViewingContract(contract)}
                  >
                    {contract.contractNumber}
                  </button>
                  <div className="md:hidden text-xs text-muted-foreground">{contract.title}</div>
                </TableCell>
                <TableCell>{contract.clientSnapshot.name}</TableCell>
                <TableCell className="hidden md:table-cell">{contract.title}</TableCell>
                <TableCell>
                  <ContractStatusBadge status={contract.status} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {fmtDate(contract.effectiveDate)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{fmtDate(contract.endDate)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
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
                            onClick={() => setClosingContract({ contract, status: "Completed" })}
                          >
                            Mark Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => setClosingContract({ contract, status: "Terminated" })}
                          >
                            Terminate
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {viewingContract && (
        <ContractViewDialog
          isOpen={!!viewingContract}
          onOpenChange={(open) => !open && setViewingContract(null)}
          contract={viewingContract}
          onEdit={() => handleEdit(viewingContract)}
        />
      )}

      {editingContract && (
        <ContractFormDialog
          isOpen={!!editingContract}
          onOpenChange={(open) => !open && setEditingContract(null)}
          client={resolveClient(editingContract)}
          contract={editingContract}
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
            <AlertDialogAction
              disabled={isClosing}
              onClick={(e) => {
                e.preventDefault();
                void confirmCloseContract();
              }}
            >
              {isClosing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
