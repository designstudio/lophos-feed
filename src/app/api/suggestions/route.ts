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

  const prompt = `O usuário tem interesse nos seguintes tópicos: ${topics.join(', ')}.

Sugira exatamente 12 tópicos relacionados que ele provavelmente também gostaria — baseados em:
- Outros jogos/séries/artistas do mesmo gênero ou que fãs costumam gostar juntos
- Tópicos complementares (ex: quem gosta de Valorant → CS2, Overwatch, esports)
- Séries/filmes relacionados (ex: quem gosta de Stranger Things → Dark, The OA)
- Artistas relacionados (ex: quem gosta de Taylor Swift → Olivia Rodrigo, Sabrina Carpenter)

Regras:
- NÃO repetir nenhum tópico que já está na lista do usuário
- Nomes próprios em inglês quando aplicável (ex: "League of Legends", não "Liga das Lendas")
- Máximo 12 sugestões
- Responda APENAS com JSON: ["sugestão1","sugestão2",...]`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
      }),
    }
  )

  if (!res.ok) return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS })

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const match = raw.replace(/```json|```/g, '').match(/\[[\s\S]*?\]/)

  if (!match) return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS })

  try {
    const suggestions = JSON.parse(match[0])
      .filter((s: any) => typeof s === 'string' && !topics.includes(s))
      .slice(0, 12)
    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ suggestions: DEFAULT_SUGGESTIONS })
  }
}

const DEFAULT_SUGGESTIONS = [
  'Inteligência Artificial', 'Tecnologia', 'Futebol', 'NBA', 'Formula 1',
  'Cinema', 'Música', 'Economia', 'Startups', 'Ciência', 'Saúde', 'Esports',
]
