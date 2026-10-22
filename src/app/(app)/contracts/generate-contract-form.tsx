"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import type { Client } from "@/lib/types";
import { ContractFormDialog } from "./contract-form-dialog";

type GenerateContractFormProps = {
  clients: Client[];
};

// Mirrors Invoicing's "pick a client, click Generate" flow: select a client
// from the list, click the button, and the (already prefilled) contract
// form opens — same ContractFormDialog used everywhere else a contract is
// created or edited.
export function GenerateContractForm({ clients }: GenerateContractFormProps) {
  const [selectedClientId, setSelectedClientId] = React.useState<string>("");
  const [isFormOpen, setFormOpen] = React.useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <div className="sm:col-span-2 space-y-2">
          <label className="text-sm font-medium leading-none">Client</label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button disabled={!selectedClient} onClick={() => setFormOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Generate Contract
        </Button>
      </div>

      {selectedClient && (
        <ContractFormDialog
          isOpen={isFormOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            // Clear the selection once the dialog closes, so reopening it
            // (or picking a different client) always starts from a clean
            // "nothing selected" state instead of re-showing the last pick.
            if (!open) setSelectedClientId("");
          }}
          client={selectedClient}
        />
      )}
    </div>
  );
}
