// Theme utilities
export function applyTheme(t: string) {
  localStorage.setItem('theme', t)
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

if (typeof window !== 'undefined') {
  applyTheme(localStorage.getItem('theme') || 'light')
}
