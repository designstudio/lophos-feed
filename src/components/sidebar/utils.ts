// Theme / Accent utilities
export function applyTheme(t: string) {
  localStorage.setItem('theme', t)
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function applyAccent(color: string) {
  localStorage.setItem('accent_color', color)
  document.documentElement.style.setProperty('--color-accent', color)
}

if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('accent_color')
  if (saved) document.documentElement.style.setProperty('--color-accent', saved)
  applyTheme(localStorage.getItem('theme') || 'light')
}

export const ACCENT_COLORS = [
  { label: 'Padrão',  value: '#ca774b', dot: '#ca774b' },
  { label: 'Azul',    value: '#2563eb', dot: '#3b82f6' },
  { label: 'Verde',   value: '#16a34a', dot: '#22c55e' },
  { label: 'Amarelo', value: '#ca8a04', dot: '#eab308' },
  { label: 'Rosa',    value: '#db2777', dot: '#ec4899' },
  { label: 'Laranja', value: '#ea580c', dot: '#f97316' },
];

export const WIDGET_OPTIONS = [
  { id: 'interest-topics', label: 'Tópicos de interesse' },
  { id: 'valorant', label: 'Partidas - Valorant' },
  { id: 'lol',      label: 'Partidas - League of Legends' },
  { id: 'series',   label: 'Minhas séries' },
];
