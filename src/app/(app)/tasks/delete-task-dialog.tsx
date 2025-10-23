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
import { Button } from '@/components/ui/button'
import { useFirestore } from '@/firebase'
import { doc, deleteDoc } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import type { Task } from '@/lib/types'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

type DeleteTaskDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  task: Task
}

export function DeleteTaskDialog({ isOpen, onOpenChange, task }: DeleteTaskDialogProps) {
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
      const taskRef = doc(firestore, 'tasks', task.id)
      await deleteDoc(taskRef);
      
      toast({
        title: 'Task Deleted',
        description: `${task.name} has been deleted successfully.`,
      })
      onOpenChange(false)
    } catch (serverError) {
      const taskRef = doc(firestore, 'tasks', task.id)
      const permissionError = new FirestorePermissionError({
        path: taskRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the task record for{' '}
            <span className="font-semibold">{task.name}</span>.
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
  )
}
