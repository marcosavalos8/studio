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
import { doc, updateDoc } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import type { Employee } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['Worker', 'Supervisor']),
  status: z.enum(['Active', 'Inactive']),
})

type EditEmployeeDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  employee: Employee
}

export function EditEmployeeDialog({ isOpen, onOpenChange, employee }: EditEmployeeDialogProps) {
  const firestore = useFirestore()
  const { toast } = useToast()
  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: employee.name,
      role: employee.role,
      status: employee.status,
    },
  })

  useEffect(() => {
    if (employee) {
      form.reset({
        name: employee.name,
        role: employee.role,
        status: employee.status,
      })
    }
  }, [employee, form])

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

    try {
      const employeeRef = doc(firestore, 'employees', employee.id)
      const updatedData = { ...values }

      await updateDoc(employeeRef, updatedData);
      
      toast({
        title: 'Employee Updated',
        description: `${values.name} has been updated successfully.`,
      })
      onOpenChange(false)
    } catch (serverError) {
      const employeeRef = doc(firestore, 'employees', employee.id)
      const permissionError = new FirestorePermissionError({
        path: employeeRef.path,
        operation: 'update',
        requestResourceData: values,
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>
            Update the details for the employee.
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
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
