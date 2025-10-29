'use client'

import { useMemo, useEffect, useState } from 'react'
import { useFirestore } from '@/firebase'
import { useCollection } from '@/firebase/firestore/use-collection'
import {
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import type { Employee, Client, Task, TimeEntry, Piecework } from '@/lib/types'
import { startOfMonth, subMonths, endOfMonth, startOfDay, endOfDay } from 'date-fns'

export function useDashboardData() {
  const firestore = useFirestore()
  const [stats, setStats] = useState({
    totalEmployees: 0,
    employeeGrowth: 0,
    activeClients: 0,
    activeTasks: 0,
    isLoading: true,
  })

  // Fetch all employees
  const employeesQuery = useMemo(() => {
    if (!firestore) return null
    return collection(firestore, 'employees')
  }, [firestore])
  const { data: employees, isLoading: loadingEmployees } = useCollection<Employee>(employeesQuery)

  // Fetch all clients
  const clientsQuery = useMemo(() => {
    if (!firestore) return null
    return collection(firestore, 'clients')
  }, [firestore])
  const { data: clients, isLoading: loadingClients } = useCollection<Client>(clientsQuery)

  // Fetch all tasks
  const tasksQuery = useMemo(() => {
    if (!firestore) return null
    return collection(firestore, 'tasks')
  }, [firestore])
  const { data: tasks, isLoading: loadingTasks } = useCollection<Task>(tasksQuery)

  useEffect(() => {
    if (loadingEmployees || loadingClients || loadingTasks) {
      return
    }

    // Calculate total employees (only active ones)
    const activeEmployees = employees?.filter(emp => emp.status === 'Active') || []
    const totalEmployees = activeEmployees.length

    // Calculate employee growth - for now set to 0 since we don't have historical data
    // In a real scenario, you'd query employees created in the last month
    const employeeGrowth = 0

    // Calculate active clients (those with active tasks)
    const activeTasksList = tasks?.filter(task => task.status === 'Active') || []
    const clientIdsWithActiveTasks = new Set(activeTasksList.map(task => task.clientId))
    const activeClients = clientIdsWithActiveTasks.size

    // Calculate active tasks
    const activeTasks = activeTasksList.length

    setStats({
      totalEmployees,
      employeeGrowth,
      activeClients,
      activeTasks,
      isLoading: false,
    })
  }, [employees, clients, tasks, loadingEmployees, loadingClients, loadingTasks])

  return stats
}

interface MonthlyData {
  month: string
  hours: number
  pieces: number
  employees: number
}

export function useWorkActivityData() {
  const firestore = useFirestore()
  const [chartData, setChartData] = useState<MonthlyData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch time entries from last 6 months
  const timeEntriesQuery = useMemo(() => {
    if (!firestore) return null
    const sixMonthsAgo = subMonths(new Date(), 6)
    return query(
      collection(firestore, 'time_entries'),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay(sixMonthsAgo)))
    )
  }, [firestore])
  const { data: timeEntries, isLoading: loadingTimeEntries } = useCollection<TimeEntry>(timeEntriesQuery)

  // Fetch piecework from last 6 months
  const pieceworkQuery = useMemo(() => {
    if (!firestore) return null
    const sixMonthsAgo = subMonths(new Date(), 6)
    return query(
      collection(firestore, 'piecework'),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay(sixMonthsAgo)))
    )
  }, [firestore])
  const { data: piecework, isLoading: loadingPiecework } = useCollection<Piecework>(pieceworkQuery)

  useEffect(() => {
    if (loadingTimeEntries || loadingPiecework || !firestore) {
      return
    }

    setIsLoading(true)

    // Group data by month
    const monthlyStats: Record<string, { hours: number; pieces: number; employees: Set<string> }> = {}

    // Initialize last 6 months
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i)
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
      const monthName = monthNames[monthDate.getMonth()]
      monthlyStats[monthKey] = { hours: 0, pieces: 0, employees: new Set<string>() }
    }

    // Calculate hours from time entries and track active employees
    if (timeEntries) {
      timeEntries.forEach(entry => {
        const timestamp = (entry.timestamp as unknown as Timestamp).toDate()
        const monthKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`
        
        if (monthlyStats[monthKey]) {
          // Track unique employees who worked this month
          monthlyStats[monthKey].employees.add(entry.employeeId)
          
          // Only count hours for completed work periods (not breaks)
          if (entry.endTime && !entry.isBreak) {
            const endTime = (entry.endTime as unknown as Timestamp).toDate()
            const hours = (endTime.getTime() - timestamp.getTime()) / (1000 * 60 * 60)
            monthlyStats[monthKey].hours += hours
          }
        }
      })
    }

    // Calculate pieces from piecework
    if (piecework) {
      piecework.forEach(piece => {
        const timestamp = (piece.timestamp as unknown as Timestamp).toDate()
        const monthKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`
        
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].pieces += piece.pieceCount
          // Track employee from piecework too
          monthlyStats[monthKey].employees.add(piece.employeeId)
        }
      })
    }

    // Also get pieces from time entries that have piecesWorked
    if (timeEntries) {
      timeEntries.forEach(entry => {
        if (entry.piecesWorked && entry.piecesWorked > 0) {
          const timestamp = (entry.timestamp as unknown as Timestamp).toDate()
          const monthKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`
          
          if (monthlyStats[monthKey]) {
            monthlyStats[monthKey].pieces += entry.piecesWorked
          }
        }
      })
    }

    // Convert to array format for chart
    const chartDataArray: MonthlyData[] = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i)
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
      const monthName = monthNames[monthDate.getMonth()]
      
      chartDataArray.push({
        month: monthName,
        hours: Math.round(monthlyStats[monthKey].hours),
        pieces: monthlyStats[monthKey].pieces,
        employees: monthlyStats[monthKey].employees.size,
      })
    }

    setChartData(chartDataArray)
    setIsLoading(false)
  }, [timeEntries, piecework, firestore, loadingTimeEntries, loadingPiecework])

  return { chartData, isLoading }
}
