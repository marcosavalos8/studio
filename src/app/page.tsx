'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RootPage() {
  const router = useRouter()
  
  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated')
    if (isAuthenticated === 'true') {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])
  
  return null
}
