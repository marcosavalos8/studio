"use client";

import * as React from "react";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { overtimeAssignmentId } from "@/lib/types";

const AUTO = "__auto__";
const NONE = "__none__";

type Props = {
  employeeId: string;
  year: number;
  weekNumber: number;
  clientsWorked: Array<{ clientId: string; clientName: string }>;
};

export function OvertimeAssignmentControl({ employeeId, year, weekNumber, clientsWorked }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const docId = overtimeAssignmentId(employeeId, year, weekNumber);
  const [value, setValue] = React.useState<string>(AUTO);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!firestore) return;
    let cancelled = false;
    getDoc(doc(firestore, "overtimeAssignments", docId))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setValue(AUTO);
          return;
        }
        const clientId = (snap.data() as { clientId: string | null }).clientId;
        setValue(clientId === null ? NONE : clientId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [firestore, docId]);

  const handleChange = async (next: string) => {
    if (!firestore) return;
    setSaving(true);
    try {
      const ref = doc(firestore, "overtimeAssignments", docId);
      if (next === AUTO) {
        await deleteDoc(ref);
      } else {
        let updatedBy = "";
        try {
          updatedBy = localStorage.getItem("username") ?? "";
        } catch {
          updatedBy = "";
        }
        await setDoc(ref, {
          employeeId,
          year,
          weekNumber,
          clientId: next === NONE ? null : next,
          updatedBy,
          updatedAt: serverTimestamp(),
        });
      }
      setValue(next);
      toast({ title: "Cobro de overtime actualizado" });
    } catch (err) {
      console.error("Error saving overtime assignment:", err);
      toast({ title: "No se pudo guardar la decisión de overtime", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs print:hidden">
      <span className="font-medium">Cobrar overtime a:</span>
      <select
        className="border rounded-md px-2 py-1 bg-background"
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value={AUTO}>Automático (cronológico)</option>
        {clientsWorked.map((c) => (
          <option key={c.clientId} value={c.clientId}>
            {c.clientName}
          </option>
        ))}
        <option value={NONE}>Ninguno (no cobrar)</option>
      </select>
    </div>
  );
}
