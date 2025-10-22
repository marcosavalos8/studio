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

import { apiClient } from '@/lib/api/client'
import { useToast } from '@/hooks/use-toast'
import type { Client } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'



const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  billingAddress: z.string().min(1, 'Billing address is required'),
  paymentTerms: z.string().min(1, 'Payment terms are required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  commissionRate: z.coerce.number().min(0, 'Commission must be a positive number.').optional(),
  minimumWage: z.coerce.number().min(0, 'Minimum wage must be a positive number.').optional(),
  contractType: z.enum(['Standard', 'H2A']).optional(),
})

type EditClientDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  client: Client
}

export function EditClientDialog({ isOpen, onOpenChange, client }: EditClientDialogProps) {
  const { toast } = useToast()
  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      ...client,
      commissionRate: client.commissionRate || 0,
      minimumWage: client.minimumWage || 16.28,
      contractType: client.contractType || 'Standard',
    },
  })

  useEffect(() => {
    if (client) {
      form.reset({
        ...client,
        commissionRate: client.commissionRate || 0,
        minimumWage: client.minimumWage || 16.28,
        contractType: client.contractType || 'Standard',
      })
    }
  }, [client, form])

  const { isSubmitting } = form.formState

  const onSubmit = async (values: z.infer<typeof clientSchema>) => {
    try {
      const updatedData = { ...values, email: values.email || '' };
      
      await apiClient.update(`/api/clients/${client.id}`, updatedData);
      
      toast({
        title: 'Client Updated',
        description: `${values.name} has been updated successfully.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update client. Please try again.',
      });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update the details for the client.
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
            <FormField
                control={form.control}
                name="contractType"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Contract Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select contract type" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="H2A">H2A</SelectItem>
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
              control={form.control}
              name="minimumWage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applicable Minimum Wage ($/hr)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="e.g., 17.50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="commissionRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission Rate (%)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 5" {...field} />
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
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
