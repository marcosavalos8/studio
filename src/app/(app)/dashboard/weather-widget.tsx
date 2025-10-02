'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Sun } from "lucide-react"

export function WeatherWidget() {
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
          setError(null)
        },
        (error) => {
          setError("Location access denied. Showing default weather for Yakima, WA.")
          console.error("Geolocation error:", error)
        }
      )
    } else {
      setError("Geolocation is not supported by this browser.")
    }
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Weather</CardTitle>
        <Sun className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">75°F</div>
        <p className="text-xs text-muted-foreground">
          {error ? error : location ? `Sunny at your location` : 'Fetching location...'}
          {!error && !location && ' (Showing default for Yakima, WA)'}
        </p>
      </CardContent>
    </Card>
  )
}
