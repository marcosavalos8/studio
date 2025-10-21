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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useFirestore } from '@/firebase'
import { addDoc, collection } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import type { Client, Task } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const taskSchema = z.object({
  name: z.string().min(1, 'Task name is required'),
  variety: z.string().optional(),
  ranch: z.string().optional(),
  block: z.string().optional(),
  clientId: z.string().min(1, 'Client is required'),
  clientRate: z.coerce.number().positive('Client rate must be greater than 0'),
  clientRateType: z.enum(['hourly', 'piece']),
  employeePayType: z.enum(['hourly', 'piecework']),
  employeeRate: z.coerce.number().positive('Employee rate must be greater than 0'),
  status: z.enum(['Active', 'Inactive', 'Completed']),
})

type AddTaskDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  clients: Client[]
}

export function AddTaskDialog({ isOpen, onOpenChange, clients }: AddTaskDialogProps) {
  const firestore = useFirestore()
  const { toast } = useToast()
  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      variety: '',
      ranch: '',
      block: '',
      clientId: '',
      clientRate: undefined,
      clientRateType: 'hourly',
      employeePayType: 'hourly',
      employeeRate: undefined,
      status: 'Active',
    },
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: z.infer<typeof taskSchema>) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available.',
      })
      return
    }

    const newTask: Omit<Task, 'id'> = { ...values };
    const tasksCollection = collection(firestore, 'tasks');

    addDoc(tasksCollection, newTask)
      .then(() => {
        toast({
          title: 'Task Added',
          description: `${values.name} has been added successfully.`,
        })
        form.reset()
        onOpenChange(false)
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: tasksCollection.path,
          operation: 'create',
          requestResourceData: newTask,
        });

        errorEmitter.emit('permission-error', permissionError);
      })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Enter the details for the new work task or project.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            <div className="space-y-2 p-3 border rounded-md">
                <FormLabel>Client Billing</FormLabel>
                <FormField
                  control={form.control}
                  name="clientRateType"
                  render={({ field }) => (
                    <FormItem>
                       <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                          <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                  <RadioGroupItem value="hourly" id="client-hourly" />
                              </FormControl>
                              <FormLabel htmlFor="client-hourly" className="font-normal">Hourly</FormLabel>
                          </FormItem>
                           <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                  <RadioGroupItem value="piece" id="client-piece" />
                              </FormControl>
                              <FormLabel htmlFor="client-piece" className="font-normal">Piece</FormLabel>
                          </FormItem>
                       </RadioGroup>
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="clientRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Rate ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

             <div className="space-y-2 p-3 border rounded-md">
                <FormLabel>Employee Payment</FormLabel>
                <FormField
                  control={form.control}
                  name="employeePayType"
                  render={({ field }) => (
                    <FormItem>
                       <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                          <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                  <RadioGroupItem value="hourly" id="emp-hourly" />
                              </FormControl>
                              <FormLabel htmlFor="emp-hourly" className="font-normal">Hourly</FormLabel>
                          </FormItem>
                           <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                  <RadioGroupItem value="piecework" id="emp-piece" />
                              </FormControl>
                              <FormLabel htmlFor="emp-piece" className="font-normal">Piecework</FormLabel>
                          </FormItem>
                       </RadioGroup>
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="employeeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Rate ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
            <DialogFooter className="col-span-1 md:col-span-2 mt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Task
              </Button>
            </DialogFooter>
          </form>
        </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
