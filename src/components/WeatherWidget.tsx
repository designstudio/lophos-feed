'use client'
import { useState, useEffect } from 'react'
import { Cloud, Sun, CloudRain, CloudSnow, Wind } from 'lucide-react'

interface WeatherData {
  city: string
  temp: number
  condition: string
  high: number
  low: number
  forecast: { day: string; temp: number; icon: string }[]
}

function WeatherIcon({ condition, size = 16 }: { condition: string; size?: number }) {
  const c = condition.toLowerCase()
  if (c.includes('rain') || c.includes('chuva')) return <CloudRain size={size} className="text-blue-400" />
  if (c.includes('snow') || c.includes('neve')) return <CloudSnow size={size} className="text-blue-200" />
  if (c.includes('cloud') || c.includes('nublado') || c.includes('parcialmente')) return <Cloud size={size} className="text-gray-400" />
  if (c.includes('wind') || c.includes('vento')) return <Wind size={size} className="text-gray-400" />
  return <Sun size={size} className="text-amber-400" />
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      fetchWeatherByCity('São Paulo')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeatherByCity('São Paulo')
    )
  }, [])

  const fetchWeatherByCoords = async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=5`
      )
      const data = await res.json()
      const cityRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      )
      const cityData = await cityRes.json()
      const city = cityData.address?.city || cityData.address?.town || 'Sua cidade'
      parseWeather(data, city)
    } catch {
      setLoading(false)
    }
  }

  const fetchWeatherByCity = async (city: string) => {
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
      )
      const geoData = await geoRes.json()
      const loc = geoData.results?.[0]
      if (!loc) return setLoading(false)
      await fetchWeatherByCoords(loc.latitude, loc.longitude)
    } catch {
      setLoading(false)
    }
  }

  const parseWeather = (data: any, city: string) => {
    const code = data.current?.weathercode
    const condition = getCondition(code)
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    setWeather({
      city,
      temp: Math.round(data.current?.temperature_2m ?? 0),
      condition,
      high: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
      low: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
      forecast: (data.daily?.temperature_2m_max || []).slice(1, 5).map((t: number, i: number) => ({
        day: days[new Date(data.daily.time[i + 1]).getDay()],
        temp: Math.round(t),
        icon: getCondition(data.daily.weathercode?.[i + 1]),
      })),
    })
    setLoading(false)
  }

  const getCondition = (code: number): string => {
    if (code <= 1) return 'Ensolarado'
    if (code <= 3) return 'Parcialmente nublado'
    if (code <= 48) return 'Nublado'
    if (code <= 67) return 'Chuva'
    if (code <= 77) return 'Neve'
    if (code <= 82) return 'Chuva forte'
    return 'Tempestade'
  }

  if (loading) return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="skeleton h-4 w-24 rounded mb-3" />
      <div className="skeleton h-8 w-16 rounded mb-2" />
      <div className="skeleton h-3 w-32 rounded" />
    </div>
  )

  if (!weather) return null

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-ink-tertiary mb-0.5">{weather.city}</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-semibold text-ink-primary">{weather.temp}°</span>
            <WeatherIcon condition={weather.condition} size={20} />
          </div>
          <p className="text-xs text-ink-secondary mt-0.5">{weather.condition}</p>
          <p className="text-xs text-ink-tertiary">H: {weather.high}° L: {weather.low}°</p>
        </div>
      </div>
      {weather.forecast.length > 0 && (
        <div className="flex gap-2 pt-3 border-t border-border">
          {weather.forecast.map((f, i) => (
            <div key={i} className="flex-1 text-center">
              <p className="text-[10px] text-ink-tertiary mb-1">{f.day}</p>
              <WeatherIcon condition={f.icon} size={13} />
              <p className="text-[11px] font-medium text-ink-secondary mt-1">{f.temp}°</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
