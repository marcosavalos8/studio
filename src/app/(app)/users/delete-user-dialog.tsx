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
      // Delete user document from Firestore
      const userDocRef = doc(firestore, 'users', user.id)
      await deleteDoc(userDocRef)

      // Note: Firebase Auth user deletion requires admin SDK on server
      // For now, we only delete the Firestore record
      // The user won't be able to login if their status is set to Inactive

      toast({
        title: 'User Deleted',
        description: `${user.displayName} has been removed from the system.`,
      })
      
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to delete user:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete user. Please try again.',
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
            This will permanently delete <strong>{user.displayName}</strong> ({user.email}) from the system. 
            This action cannot be undone.
            <br/><br/>
            <strong>Note:</strong> This only removes the user from the management system. 
            If the user was created with Firebase Authentication, their authentication account will remain active. 
            For complete removal, use Firebase Console or implement Firebase Admin SDK on the server.
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
