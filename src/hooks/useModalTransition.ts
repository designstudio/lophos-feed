'use client'

import { useEffect, useRef, useState } from 'react'

function getModalCloseDuration() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur')
  return Number.parseFloat(value) || 150
}

export function useModalTransition(isOpen: boolean) {
  const [rendered, setRendered] = useState(isOpen)
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const openFrameRef = useRef<number | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (openFrameRef.current !== null) cancelAnimationFrame(openFrameRef.current)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    openFrameRef.current = null
    closeTimerRef.current = null

    if (isOpen) {
      setRendered(true)
      setClosing(false)
      openFrameRef.current = requestAnimationFrame(() => {
        setOpen(true)
        openFrameRef.current = null
      })
    } else if (rendered) {
      setOpen(false)
      setClosing(true)
      closeTimerRef.current = setTimeout(() => {
        setRendered(false)
        setClosing(false)
        closeTimerRef.current = null
      }, getModalCloseDuration())
    } else {
      setOpen(false)
      setClosing(false)
    }

    return () => {
      if (openFrameRef.current !== null) cancelAnimationFrame(openFrameRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [isOpen, rendered])

  return { rendered, open, closing }
}
