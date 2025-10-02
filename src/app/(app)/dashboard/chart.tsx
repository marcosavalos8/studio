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

const chartData = [
  { month: "January", hours: 186, pieces: 400 },
  { month: "February", hours: 305, pieces: 550 },
  { month: "March", hours: 237, pieces: 600 },
  { month: "April", hours: 273, pieces: 720 },
  { month: "May", hours: 209, pieces: 480 },
  { month: "June", hours: 214, pieces: 510 },
]

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
    return (
        <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Work Activity Overview</CardTitle>
          <CardDescription>
            Comparison of hours logged vs. pieces recorded over the last 6 months.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
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
        </CardContent>
      </Card>
    )
}
