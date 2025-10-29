'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Sun, Cloud, CloudRain, CloudSnow, Loader2 } from "lucide-react"

interface WeatherData {
  temperature: number
  weatherCode: number
  description: string
}

export function WeatherWidget() {
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Get user's location
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
        (error: GeolocationPositionError) => {
          // Default to Yakima, WA coordinates
          setLocation({
            latitude: 46.6021,
            longitude: -120.5059,
          })
          console.error("Geolocation error:", error)
        }
      )
    } else {
      // Default to Yakima, WA coordinates
      setLocation({
        latitude: 46.6021,
        longitude: -120.5059,
      })
    }
  }, [])

  // Fetch weather data when location is available
  useEffect(() => {
    if (!location) return

    const fetchWeather = async () => {
      setIsLoading(true)
      try {
        // Using Open-Meteo API (free, no API key required)
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch weather data')
        }

        const data = await response.json()
        
        // Map weather codes to descriptions
        // https://open-meteo.com/en/docs
        const weatherCode = data.current.weather_code
        let description = 'Clear'
        
        if (weatherCode === 0) description = 'Clear'
        else if (weatherCode <= 3) description = 'Partly Cloudy'
        else if (weatherCode <= 48) description = 'Foggy'
        else if (weatherCode <= 67) description = 'Rainy'
        else if (weatherCode <= 77) description = 'Snowy'
        else if (weatherCode <= 82) description = 'Rainy'
        else if (weatherCode <= 86) description = 'Snowy'
        else description = 'Stormy'

        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          weatherCode: weatherCode,
          description: description,
        })
        setError(null)
      } catch (err) {
        console.error('Error fetching weather:', err)
        setError('Unable to fetch weather')
        // Fallback data
        setWeather({
          temperature: 75,
          weatherCode: 0,
          description: 'Clear',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchWeather()
  }, [location])

  // Choose icon based on weather code
  const getWeatherIcon = () => {
    if (!weather) return <Sun className="h-4 w-4 text-muted-foreground" />
    
    const code = weather.weatherCode
    if (code === 0 || code === 1) return <Sun className="h-4 w-4 text-yellow-500" />
    if (code <= 3) return <Cloud className="h-4 w-4 text-gray-400" />
    if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain className="h-4 w-4 text-blue-500" />
    if (code <= 77 || (code >= 85 && code <= 86)) return <CloudSnow className="h-4 w-4 text-blue-300" />
    return <Cloud className="h-4 w-4 text-gray-400" />
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Weather</CardTitle>
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        ) : (
          getWeatherIcon()
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? '...' : weather ? `${weather.temperature}°F` : '75°F'}
        </div>
        <p className="text-xs text-muted-foreground">
          {isLoading ? 'Loading weather...' : weather ? `${weather.description} at your location` : error || 'Weather unavailable'}
        </p>
      </CardContent>
    </Card>
  )
}
