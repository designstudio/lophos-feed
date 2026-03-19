const PALETTE = [
  { bg: 'rgba(124,106,247,0.12)', text: '#a99ff7', border: 'rgba(124,106,247,0.3)' },
  { bg: 'rgba(52,211,153,0.10)', text: '#6ee7b7', border: 'rgba(52,211,153,0.25)' },
  { bg: 'rgba(251,146,60,0.10)', text: '#fdba74', border: 'rgba(251,146,60,0.25)' },
  { bg: 'rgba(236,72,153,0.10)', text: '#f9a8d4', border: 'rgba(236,72,153,0.25)' },
  { bg: 'rgba(56,189,248,0.10)', text: '#7dd3fc', border: 'rgba(56,189,248,0.25)' },
  { bg: 'rgba(250,204,21,0.10)', text: '#fde68a', border: 'rgba(250,204,21,0.25)' },
  { bg: 'rgba(248,113,113,0.10)', text: '#fca5a5', border: 'rgba(248,113,113,0.25)' },
  { bg: 'rgba(167,139,250,0.10)', text: '#c4b5fd', border: 'rgba(167,139,250,0.25)' },
]

const cache = new Map<string, typeof PALETTE[0]>()
let idx = 0

export function getTopicColor(topic: string) {
  if (!cache.has(topic)) {
    cache.set(topic, PALETTE[idx % PALETTE.length])
    idx++
  }
  return cache.get(topic)!
}
