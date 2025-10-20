'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Search,
  Bell,
  LogOut,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PlaceHolderImages } from '@/lib/placeholder-images'
import { useAuth } from '@/contexts/auth-context'

const pageTitles: { [key: string]: string } = {
  '/dashboard': 'Dashboard',
  '/time-tracking': 'Time Tracking',
  '/employees': 'Employees',
  '/clients': 'Clients',
  '/tasks': 'Tasks & Projects',
  '/payroll': 'Payroll',
  '/invoicing': 'Invoicing',
}

export function AppHeader() {
  const pathname = usePathname()
  const { logout, username } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const userAvatar = PlaceHolderImages.find(img => img.id === 'user-avatar');

  const getTitle = () => {
    for (const path in pageTitles) {
      if (pathname.startsWith(path)) {
        return pageTitles[path];
      }
    }
    return 'Dashboard';
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Simple search functionality - you can enhance this
      const searchText = searchQuery.toLowerCase()
      const pageElement = document.querySelector('main') || document.body
      const walker = document.createTreeWalker(
        pageElement,
        NodeFilter.SHOW_TEXT,
        null
      )
      
      let node
      let found = false
      while ((node = walker.nextNode())) {
        const text = node.textContent?.toLowerCase() || ''
        if (text.includes(searchText)) {
          const element = node.parentElement
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.style.backgroundColor = 'rgba(251, 146, 60, 0.2)'
            setTimeout(() => {
              element.style.backgroundColor = ''
            }, 2000)
            found = true
            break
          }
        }
      }
      
      if (!found) {
        alert(`No results found for "${searchQuery}"`)
      }
    }
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <header className="flex h-16 items-center gap-2 md:gap-4 border-b bg-card px-3 md:px-6">
      <SidebarTrigger className="md:hidden" />

      <div className="flex-1 min-w-0">
        <h1 className="text-base md:text-lg font-semibold truncate">{getTitle()}</h1>
      </div>

      <div className="flex flex-1 items-center gap-2 md:gap-4 md:ml-auto lg:gap-4">
        <form onSubmit={handleSearch} className="ml-auto flex-1 sm:flex-initial">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-full sm:w-[200px] md:w-[200px] lg:w-[300px] bg-background"
            />
          </div>
        </form>
        <Button variant="ghost" size="icon" className="rounded-full hidden sm:flex">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt="User avatar" />}
                <AvatarFallback>{username?.substring(0, 2).toUpperCase() || 'JD'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{username || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {username?.toLowerCase()}@fieldtack.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
