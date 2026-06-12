'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useFirestore } from '@/firebase'
import { collection, doc, setDoc, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import type { Employee } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { addOfflineIndicator } from '@/lib/offline-utils'

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['Worker', 'Supervisor']),
  status: z.enum(['Active', 'Inactive']),
})

type AddEmployeeDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function AddEmployeeDialog({ isOpen, onOpenChange }: AddEmployeeDialogProps) {
  const firestore = useFirestore()
  const { toast } = useToast()
  const { isOnline } = useNetworkStatus()
  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: '',
      role: 'Worker',
      status: 'Active',
    },
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: z.infer<typeof employeeSchema>) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available. Please try again later.',
      })
      return
    }

    const newDocRef = doc(collection(firestore, 'employees'))
    const newEmployee: Omit<Employee, 'id'> = {
      ...values,
      qrCode: newDocRef.id,
    }

    // When offline, close dialog immediately to simulate normal flow
    // Firestore persistence will queue the operation for sync
    if (!isOnline) {
      // Queue the operation with Firestore (don't await to avoid delays)
      setDoc(newDocRef, newEmployee).catch((error) => {
        console.error("Failed to queue offline operation:", error);
      });
      
      toast({
        title: 'Employee Added',
        description: addOfflineIndicator(
          `${values.name} has been added successfully.`,
          isOnline
        ),
      })
      form.reset()
      onOpenChange(false)
      return
    }

    // Online flow - check for duplicates and wait for operation to complete
    try {
      // Case-insensitive duplicate name check (fetch all, compare normalized)
      const employeesRef = collection(firestore, 'employees');
      const allEmployeesSnap = await getDocs(employeesRef);
      const normalizedInput = values.name.trim().toLowerCase();
      const duplicate = allEmployeesSnap.docs.find(
        d => (d.data().name as string)?.trim().toLowerCase() === normalizedInput
      );
      if (duplicate) {
        toast({
          variant: 'destructive',
          title: 'Duplicate Employee',
          description: `An employee named "${values.name}" already exists (status: ${duplicate.data().status ?? 'unknown'}).`,
        });
        return;
      }

      // Generate unique employeeNumber: YYYY + 6-digit consecutive per year
      const currentYear = new Date().getFullYear();
      const yearPrefix = String(currentYear);
      let maxConsecutive = 0;
      allEmployeesSnap.docs.forEach(d => {
        const num: string = d.data().employeeNumber ?? '';
        if (num.startsWith(yearPrefix) && num.length === 10) {
          const consecutive = parseInt(num.slice(4), 10);
          if (!isNaN(consecutive) && consecutive > maxConsecutive) {
            maxConsecutive = consecutive;
          }
        }
      });
      const employeeNumber = `${yearPrefix}${String(maxConsecutive + 1).padStart(6, '0')}`;
      const now = Timestamp.now();

      const newEmployeeWithNumber: Omit<Employee, 'id'> = {
        ...newEmployee,
        employeeNumber,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(newDocRef, newEmployeeWithNumber);
      
      toast({
        title: 'Employee Added',
        description: addOfflineIndicator(
          `${values.name} has been added successfully.`,
          isOnline
        ),
      })
      form.reset()
      onOpenChange(false)
    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
        path: newDocRef.path,
        operation: 'create',
        requestResourceData: values,
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Enter the details for the new employee. A unique QR code will be generated automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Maria Garcia" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Worker">Worker</SelectItem>
                      <SelectItem value="Supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Employee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
