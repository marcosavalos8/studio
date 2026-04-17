'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useFirestore } from '@/firebase'
import { doc, deleteDoc } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AppUser } from './page'

type DeleteUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AppUser
}

export function DeleteUserDialog({ open, onOpenChange, user }: DeleteUserDialogProps) {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available. Please try again later.',
      })
      return
    }

    setIsDeleting(true)

    try {
      // 1. Delete from Firebase Authentication via server-side API (best-effort)
      const authRes = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.id }),
      })

      const authData = await authRes.json().catch(() => ({})) as {
        success?: boolean;
        error?: string;
        adminUnavailable?: boolean;
      };

      if (!authRes.ok) {
        throw new Error(authData.error ?? 'Failed to delete user from Firebase Auth')
      }

      // 2. Delete user document from Firestore
      const userDocRef = doc(firestore, 'users', user.id)
      await deleteDoc(userDocRef)

      if (authData.adminUnavailable) {
        toast({
          title: 'User Deleted',
          description: `${user.displayName} was removed from the system. Note: the Firebase Authentication account may need to be deleted manually from the Firebase Console.`,
        })
      } else {
        toast({
          title: 'User Deleted',
          description: `${user.displayName} has been completely removed from the system.`,
        })
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user. Please try again.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{user.displayName}</strong> ({user.email}) from both
            the management system and Firebase Authentication. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
