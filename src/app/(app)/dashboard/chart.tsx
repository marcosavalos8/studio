'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { useWorkActivityData } from "@/hooks/use-dashboard-data"

const chartConfig = {
  hours: {
    label: "Hours Logged",
    color: "hsl(var(--primary))",
  },
  pieces: {
    label: "Pieces Recorded",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig

export function Chart() {
    const { chartData, isLoading } = useWorkActivityData()

    return (
        <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Work Activity Overview</CardTitle>
          <CardDescription>
            Comparison of hours logged vs. pieces recorded over the last 6 months.
          </CardDescription>
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
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    )
}
