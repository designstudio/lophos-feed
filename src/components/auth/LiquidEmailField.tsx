'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowNarrowRight } from '@untitledui/icons'
import { Liquid } from 'liquid-gooey'

type LiquidEmailFieldProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

const TRANSITION = {
  duration: 600,
  ease: 'cubic-bezier(0.22, 1.3, 0.71, 1)',
} as const

export function LiquidEmailField({
  value,
  onChange,
  disabled = false,
  placeholder = 'Insira seu endereço de e-mail',
}: LiquidEmailFieldProps) {
  const [open, setOpen] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }

    setPulsing(false)
    const frame = requestAnimationFrame(() => setPulsing(true))
    const timeout = window.setTimeout(() => setPulsing(false), TRANSITION.duration + 60)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [open])

  return (
    <Liquid
      blur={8}
      contrast={22}
      fill="var(--input-bg)"
      shadow="0 0 0 1px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.05), 0 4px 42px rgba(0,0,0,.06)"
      className={`liquid-email-field${pulsing ? ' liquid-email-field--pulsing' : ''}`}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <Liquid.Item
        className="liquid-email-field__field-slot"
        x={open ? -32 : 0}
        transition={TRANSITION}
      >
        <div className="liquid-email-field__field">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            aria-label="Endereço de e-mail"
            className="liquid-email-field__input"
            disabled={disabled}
            required
          />
        </div>
      </Liquid.Item>

      <Liquid.Item
        className="liquid-email-field__button-slot"
        x={open ? 34 : 0}
        transition={TRANSITION}
      >
        <button
          type="submit"
          className="liquid-email-field__button"
          aria-label={disabled ? 'Carregando' : 'Continuar com este e-mail'}
          tabIndex={open ? 0 : -1}
          disabled={disabled}
          onPointerDown={(event) => event.preventDefault()}
        >
          <ArrowNarrowRight size={18} className="liquid-email-field__arrow" />
        </button>
      </Liquid.Item>
    </Liquid>
  )
}
