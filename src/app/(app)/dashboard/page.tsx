'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Users,
  Briefcase,
  ClipboardList,
} from "lucide-react"
import { OverviewChart } from "./overview-chart"
import { WeatherWidget } from "./weather-widget"
import { LiveActivity } from "./live-activity"
import { useDashboardData } from "@/hooks/use-dashboard-data"


export default function DashboardPage() {
  const { totalEmployees, employeeGrowth, activeClients, activeTasks, isLoading } = useDashboardData()

  return (
    <div className="grid gap-3 md:gap-6 lg:gap-8">
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {employeeGrowth > 0 ? `+${employeeGrowth}` : employeeGrowth === 0 ? 'No change' : employeeGrowth} since last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : activeClients}</div>
            <p className="text-xs text-muted-foreground">
              {activeClients === 0 ? 'No active clients' : activeClients === 1 ? 'Client has active tasks' : 'All clients have active tasks'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '...' : activeTasks}</div>
            <p className="text-xs text-muted-foreground">
              {activeTasks === 0 ? 'No active tasks' : activeClients > 1 ? 'Across all clients' : 'For current client'}
            </p>
          </CardContent>
        </Card>
        <WeatherWidget />
      </div>

      <div className="grid gap-3 md:gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-7">
        <div className="lg:col-span-4">
            <OverviewChart />
        </div>
        <div className="lg:col-span-3">
            <LiveActivity />
        </div>
      </div>
    </div>
  )
}
