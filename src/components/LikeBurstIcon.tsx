import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

type ParticleStyle = CSSProperties & {
  '--px': string
  '--py': string
  '--pdur': string
  '--pdelay': string
  '--p-end-scale': number
  '--psize': number
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function createParticles(token: number): ParticleStyle[] {
  return Array.from({ length: 8 }, (_, index) => {
    const seed = token * 11 + index + 1
    const angle = (Math.PI * 2 * index) / 8 + (seededRandom(seed) - 0.5) * 0.35
    const distance = 17 + seededRandom(seed + 3) * 10

    return {
      '--px': `${Math.cos(angle) * distance}px`,
      '--py': `${Math.sin(angle) * distance}px`,
      '--pdur': `${500 + seededRandom(seed + 5) * 180}ms`,
      '--pdelay': `${seededRandom(seed + 7) * 45}ms`,
      '--p-end-scale': 0.4 + seededRandom(seed + 9) * 0.35,
      '--psize': 0.75 + seededRandom(seed + 11) * 0.7,
    }
  })
}

export function LikeBurstIcon({
  liked,
  burstToken,
  size = 20,
  className,
}: {
  liked: boolean
  burstToken: number
  size?: number
  className?: string
}) {
  // Partículas só existem depois de uma interação. Isso mantém o HTML inicial
  // idêntico no servidor e no cliente e evita diferenças de ponto flutuante na hidratação.
  const particles = burstToken > 0 ? createParticles(burstToken) : []

  return (
    <span
      key={burstToken}
      className={cn('t-like', burstToken > 0 && 'is-bursting', className)}
      data-liked={liked}
    >
      <span className="t-like-icon">
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className="t-like-heart"
          aria-hidden="true"
        >
          <path
            d="M11.993 5.136c-2-2.338-5.333-2.966-7.838-.826s-2.858 5.719-.89 8.25c1.635 2.105 6.585 6.544 8.207 7.98.182.162.272.242.378.274a.504.504 0 0 0 .286 0c.106-.032.197-.112.378-.273 1.623-1.437 6.573-5.876 8.208-7.98 1.967-2.532 1.658-6.133-.89-8.251-2.549-2.118-5.84-1.512-7.839.826Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="t-like-particles" aria-hidden="true">
        {particles.map((style, index) => <i key={index} style={style} />)}
      </span>
    </span>
  )
}
