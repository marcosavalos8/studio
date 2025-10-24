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
import type { Client, Task } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const taskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  variety: z.string().optional(),
  ranch: z.string().optional(),
  block: z.string().optional(),
  clientId: z.string().min(1, 'Client is required'),
  clientRate: z.coerce.number().min(0, 'Rate must be positive'),
  clientRateType: z.enum(['hourly', 'piece']),
  piecePrice: z.coerce.number().optional(),
  status: z.enum(['Active', 'Inactive', 'Completed']),
}).superRefine((data, ctx) => {
  // If rate type is piece, piecePrice must be provided and greater than 0
  if (data.clientRateType === 'piece') {
    if (!data.piecePrice || data.piecePrice <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Piece price must be greater than 0 for piecework tasks",
        path: ["piecePrice"],
      });
    }
  }
})

type EditTaskDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  task: Task
  clients: Client[]
}

export function EditTaskDialog({ isOpen, onOpenChange, task, clients }: EditTaskDialogProps) {
  const firestore = useFirestore()
  const { toast } = useToast()
  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: task.name,
      variety: task.variety || '',
      ranch: task.ranch || '',
      block: task.block || '',
      clientId: task.clientId,
      clientRate: task.clientRate || 10,
      clientRateType: task.clientRateType,
      piecePrice: task.piecePrice || undefined,
      status: task.status,
    },
  })

  useEffect(() => {
    if (task) {
      form.reset({
        name: task.name,
        variety: task.variety || '',
        ranch: task.ranch || '',
        block: task.block || '',
        clientId: task.clientId,
        clientRate: task.clientRate || 10,
        clientRateType: task.clientRateType,
        piecePrice: task.piecePrice || undefined,
        status: task.status,
      })
    }
  }, [task, form])

  const { isSubmitting } = form.formState
  const rateType = form.watch('clientRateType')

  const onSubmit = async (values: z.infer<typeof taskSchema>) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available.',
      })
      return
    }

    try {
      const taskRef = doc(firestore, 'tasks', task.id)
      
      // Build the task update object based on rate type
      const updateData: Partial<Task> = {
        name: values.name,
        variety: values.variety || '',
        ranch: values.ranch || '',
        block: values.block || '',
        clientId: values.clientId,
        clientRateType: values.clientRateType,
        status: values.status,
        clientRate: values.clientRateType === 'hourly' ? values.clientRate : 0,
        piecePrice: values.clientRateType === 'piece' ? values.piecePrice : undefined,
      };

      await updateDoc(taskRef, updateData);
      
      toast({
        title: 'Task Updated',
        description: `${values.name} has been updated successfully.`,
      })
      onOpenChange(false)
    } catch (serverError) {
      const taskRef = doc(firestore, 'tasks', task.id)
      const permissionError = new FirestorePermissionError({
        path: taskRef.path,
        operation: 'update',
        requestResourceData: values,
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the details for the task or project.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-4">
        <Form {...form}>
          <form id="edit-task-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Apple Picking" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="variety"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variety</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Gala" {...field} />
                  </FormControl>
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
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ranch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ranch</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., North Ridge" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="block"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Block</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., A-15" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientRateType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rate type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="piece">Piecework</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {rateType === 'piece' ? (
              <FormField
                control={form.control}
                name="piecePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Piece Price ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="10" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Price per piece paid to employees
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="clientRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="10" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Hourly rate for this task
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-task-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
