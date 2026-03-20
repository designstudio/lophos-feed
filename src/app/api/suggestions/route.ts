import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const GEMINI_KEY = process.env.GEMINI_API_KEY!

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics } = await req.json()
  if (!Array.isArray(topics) || topics.length === 0) {
    return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS })
  }

  const prompt = `O usuário gosta de: ${topics.join(', ')}.

Sugira exatamente 12 tópicos que ele provavelmente também curtiria, sendo muito específico e relacionado ao que ele já tem. Exemplos de raciocínio:
- Valorant, LOL, TFT → CS2, Dota 2, Overwatch 2, Fortnite, Apex Legends
- American Horror Story → Stranger Things, The Haunting of Hill House, Black Mirror, Dark
- Cinema → Oscar 2025, Christopher Nolan, A24, Animações Pixar
- Música → nome de artistas ou gêneros relacionados
- Overwatch → outros hero shooters ou jogos da Blizzard

NÃO repita: ${topics.join(', ')}
Responda SOMENTE com JSON array de strings, sem markdown, sem explicação:
["sugestão1","sugestão2","sugestão3","sugestão4","sugestão5","sugestão6","sugestão7","sugestão8","sugestão9","sugestão10","sugestão11","sugestão12"]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 300 },
        }),
      }
    )

    if (!res.ok) {
      console.error('Gemini suggestions error:', res.status, await res.text())
      return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS })
    }

    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const match = clean.match(/\[[\s\S]*?\]/)

    if (!match) {
      console.error('No JSON match in Gemini response:', raw)
      return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS })
    }

    const parsed: string[] = JSON.parse(match[0])
    const suggestions = parsed
      .filter((s) => typeof s === 'string' && s.trim() && !topics.includes(s))
      .slice(0, 12)

    return NextResponse.json({ suggestions })
  } catch (e) {
    console.error('Suggestions error:', e)
    return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS })
  }
}

const DEFAULT_SUGGESTIONS = [
  'Inteligência Artificial', 'Tecnologia', 'Futebol', 'NBA', 'Formula 1',
  'Cinema', 'Música', 'Economia', 'Startups', 'Ciência', 'Saúde', 'Esports',
]
