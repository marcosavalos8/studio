"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil } from "lucide-react";
import type { Contract } from "@/lib/types";
import { parseLocalDate } from "@/lib/utils";
import { ContractStatusBadge } from "./contract-status-badge";
import { sanitizeContractHtml } from "./contract-template";

type ContractViewDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  contract: Contract;
  onEdit: () => void;
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  try {
    return format(parseLocalDate(value), "MM/dd/yyyy");
  } catch {
    return value;
  }
}

export function ContractViewDialog({
  isOpen,
  onOpenChange,
  contract,
  onEdit,
}: ContractViewDialogProps) {
  const updatedAt = contract.updatedAt?.toDate ? contract.updatedAt.toDate() : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {contract.contractNumber}
            <ContractStatusBadge status={contract.status} />
          </DialogTitle>
          <DialogDescription>{contract.title}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <div className="text-muted-foreground">Client</div>
            <div className="font-medium">{contract.clientSnapshot.name}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Effective Date</div>
            <div className="font-medium">{fmtDate(contract.effectiveDate)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">End Date</div>
            <div className="font-medium">{fmtDate(contract.endDate)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Last Updated</div>
            <div className="font-medium">
              {updatedAt ? format(updatedAt, "MM/dd/yyyy h:mm a") : "—"}
              {contract.updatedByName ? ` · ${contract.updatedByName}` : ""}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Billing Address</div>
            <div className="font-medium">{contract.clientSnapshot.billingAddress}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Payment Terms</div>
            <div className="font-medium">{contract.clientSnapshot.paymentTerms}</div>
          </div>
          {contract.paymentDueDays !== undefined && (
            <div>
              <div className="text-muted-foreground">Payment Due</div>
              <div className="font-medium">{contract.paymentDueDays} days</div>
            </div>
          )}
          {contract.lateFeeInterestPercent !== undefined && (
            <div>
              <div className="text-muted-foreground">Late Fee Interest</div>
              <div className="font-medium">{contract.lateFeeInterestPercent}% / month</div>
            </div>
          )}
          {contract.terminationNoticeDays !== undefined && (
            <div>
              <div className="text-muted-foreground">Termination Notice</div>
              <div className="font-medium">{contract.terminationNoticeDays} days</div>
            </div>
          )}
        </div>

        <Separator />

        <div
          className="prose-contract max-w-none rounded-md border p-4 text-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeContractHtml(contract.clauses) }}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
