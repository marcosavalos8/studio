"use client";

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
import { Button } from "@/components/ui/button";
import { useFirestore } from "@/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { Crew } from "@/lib/types";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { addOfflineIndicator } from "@/lib/offline-utils";

type DeleteCrewDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  crew: Crew;
};

export function DeleteCrewDialog({
  isOpen,
  onOpenChange,
  crew,
}: DeleteCrewDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!firestore) return;
    setIsDeleting(true);

    try {
      const crewRef = doc(firestore, "crews", crew.id);

      if (!isOnline) {
        toast({
          title: "Crew Deleted",
          description: addOfflineIndicator(
            `"${crew.name}" has been deleted.`,
            isOnline,
          ),
        });
        onOpenChange(false);
        setIsDeleting(false);
        return;
      }

      await deleteDoc(crewRef);

      toast({
        title: "Crew Deleted",
        description: `"${crew.name}" has been deleted.`,
      });
      onOpenChange(false);
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: `crews/${crew.id}`,
        operation: "delete",
      });
      errorEmitter.emit("permission-error", permissionError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            crew <span className="font-semibold">"{crew.name}"</span>. It
            won't affect any already-recorded time entries.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
