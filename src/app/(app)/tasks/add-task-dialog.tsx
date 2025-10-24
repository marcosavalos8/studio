"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useFirestore } from "@/firebase";
import { addDoc, collection } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { Client, Task } from "@/lib/types";
import { Loader2 } from "lucide-react";

type AddTaskDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clients: Client[];
};

export function AddTaskDialog({
  isOpen,
  onOpenChange,
  clients,
}: AddTaskDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados simples sin validaciones
  const [name, setName] = useState("");
  const [variety, setVariety] = useState("");
  const [ranch, setRanch] = useState("");
  const [block, setBlock] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientRate, setClientRate] = useState("");
  const [clientRateType, setClientRateType] = useState<"hourly" | "piece">(
    "hourly"
  );
  const [piecePrice, setPiecePrice] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive" | "Completed">(
    "Active"
  );

  const resetForm = () => {
    setName("");
    setVariety("");
    setRanch("");
    setBlock("");
    setClientId("");
    setClientRate("");
    setClientRateType("hourly");
    setPiecePrice("");
    setStatus("Active");
  };

  const handleSubmit = async () => {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Firestore is not available.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newTask: Omit<Task, "id"> = {
        name: name || "Untitled Task",
        variety: variety || "",
        ranch: ranch || "",
        block: block || "",
        clientId: clientId || "",
        clientRateType,
        status,
        clientRate:
          clientRateType === "hourly"
            ? parseFloat(clientRate) || 0
            : parseFloat(piecePrice) || 0,
        piecePrice: parseFloat(piecePrice) || 0, // <- Siempre envía 0, nunca undefined
      };

      await addDoc(collection(firestore, "tasks"), newTask);

      toast({
        title: "Task Added",
        description: `${newTask.name} has been added successfully.`,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding task:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add task. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Enter the details for the new work task or project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Task Name</Label>
              <Input
                id="name"
                placeholder="e.g., Apple Picking"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
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

            <div className="space-y-2">
              <Label htmlFor="variety">Variety</Label>
              <Input
                id="variety"
                placeholder="e.g., Gala"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value: "Active" | "Inactive" | "Completed") =>
                  setStatus(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ranch">Ranch</Label>
              <Input
                id="ranch"
                placeholder="e.g., North Ridge"
                value={ranch}
                onChange={(e) => setRanch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="block">Block</Label>
              <Input
                id="block"
                placeholder="e.g., A-15"
                value={block}
                onChange={(e) => setBlock(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateType">Rate Type</Label>
              <Select
                value={clientRateType}
                onValueChange={(value: "hourly" | "piece") =>
                  setClientRateType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rate type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="piece">Piecework</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {clientRateType === "piece" ? (
              <div className="space-y-2">
                <Label htmlFor="piecePrice">Piece Price ($)</Label>
                <Input
                  id="piecePrice"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 0.50"
                  value={piecePrice}
                  onChange={(e) => setPiecePrice(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="clientRate">Hourly Rate ($)</Label>
                <Input
                  id="clientRate"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 25.00"
                  value={clientRate}
                  onChange={(e) => setClientRate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
