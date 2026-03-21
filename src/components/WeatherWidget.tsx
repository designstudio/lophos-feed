'use client'
import { useState, useEffect } from 'react'
import { Sun2, SunFog, Fog, Waterdrops, Snowflake, CloudBoltMinimalistic } from '@solar-icons/react-perf/Linear'

interface WeatherData {
  city: string
  region: string
  temp: number
  condition: string
  high: number
  low: number
  currentCode: number
  forecast: { day: string; temp: number; weathercode: number }[]
}

function WeatherIcon({ code, size = 16 }: { code: number; size?: number }) {
  const cls = "text-ink-primary"
  if (code <= 1)  return <Sun2 size={size} className={cls} />
  if (code <= 3)  return <SunFog size={size} className={cls} />
  if (code <= 48) return <Fog size={size} className={cls} />
  if (code <= 67) return <Waterdrops size={size} className={cls} />
  if (code <= 77) return <Snowflake size={size} className={cls} />
  if (code <= 82) return <Waterdrops size={size} className={cls} />
  return <CloudBoltMinimalistic size={size} className={cls} />
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) { fetchWeatherByCity('São Paulo'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeatherByCity('São Paulo')
    )
  }, [])

  const fetchWeatherByCoords = async (lat: number, lon: number) => {
    try {
      const [weatherRes, cityRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=6`),
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
      ])
      const data = await weatherRes.json()
      const cityData = await cityRes.json()
      const city = cityData.address?.suburb || cityData.address?.city || cityData.address?.town || 'Sua cidade'
      const region = cityData.address?.city || cityData.address?.state || ''
      parseWeather(data, city, region)
    } catch { setLoading(false) }
  }

  const fetchWeatherByCity = async (city: string) => {
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
      const geoData = await geoRes.json()
      const loc = geoData.results?.[0]
      if (!loc) return setLoading(false)
      await fetchWeatherByCoords(loc.latitude, loc.longitude)
    } catch { setLoading(false) }
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

  const parseWeather = (data: any, city: string, region: string) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    setWeather({
      city,
      region,
      temp: Math.round(data.current?.temperature_2m ?? 0),
      condition: getCondition(data.current?.weather_code ?? 0),
      currentCode: data.current?.weather_code ?? 0,
      high: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
      low: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
      forecast: (data.daily?.time || []).slice(1, 6).map((t: string, i: number) => ({
        day: days[new Date(t).getDay()],
        temp: Math.round(data.daily.temperature_2m_max[i + 1] ?? 0),
        weathercode: data.daily.weather_code?.[i + 1] ?? 0,
      })),
    })
    setLoading(false)
  }

  if (loading) return (
    <div className="rounded-2xl border border-border bg-bg-primary p-4">
      <div className="skeleton h-4 w-24 rounded mb-3" />
      <div className="skeleton h-8 w-16 rounded mb-2" />
      <div className="skeleton h-3 w-32 rounded" />
    </div>
  )

  if (!weather) return null

  return (
    <div className="rounded-2xl border border-border bg-bg-primary p-4">
      {/* Top row — Perplexity style */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <WeatherIcon code={weather.currentCode} size={18} />
          <span className="text-[15px] font-semibold text-ink-primary">{weather.temp}°</span>
          <span className="text-[13px] text-ink-tertiary"><span className="text-ink-muted">F/</span><span className="font-semibold text-ink-primary">C</span></span>
        </div>
        <span className="text-[13px] text-ink-secondary">{weather.condition}</span>
      </div>

      {/* City + high/low */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-ink-secondary">{weather.city}{weather.region ? `, ${weather.region}` : ''}</span>
        <span className="text-[12px] text-ink-tertiary">H: {weather.high}° L: {weather.low}°</span>
      </div>

      {/* Forecast days */}
      {weather.forecast.length > 0 && (
        <div className="flex justify-between pt-3 border-t border-border">
          {weather.forecast.map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <WeatherIcon code={f.weathercode} size={18} />
              <span className="text-[11px] text-ink-secondary font-medium">{f.temp}°</span>
              <span className="text-[10px] text-ink-tertiary">{f.day}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
