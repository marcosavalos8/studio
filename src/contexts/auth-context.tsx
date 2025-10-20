'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface AuthContextType {
  isAuthenticated: boolean
  username: string | null
  login: (username: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check if user is authenticated on mount
    const auth = localStorage.getItem('isAuthenticated')
    const savedUsername = localStorage.getItem('username')
    
    if (auth === 'true' && savedUsername) {
      setIsAuthenticated(true)
      setUsername(savedUsername)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Redirect to login if not authenticated and not already on login page
    if (!loading && !isAuthenticated && pathname !== '/login') {
      router.push('/login')
    }
    // Redirect to dashboard if authenticated and on login page
    if (!loading && isAuthenticated && pathname === '/login') {
      router.push('/dashboard')
    }
  }, [isAuthenticated, loading, pathname, router])

  const login = (username: string) => {
    setIsAuthenticated(true)
    setUsername(username)
  }

  const logout = () => {
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('username')
    setIsAuthenticated(false)
    setUsername(null)
    router.push('/login')
  }

  if (loading) {
    return null
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
