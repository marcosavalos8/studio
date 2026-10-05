"use client";

import * as React from "react";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export function overtimeWaiverId(employeeId: string, year: number, weekNumber: number): string {
  return `${employeeId}_${year}-${weekNumber}`;
}

type Props = {
  employeeId: string;
  weeks: Array<{ year: number; weekNumber: number }>;
};

export function OvertimeWaiverControl({ employeeId, weeks }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [waived, setWaived] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const weeksKey = weeks.map((w) => `${w.year}-${w.weekNumber}`).join(",");

  React.useEffect(() => {
    if (!firestore || weeks.length === 0) return;
    let cancelled = false;
    Promise.all(
      weeks.map((w) =>
        getDoc(doc(firestore, "overtimeWaivers", overtimeWaiverId(employeeId, w.year, w.weekNumber)))
      )
    )
      .then((snaps) => {
        if (!cancelled) setWaived(snaps.length > 0 && snaps.every((s) => s.exists()));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, employeeId, weeksKey]);

  const handleToggle = async (next: boolean) => {
    if (!firestore) return;
    setSaving(true);
    try {
      let updatedBy = "";
      try {
        updatedBy = localStorage.getItem("username") ?? "";
      } catch {
        updatedBy = "";
      }
      await Promise.all(
        weeks.map((w) => {
          const ref = doc(firestore, "overtimeWaivers", overtimeWaiverId(employeeId, w.year, w.weekNumber));
          return next
            ? setDoc(ref, {
                employeeId,
                year: w.year,
                weekNumber: w.weekNumber,
                waived: true,
                updatedBy,
                updatedAt: serverTimestamp(),
              })
            : deleteDoc(ref);
        })
      );
      setWaived(next);
      toast({
        title: next ? "Overtime condonado al cliente" : "Overtime se cobra al cliente",
      });
    } catch (err) {
      console.error("Error saving overtime waiver:", err);
      toast({ title: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex items-center gap-2 text-xs print:hidden">
      <input
        type="checkbox"
        checked={waived}
        disabled={saving || !firestore}
        onChange={(e) => handleToggle(e.target.checked)}
      />
      <span>
        Condonar overtime (no se cobra al cliente; el trabajador sí cobra su overtime)
      </span>
    </label>
  );
}
