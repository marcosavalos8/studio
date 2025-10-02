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
import type { Employee } from '@/lib/types'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

type DeleteEmployeeDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  employee: Employee
}

export function DeleteEmployeeDialog({ isOpen, onOpenChange, employee }: DeleteEmployeeDialogProps) {
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
    const employeeRef = doc(firestore, 'employees', employee.id)

    deleteDoc(employeeRef)
      .then(() => {
        toast({
          title: 'Employee Deleted',
          description: `${employee.name} has been deleted successfully.`,
        })
        onOpenChange(false)
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: employeeRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsDeleting(false)
      })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the employee record for{' '}
            <span className="font-semibold">{employee.name}</span>.
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
