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
import { collection, doc, setDoc, addDoc, query, where, getDocs } from 'firebase/firestore'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

const userSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  role: z.enum(['Admin', 'User']),
  status: z.enum(['Active', 'Inactive']),
  email: z.string().optional(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'Admin') {
    if (!data.email || !data.email.includes('@')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email address', path: ['email'] })
    }
    if (!data.password || data.password.length < 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password must be at least 6 characters', path: ['password'] })
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords don't match", path: ['confirmPassword'] })
    }
  } else {
    if (!data.password || data.password.length < 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password must be at least 6 characters', path: ['password'] })
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords don't match", path: ['confirmPassword'] })
    }
  }
})

type AddUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      fullName: '',
      username: '',
      role: 'User',
      status: 'Active',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const selectedRole = form.watch('role')

  const onSubmit = async (values: z.infer<typeof userSchema>) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available. Please try again later.',
      })
      return
    }

    setIsCreating(true)

    try {
      // Check if username already exists
      const usernameQuery = query(collection(firestore, 'users'), where('username', '==', values.username))
      const existingUsernameUsers = await getDocs(usernameQuery)
      if (!existingUsernameUsers.empty) {
        toast({ variant: 'destructive', title: 'Error', description: 'A user with this username already exists.' })
        setIsCreating(false)
        return
      }

      if (values.role === 'Admin') {
        // Check if email already exists
        const emailQuery = query(collection(firestore, 'users'), where('email', '==', values.email))
        const existingEmailUsers = await getDocs(emailQuery)
        if (!existingEmailUsers.empty) {
          toast({ variant: 'destructive', title: 'Error', description: 'A user with this email already exists.' })
          setIsCreating(false)
          return
        }

        // Create in Firebase Auth via API
        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            displayName: values.fullName,
            role: values.role,
            status: values.status,
          }),
        })

        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Failed to create user')
        }

        // Store in Firestore with Auth UID
        const userDocRef = doc(firestore, 'users', result.uid)
        await setDoc(userDocRef, {
          email: values.email,
          username: values.username,
          fullName: values.fullName,
          displayName: values.fullName,
          role: values.role,
          status: values.status,
          noAuth: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      } else {
        // User role: store only in Firestore with hashed password
        const passwordHash = await hashPassword(values.password ?? '')

        await addDoc(collection(firestore, 'users'), {
          username: values.username,
          fullName: values.fullName,
          displayName: values.fullName,
          role: 'User',
          status: values.status,
          noAuth: true,
          passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      toast({
        title: 'User Created',
        description: `${values.fullName} has been added successfully.`,
      })

      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create user:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create user. Please try again.',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account for the application
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      <SelectItem value="User">User</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="johndoe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedRole === 'Admin' && (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••" {...field} />
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
                        <SelectValue placeholder="Select status" />
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
