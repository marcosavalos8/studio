'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface AuthContextType {
  isAuthenticated: boolean
  username: string | null
  userRole: string | null
  isAdmin: boolean
  login: (username: string, role?: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check if user is authenticated on mount
    const auth = localStorage.getItem('isAuthenticated')
    const savedUsername = localStorage.getItem('username')
    const savedRole = localStorage.getItem('userRole')
    
    if (auth === 'true' && savedUsername) {
      setIsAuthenticated(true)
      setUsername(savedUsername)
      setUserRole(savedRole || 'User')
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

  const login = (username: string, role?: string) => {
    setIsAuthenticated(true)
    setUsername(username)
    setUserRole(role || 'User')
  }

  const logout = () => {
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('username')
    localStorage.removeItem('userRole')
    setIsAuthenticated(false)
    setUsername(null)
    setUserRole(null)
    router.push('/login')
  }

  const isAdmin = userRole === 'Admin'

  if (loading) {
    return null
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, userRole, isAdmin, login, logout }}>
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
