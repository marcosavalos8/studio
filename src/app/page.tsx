'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()
  
  useEffect(() => {
    try {
      const isAuthenticated = localStorage.getItem('isAuthenticated')
      if (isAuthenticated === 'true') {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    } catch (error) {
      // If localStorage is not available (e.g., in some offline scenarios),
      // default to login page
      console.error('Error accessing localStorage:', error)
      router.push('/login')
    }
  }, [router])
  
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  )
}
