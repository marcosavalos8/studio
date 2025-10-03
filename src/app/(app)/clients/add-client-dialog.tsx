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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useFirestore } from '@/firebase'
import { addDoc, collection } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  billingAddress: z.string().min(1, 'Billing address is required'),
  paymentTerms: z.string().min(1, 'Payment terms are required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
})

type AddClientDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

export function AddClientDialog({ isOpen, onOpenChange }: AddClientDialogProps) {
  const firestore = useFirestore()
  const { toast } = useToast()
  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      billingAddress: '',
      paymentTerms: 'Net 30',
      email: '',
    },
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: z.infer<typeof clientSchema>) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available. Please try again later.',
      })
      return
    }

    const newClient = { ...values }
    const clientsCollection = collection(firestore, 'clients');

    addDoc(clientsCollection, newClient)
      .then((docRef) => {
        toast({
          title: 'Client Added',
          description: `${values.name} has been added successfully.`,
        })
        form.reset()
        onOpenChange(false)
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: clientsCollection.path,
          operation: 'create',
          requestResourceData: newClient,
        });

        errorEmitter.emit('permission-error', permissionError);
      })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Enter the details for the new client.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Green Valley Farms" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., accounting@gvfarms.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billingAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Address</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 123 Farm Rd, Yakima, WA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Net 30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Client
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
