'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

function getDropdownCloseDuration() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--dropdown-close-dur')
  return Number.parseFloat(value) || 150
}

export function useDropdownTransition() {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const openRef = useRef(false)
  const closingRef = useRef(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const openDropdown = useCallback(() => {
    clearCloseTimer()
    openRef.current = true
    closingRef.current = false
    setClosing(false)
    setOpen(true)
  }, [clearCloseTimer])

  const closeDropdown = useCallback(() => {
    if (!openRef.current && !closingRef.current) return
    clearCloseTimer()
    openRef.current = false
    closingRef.current = true
    setOpen(false)
    setClosing(true)
    closeTimerRef.current = setTimeout(() => {
      closingRef.current = false
      setClosing(false)
      closeTimerRef.current = null
    }, getDropdownCloseDuration())
  }, [clearCloseTimer])

  const toggleDropdown = useCallback(() => {
    if (openRef.current) closeDropdown()
    else openDropdown()
  }, [closeDropdown, openDropdown])

  useEffect(() => clearCloseTimer, [clearCloseTimer])

  return { open, closing, openDropdown, closeDropdown, toggleDropdown }
}
