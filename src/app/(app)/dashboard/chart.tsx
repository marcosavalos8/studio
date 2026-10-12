'use client'

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { useWorkActivityData } from "@/hooks/use-dashboard-data"
import { addMonths, subMonths, startOfMonth, isSameMonth } from "date-fns"

const chartConfig = {
  hours: {
    label: "Hours Worked",
    color: "hsl(var(--primary))",
  },
  pieces: {
    label: "Pieces Collected",
    color: "hsl(var(--accent))",
  },
  employees: {
    label: "Active Workers",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export function Chart() {
    // The current (real) month, kept stable so the "jump to current" state
    // and the "disable Next past today" guard don't drift mid-session.
    const [thisMonth] = useState(() => startOfMonth(new Date()))
    const [anchorMonth, setAnchorMonth] = useState(thisMonth)
    const { chartData, isLoading } = useWorkActivityData(anchorMonth)

    const isCurrent = isSameMonth(anchorMonth, thisMonth)
    const rangeLabel = chartData.length > 0
      ? `${chartData[0].month} – ${chartData[chartData.length - 1].month}`
      : ""

    return (
        <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Work Activity Overview</CardTitle>
              <CardDescription>
                Total hours worked, pieces collected, and number of active workers over a 6-month window.
                {rangeLabel && ` Showing ${rangeLabel}.`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setAnchorMonth((m) => subMonths(m, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={isCurrent}
                onClick={() => setAnchorMonth(thisMonth)}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={isCurrent}
                onClick={() => setAnchorMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">Loading chart data...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">No activity data available</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="min-h-[200px] h-full w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  stroke="#888888"
                  fontSize={12}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Legend />
                <Bar dataKey="hours" fill="var(--color-hours)" radius={4} />
                <Bar dataKey="pieces" fill="var(--color-pieces)" radius={4} />
                <Bar dataKey="employees" fill="var(--color-employees)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    )
}
