// Simple inline SVG icons — used where Solar doesn't have a plain version

export function IconPlus({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconClose({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function IconHeartFilled({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.993 5.136c-2-2.338-5.333-2.966-7.838-.826s-2.858 5.719-.89 8.25c1.635 2.105 6.585 6.544 8.207 7.98.182.162.272.242.378.274a.504.504 0 0 0 .286 0c.106-.032.197-.112.378-.273 1.623-1.437 6.573-5.876 8.208-7.98 1.967-2.532 1.658-6.133-.89-8.251-2.549-2.118-5.84-1.512-7.839.826Z" />
    </svg>
  )
}

export function IconFeed({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className} aria-hidden="true">
      <path d="M13.5 4.5V11C13.5 11.3315 13.3683 11.6495 13.1339 11.8839C12.8995 12.1183 12.5815 12.25 12.25 12.25M12.25 12.25C11.9185 12.25 11.6005 12.1183 11.3661 11.8839C11.1317 11.6495 11 11.3315 11 11V2.25C11 2.11739 10.9473 1.99021 10.8536 1.89645C10.7598 1.80268 10.6326 1.75 10.5 1.75H1C0.867392 1.75 0.740215 1.80268 0.646447 1.89645C0.552678 1.99021 0.5 2.11739 0.5 2.25V11.25C0.5 11.5152 0.605357 11.7696 0.792893 11.9571C0.98043 12.1446 1.23478 12.25 1.5 12.25H12.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 4.25H3.5V6.75H8V4.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 9.75H8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
