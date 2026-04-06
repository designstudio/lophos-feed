'use client'
import { useState, useEffect, useRef } from 'react'
import { Sun as Sun2, SunSetting02 as SunFog, CloudRaining06 as Fog, Droplets03 as Waterdrops, Snowflake01 as Snowflake, CloudLightning as CloudBoltMinimalistic } from '@untitledui/icons'

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

const WEATHER_CACHE_KEY = 'weather_cache_v2'
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000

type WeatherCache = {
  ts: number
  unit: 'c' | 'f'
  data: WeatherData
  coords?: { lat: number; lon: number }
}

function getWeatherKind(code: number): string {
  if (code === 0) return 'clear'
  if (code === 1) return 'mostly_clear'
  if (code === 2) return 'partly_cloudy'
  if (code === 3) return 'overcast'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'showers'
  if (code >= 85 && code <= 86) return 'snow_showers'
  if (code === 95) return 'thunder'
  if (code === 96 || code === 99) return 'thunder_hail'
  return 'unknown'
}

function WeatherIcon({ code, size = 16 }: { code: number; size?: number }) {
  const cls = "text-ink-primary"
  const kind = getWeatherKind(code)
  if (kind === 'clear' || kind === 'mostly_clear' || kind === 'partly_cloudy') return <Sun2 size={size} className={cls} />
  if (kind === 'overcast') return <SunFog size={size} className={cls} />
  if (kind === 'fog') return <Fog size={size} className={cls} />
  if (kind === 'drizzle' || kind === 'rain' || kind === 'showers') return <Waterdrops size={size} className={cls} />
  if (kind === 'snow' || kind === 'snow_showers') return <Snowflake size={size} className={cls} />
  return <CloudBoltMinimalistic size={size} className={cls} />
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [unit, setUnit] = useState<'c' | 'f'>('c')
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null)
  const lastCityRef = useRef('São Paulo')

  useEffect(() => {
    const savedUnit = localStorage.getItem('weather_unit')
    const resolvedUnit = (savedUnit === 'f' || savedUnit === 'c') ? savedUnit : 'c'
    if (resolvedUnit !== unit) setUnit(resolvedUnit)

    const cachedRaw = localStorage.getItem(WEATHER_CACHE_KEY)
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as WeatherCache
        if (cached?.unit === resolvedUnit && Date.now() - cached.ts < WEATHER_CACHE_TTL_MS) {
          setWeather(cached.data)
          setLoading(false)
          if (cached.coords) lastCoordsRef.current = cached.coords
          lastCityRef.current = cached.data.city || 'São Paulo'
          return
        }
      } catch {}
    }

    if (!navigator.geolocation) { fetchWeatherByCity('São Paulo'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeatherByCity('São Paulo')
    )
  }, [])

  useEffect(() => {
    localStorage.setItem('weather_unit', unit)
  }, [unit])

  const fetchWeatherByCoords = async (lat: number, lon: number) => {
    try {
      setLoading(true)
      lastCoordsRef.current = { lat, lon }
      const [weatherRes, cityRes] = await Promise.all([
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&forecast_days=6&temperature_unit=celsius`),
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
      ])
      const data = await weatherRes.json()
      const cityData = await cityRes.json()
      const city = cityData.address?.suburb || cityData.address?.city || cityData.address?.town || 'Sua cidade'
      const region = cityData.address?.city || cityData.address?.state || ''
      lastCityRef.current = city
      parseWeather(data, city, region)
    } catch { setLoading(false) }
  }

  const fetchWeatherByCity = async (city: string) => {
    try {
      setLoading(true)
      lastCityRef.current = city
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
      const geoData = await geoRes.json()
      const loc = geoData.results?.[0]
      if (!loc) return setLoading(false)
      await fetchWeatherByCoords(loc.latitude, loc.longitude)
    } catch { setLoading(false) }
  }

  const getCondition = (code: number): string => {
    const kind = getWeatherKind(code)
    if (kind === 'clear' || kind === 'mostly_clear') return 'Ensolarado'
    if (kind === 'partly_cloudy') return 'Parcialmente nublado'
    if (kind === 'overcast') return 'Nublado'
    if (kind === 'fog') return 'Neblina'
    if (kind === 'drizzle') return 'Garoa'
    if (kind === 'rain' || kind === 'showers') return 'Chuva'
    if (kind === 'snow' || kind === 'snow_showers') return 'Neve'
    if (kind === 'thunder' || kind === 'thunder_hail') return 'Tempestade'
    return 'Tempo instável'
  }

  const parseWeather = (data: any, city: string, region: string) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    const parsed: WeatherData = {
      city,
      region,
      temp: Math.round(data.current?.temperature_2m ?? 0),
      condition: getCondition(data.current?.weather_code ?? 0),
      currentCode: data.current?.weather_code ?? 0,
      high: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
      low: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
      // Use daily.weather_code directly — Open Meteo already picks the dominant
      // (worst-case) code for the full day, which matches what other weather apps show
      forecast: (data.daily?.time || []).slice(1, 6).map((t: string, i: number) => ({
        day: days[new Date(t + 'T12:00:00').getDay()],
        temp: Math.round(data.daily.temperature_2m_max[i + 1] ?? 0),
        weathercode: data.daily.weather_code?.[i + 1] ?? 0,
      })),
    }
    setWeather(parsed)
    setLoading(false)

    try {
      const payload: WeatherCache = {
        ts: Date.now(),
        unit,
        data: parsed,
        coords: lastCoordsRef.current ?? undefined,
      }
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload))
    } catch {}
  }

  if (loading) return (
    <div className="rounded-2xl border border-border bg-bg-primary p-4">
      <div className="skeleton h-4 w-24 rounded mb-3" />
      <div className="skeleton h-8 w-16 rounded mb-2" />
      <div className="skeleton h-3 w-32 rounded" />
    </div>
  )

  if (!weather) return null

  const toUnit = (c: number) => unit === 'f' ? Math.round(c * 9 / 5 + 32) : c

  return (
    <div className="rounded-2xl border border-border bg-bg-primary p-4">
      {/* Top row â€” Perplexity style */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <WeatherIcon code={weather.currentCode} size={18} />
          <span className="text-[15px] font-semibold text-ink-primary">{toUnit(weather.temp)}°</span>
          <span className="text-[13px] text-ink-tertiary">
            <button
              type="button"
              onClick={() => setUnit('f')}
              className={unit === 'f' ? 'font-semibold text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'}
            >
              F
            </button>
            <span className="text-ink-muted">/</span>
            <button
              type="button"
              onClick={() => setUnit('c')}
              className={unit === 'c' ? 'font-semibold text-ink-primary' : 'text-ink-muted hover:text-ink-secondary'}
            >
              C
            </button>
          </span>
        </div>
        <span className="text-[13px] text-ink-secondary">{weather.condition}</span>
      </div>

      {/* City + high/low */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] text-ink-secondary">{weather.city}{weather.region ? `, ${weather.region}` : ''}</span>
        <span className="text-[12px] text-ink-tertiary">H: {toUnit(weather.high)}° L: {toUnit(weather.low)}°</span>
      </div>

      {/* Forecast days */}
      {weather.forecast.length > 0 && (
        <div className="flex justify-between pt-3 border-t border-border">
          {weather.forecast.map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <WeatherIcon code={f.weathercode} size={18} />
              <span className="text-[11px] text-ink-secondary font-medium">{toUnit(f.temp)}°</span>
              <span className="text-[10px] text-ink-tertiary">{f.day}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

