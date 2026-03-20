const PALETTE = [
  { bg: 'rgba(124,106,247,0.12)', text: '#7c6af7', border: 'rgba(124,106,247,0.3)' },
  { bg: 'rgba(52,211,153,0.10)', text: '#10b981', border: 'rgba(52,211,153,0.25)' },
  { bg: 'rgba(251,146,60,0.10)', text: '#f97316', border: 'rgba(251,146,60,0.25)' },
  { bg: 'rgba(236,72,153,0.10)', text: '#ec4899', border: 'rgba(236,72,153,0.25)' },
  { bg: 'rgba(56,189,248,0.10)', text: '#0ea5e9', border: 'rgba(56,189,248,0.25)' },
  { bg: 'rgba(250,204,21,0.10)', text: '#ca8a04', border: 'rgba(250,204,21,0.25)' },
  { bg: 'rgba(248,113,113,0.10)', text: '#ef4444', border: 'rgba(248,113,113,0.25)' },
  { bg: 'rgba(167,139,250,0.10)', text: '#8b5cf6', border: 'rgba(167,139,250,0.25)' },
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
