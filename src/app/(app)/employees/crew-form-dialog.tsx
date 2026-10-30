"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useFirestore } from "@/firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { Crew, Employee } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { addOfflineIndicator } from "@/lib/offline-utils";

type CrewFormDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // undefined/null = create mode; an existing crew = edit mode
  crew?: Crew | null;
  employees: Employee[];
  // Create mode only: pre-check these employees (e.g. suggesting a crew
  // from a Bulk Clock In / Past Records selection) instead of starting
  // from an empty set.
  initialSelectedIds?: string[];
};

// Shared Add/Edit dialog for crews — a crew is just a name plus a set of
// employeeIds, so the create and edit forms are identical except for which
// Firestore write they perform.
export function CrewFormDialog({
  isOpen,
  onOpenChange,
  crew,
  employees,
  initialSelectedIds,
}: CrewFormDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate (or reset) the form each time the dialog opens, for whichever
  // crew (or none, for create mode) it was opened with.
  useEffect(() => {
    if (isOpen) {
      setName(crew?.name ?? "");
      setSelectedIds(new Set(crew?.employeeIds ?? initialSelectedIds ?? []));
      setSearch("");
    }
  }, [isOpen, crew, initialSelectedIds]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const matchesName = e.name.toLowerCase().includes(q);
      const matchesNumber = (e.employeeNumber ?? "")
        .toLowerCase()
        .includes(q);
      return matchesName || matchesNumber;
    });
  }, [employees, search]);

  const toggleEmployee = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!firestore) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        variant: "destructive",
        title: "Missing Name",
        description: "Please enter a crew name.",
      });
      return;
    }
    if (selectedIds.size === 0) {
      toast({
        variant: "destructive",
        title: "No Employees Selected",
        description: "Please select at least one employee.",
      });
      return;
    }

    const employeeIds = Array.from(selectedIds);

    if (!isOnline) {
      if (crew) {
        updateDoc(doc(firestore, "crews", crew.id), {
          name: trimmedName,
          employeeIds,
          updatedAt: Timestamp.now(),
        }).catch((error) => {
          console.warn("Failed to queue offline crew update:", error);
        });
      } else {
        setDoc(doc(collection(firestore, "crews")), {
          name: trimmedName,
          employeeIds,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }).catch((error) => {
          console.warn("Failed to queue offline crew creation:", error);
        });
      }
      toast({
        title: crew ? "Crew Updated" : "Crew Created",
        description: addOfflineIndicator(
          `"${trimmedName}" has been ${crew ? "updated" : "created"}.`,
          isOnline,
        ),
      });
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = Timestamp.now();
      if (crew) {
        await updateDoc(doc(firestore, "crews", crew.id), {
          name: trimmedName,
          employeeIds,
          updatedAt: now,
        });
      } else {
        await setDoc(doc(collection(firestore, "crews")), {
          name: trimmedName,
          employeeIds,
          createdAt: now,
          updatedAt: now,
        });
      }
      toast({
        title: crew ? "Crew Updated" : "Crew Created",
        description: addOfflineIndicator(
          `"${trimmedName}" has been ${crew ? "updated" : "created"}.`,
          isOnline,
        ),
      });
      onOpenChange(false);
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: crew ? `crews/${crew.id}` : "crews",
        operation: crew ? "update" : "create",
        requestResourceData: { name: trimmedName, employeeIds },
      });
      errorEmitter.emit("permission-error", permissionError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{crew ? "Edit Crew" : "Create Crew"}</DialogTitle>
          <DialogDescription>
            A crew is a reusable group of employees you can later assign to
            any task — it isn't tied to a specific task, ranch, or client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crew-name">Crew Name</Label>
            <Input
              id="crew-name"
              placeholder="e.g., Cuadrilla 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Employees ({selectedIds.size} selected)</Label>
            <Input
              placeholder="Search by name or employee number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2 border rounded-md p-4 max-h-72 overflow-y-auto">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={`crew-emp-${employee.id}`}
                    checked={selectedIds.has(employee.id)}
                    onCheckedChange={(checked: boolean) =>
                      toggleEmployee(employee.id, checked)
                    }
                  />
                  <Label
                    htmlFor={`crew-emp-${employee.id}`}
                    className="text-sm font-normal truncate"
                  >
                    {employee.name}
                  </Label>
                </div>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="col-span-2 text-sm text-muted-foreground">
                  No employees found.
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {crew ? "Save Changes" : "Create Crew"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
